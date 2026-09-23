import { FORMS, type Form, type NightRecord, type Progress, type SavedItem } from './types'
import { addDays } from './night'

export function newSalt(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export function emptyProgress(startedOn: string, salt = newSalt()): Progress {
  return {
    version: 1,
    startedOn,
    salt,
    nights: {},
    saved: [],
    updatedAt: new Date().toISOString(),
  }
}

export function isComplete(record: NightRecord | undefined): boolean {
  return !!record && FORMS.every((f) => record.done.includes(f))
}

export interface Stats {
  nightsCompleted: number
  currentStreak: number
  longestStreak: number
}

/**
 * All counts are derived from the nights map, never incremented in place.
 * A bad merge can therefore never corrupt the number that matters.
 */
export function stats(progress: Progress, todayKey: string): Stats {
  const completed = Object.entries(progress.nights)
    .filter(([, r]) => isComplete(r))
    .map(([key]) => key)
    .sort()

  let longest = 0
  let run = 0
  let previous: string | null = null
  for (const key of completed) {
    run = previous !== null && addDays(previous, 1) === key ? run + 1 : 1
    if (run > longest) longest = run
    previous = key
  }

  // The streak survives a night that is open but not yet finished.
  const done = new Set(completed)
  let anchor = done.has(todayKey) ? todayKey : addDays(todayKey, -1)
  let current = 0
  while (done.has(anchor)) {
    current++
    anchor = addDays(anchor, -1)
  }

  return { nightsCompleted: completed.length, currentStreak: current, longestStreak: longest }
}

export function withDerived(progress: Progress, todayKey: string): Progress {
  return { ...progress, derived: stats(progress, todayKey) }
}

function touch(progress: Progress): Progress {
  return { ...progress, updatedAt: new Date().toISOString() }
}

/** Pin a night's deal so a later corpus change cannot rewrite it. */
export function recordDeal(
  progress: Progress,
  key: string,
  dealt: Partial<Record<Form, string>>,
): Progress {
  const existing = progress.nights[key]
  if (existing && FORMS.every((f) => existing.dealt[f])) return progress
  return {
    ...progress,
    nights: {
      ...progress.nights,
      [key]: { dealt: { ...dealt, ...(existing?.dealt ?? {}) }, done: existing?.done ?? [], completedAt: existing?.completedAt },
    },
  }
}

/**
 * Pass a piece over for tonight and take another in its place.
 *
 * The piece is not lost: it is recorded as passed, which keeps it out of tonight's
 * redraws and returns it to the pool for a night you have more time.
 */
export function swapSlot(progress: Progress, key: string, form: Form, nextId: string): Progress {
  const existing = progress.nights[key] ?? { dealt: {}, done: [] }
  const current = existing.dealt[form]
  const passedSoFar = existing.passed?.[form] ?? []

  const record: NightRecord = {
    ...existing,
    dealt: { ...existing.dealt, [form]: nextId },
    // You cannot have read the piece you just swapped away.
    done: existing.done.filter((f) => f !== form),
    passed: {
      ...existing.passed,
      [form]: current && !passedSoFar.includes(current) ? [...passedSoFar, current] : passedSoFar,
    },
    completedAt: undefined,
  }
  return touch({ ...progress, nights: { ...progress.nights, [key]: record } })
}

export function toggleDone(progress: Progress, key: string, form: Form): Progress {
  const existing = progress.nights[key] ?? { dealt: {}, done: [] }
  const done = existing.done.includes(form)
    ? existing.done.filter((f) => f !== form)
    : [...existing.done, form]
  const record: NightRecord = { ...existing, done }
  record.completedAt = FORMS.every((f) => done.includes(f))
    ? (existing.completedAt ?? new Date().toISOString())
    : undefined
  return touch({ ...progress, nights: { ...progress.nights, [key]: record } })
}

export function toggleSaved(progress: Progress, id: string): Progress {
  const exists = progress.saved.some((s) => s.id === id)
  const saved = exists
    ? progress.saved.filter((s) => s.id !== id)
    : [...progress.saved, { id, at: new Date().toISOString() }]
  return touch({ ...progress, saved })
}

export function setNote(progress: Progress, id: string, note: string): Progress {
  return touch({
    ...progress,
    saved: progress.saved.map((s) => (s.id === id ? { ...s, note: note || undefined } : s)),
  })
}

/**
 * Union merge. Neither side is privileged and the result is the same whichever
 * order the two documents arrive in. Losing a check-off to a clobbering write is
 * the one failure this app cannot have, so nothing here is last-write-wins.
 */
export function merge(a: Progress, b: Progress): Progress {
  const [older, newer] = a.updatedAt <= b.updatedAt ? [a, b] : [b, a]

  const nights: Record<string, NightRecord> = {}
  for (const key of new Set([...Object.keys(a.nights), ...Object.keys(b.nights)])) {
    const x = a.nights[key]
    const y = b.nights[key]
    if (!x || !y) {
      nights[key] = (x ?? y)!
      continue
    }
    const done = FORMS.filter((f) => x.done.includes(f) || y.done.includes(f))
    // Prefer the deal that is more settled; fall back to a stable tiebreak.
    const rank = (r: NightRecord) =>
      [
        r.done.length,
        FORMS.reduce((n, f) => n + (r.passed?.[f]?.length ?? 0), 0),
        FORMS.map((f) => r.dealt[f] ?? '').join('|'),
      ] as const
    const [rx, ry] = [rank(x), rank(y)]
    const winner =
      rx[0] !== ry[0] ? (rx[0] > ry[0] ? x : y)
      : rx[1] !== ry[1] ? (rx[1] > ry[1] ? x : y)
      : rx[2] <= ry[2] ? x : y
    const completedAt = [x.completedAt, y.completedAt].filter(Boolean).sort()[0]
    nights[key] = {
      // A deal and the pieces passed over to reach it are one chain: they travel together.
      dealt: { ...winner.dealt },
      passed: winner.passed ? { ...winner.passed } : undefined,
      done,
      completedAt: done.length === FORMS.length ? (completedAt ?? new Date().toISOString()) : undefined,
    }
  }

  const saved = new Map<string, SavedItem>()
  for (const item of [...older.saved, ...newer.saved]) {
    const prior = saved.get(item.id)
    if (!prior) {
      saved.set(item.id, { ...item })
      continue
    }
    saved.set(item.id, {
      id: item.id,
      at: prior.at <= item.at ? prior.at : item.at,
      // The later document wins a note conflict; an absent note never erases one.
      note: item.note ?? prior.note,
    })
  }

  return {
    version: 1,
    // startedOn and salt are set once at first run; the earlier document is authoritative.
    startedOn: older.startedOn,
    salt: older.salt,
    nights,
    saved: [...saved.values()].sort((x, y) => x.at.localeCompare(y.at)),
    updatedAt: newer.updatedAt,
  }
}
