/**
 * Night boundaries.
 *
 * A "night" runs from `rolloverHour` on one calendar day to `rolloverHour` on the next,
 * in an explicit IANA timezone. Reading at 11pm and at 1am therefore land on the same night.
 *
 * All timezone reasoning happens by formatting an instant into wall-clock parts via
 * Intl with an explicit `timeZone` — never via the device's local offset. Once an instant
 * is reduced to a calendar date, arithmetic runs on UTC midnights, which makes the day
 * maths immune to DST: the 23- and 25-hour nights are absorbed by the formatting step.
 */

export interface WallParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

const partsCache = new Map<string, Intl.DateTimeFormat>()

function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = partsCache.get(timeZone)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
    partsCache.set(timeZone, f)
  }
  return f
}

/** Wall-clock parts of `instant` as seen in `timeZone`. */
export function wallParts(instant: Date, timeZone: string): WallParts {
  const out: Record<string, string> = {}
  for (const p of formatter(timeZone).formatToParts(instant)) {
    if (p.type !== 'literal') out[p.type] = p.value
  }
  return {
    year: Number(out.year),
    month: Number(out.month),
    day: Number(out.day),
    // Some ICU builds render midnight as hour 24 under hour12:false.
    hour: Number(out.hour) % 24,
    minute: Number(out.minute),
    second: Number(out.second),
  }
}

export function toDateKey(year: number, month: number, day: number): string {
  const p = (n: number, w = 2) => String(n).padStart(w, '0')
  return `${p(year, 4)}-${p(month)}-${p(day)}`
}

export function parseDateKey(key: string): number {
  const [y, m, d] = key.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

export function addDays(key: string, days: number): string {
  const t = new Date(parseDateKey(key) + days * 86400000)
  return toDateKey(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate())
}

/** Whole days from `a` to `b`. Exact, because both are calendar dates. */
export function daysBetween(a: string, b: string): number {
  return Math.round((parseDateKey(b) - parseDateKey(a)) / 86400000)
}

/**
 * The night an instant belongs to, as a date key.
 * Before the rollover hour you are still inside the previous day's night.
 */
export function nightKey(instant: Date, timeZone: string, rolloverHour: number): string {
  const w = wallParts(instant, timeZone)
  const key = toDateKey(w.year, w.month, w.day)
  return w.hour < rolloverHour ? addDays(key, -1) : key
}

/** Zero-based index of a night, counting from the first night. */
export function nightIndexFor(nightDateKey: string, startedOn: string): number {
  return daysBetween(startedOn, nightDateKey)
}

/**
 * The instant at which `hour` occurs on date `key` in `timeZone`.
 * Guesses at the UTC offset, then corrects — two passes settle any DST transition.
 */
export function zonedInstant(key: string, hour: number, timeZone: string): Date {
  const target = parseDateKey(key) + hour * 3600000
  let guess = target
  for (let i = 0; i < 3; i++) {
    const w = wallParts(new Date(guess), timeZone)
    const actual = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second)
    const drift = target - actual
    if (drift === 0) break
    guess += drift
  }
  return new Date(guess)
}

/** Milliseconds until the next night unlocks. */
export function msUntilRollover(instant: Date, timeZone: string, rolloverHour: number): number {
  const next = addDays(nightKey(instant, timeZone, rolloverHour), 1)
  return zonedInstant(next, rolloverHour, timeZone).getTime() - instant.getTime()
}

export function formatCountdown(ms: number): string {
  if (ms <= 0) return 'now'
  const total = Math.floor(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}
