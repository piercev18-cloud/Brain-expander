import { FORMS, type Form, type IndexEntry } from './types'

/**
 * Curation, not rationing.
 *
 * Nothing here is a gate. A piece is never excluded from the corpus for being long —
 * the point of the program is to read interesting things, and a 40-minute essay you
 * want is worth more than a 10-minute one you do not. What the engine does instead is
 * tell the truth about tonight's length and, when you genuinely have not got the time,
 * let you pass a piece over to a longer night.
 */

/** Verse is read slowly and often twice; prose is not. */
export const READING_RATE: Record<Form, number> = {
  story: 220,
  poem: 90,
  essay: 220,
}

/**
 * The only hard bounds, and they exist to keep whole books and fragments out —
 * not to keep nights short. A piece inside these is fair game however long it runs.
 */
export const CORPUS_BOUNDS: Record<Form, [number, number]> = {
  story: [300, 12_000],
  poem: [20, 3_000],
  essay: [500, 15_000],
}

export const DEFAULT_NIGHTLY_MINUTES = 30

/** null means no target: show the estimate, never suggest a swap. */
export const NIGHTLY_OPTIONS: Array<number | null> = [15, 20, 30, 45, 60, 90, null]

export function estimateMinutes(form: Form, words: number): number {
  if (!words) return 0
  return Math.max(1, Math.round(words / READING_RATE[form]))
}

export function withinCorpus(form: Form, words: number): boolean {
  const [min, max] = CORPUS_BOUNDS[form]
  return words >= min && words <= max
}

export interface NightEstimate {
  /** Minutes for the pieces still unread tonight. */
  remaining: number
  /** Minutes for all three, read or not. */
  total: number
  perSlot: Partial<Record<Form, number>>
  /** Unknown lengths are excluded from the totals and counted here instead. */
  unknown: Form[]
}

export function estimateNight(
  entries: Partial<Record<Form, IndexEntry | undefined>>,
  done: readonly Form[] = [],
): NightEstimate {
  const perSlot: Partial<Record<Form, number>> = {}
  const unknown: Form[] = []
  let remaining = 0
  let total = 0

  for (const form of FORMS) {
    const entry = entries[form]
    if (!entry) continue
    if (!entry.words) {
      unknown.push(form)
      continue
    }
    const minutes = estimateMinutes(form, entry.words)
    perSlot[form] = minutes
    total += minutes
    if (!done.includes(form)) remaining += minutes
  }

  return { remaining, total, perSlot, unknown }
}

/**
 * The slot to offer a swap on: the longest piece still unread. Offering to drop the
 * single biggest item is what actually recovers the evening — trimming the poem does
 * nothing.
 */
export function heaviestSlot(
  estimate: NightEstimate,
  done: readonly Form[] = [],
): Form | null {
  let worst: Form | null = null
  let most = 0
  for (const form of FORMS) {
    if (done.includes(form)) continue
    const minutes = estimate.perSlot[form] ?? 0
    if (minutes > most) {
      most = minutes
      worst = form
    }
  }
  return worst
}

export function overTarget(estimate: NightEstimate, target: number | null): boolean {
  return target !== null && estimate.remaining > target
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`
}
