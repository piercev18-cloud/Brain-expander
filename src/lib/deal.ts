import { FORMS, type Form, type IndexEntry, type Progress } from './types'
import { nightIndexFor } from './night'

/* Deterministic PRNG: xmur3 seeds, mulberry32 generates. Small, stable, no dependency. */

export function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    h ^= h >>> 16
    return h >>> 0
  }
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type Pools = Record<Form, string[]>

/** Pools are sorted so that a corpus addition never reshuffles the ids already present. */
export function buildPools(index: IndexEntry[]): Pools {
  const pools = { story: [] as string[], poem: [] as string[], essay: [] as string[] }
  for (const e of index) pools[e.form].push(e.id)
  for (const form of FORMS) pools[form].sort()
  return pools
}

/**
 * Every item finished on a night strictly before `index`.
 *
 * Only *completed* items are consumed. A night you opened but never finished returns
 * its pieces to the pool, so nothing good is lost by skipping a night.
 */
export function consumedBefore(progress: Progress, index: number): Set<string> {
  const out = new Set<string>()
  for (const [key, record] of Object.entries(progress.nights)) {
    if (nightIndexFor(key, progress.startedOn) >= index) continue
    for (const form of record.done) {
      const id = record.dealt[form]
      if (id) out.add(id)
    }
  }
  return out
}

/**
 * The three pieces for a night.
 *
 * Seeded by (salt, index, form), so the same night always yields the same draw and a
 * refresh never re-rolls. When a pool is exhausted it wraps to the unfiltered pool
 * rather than dead-ending.
 */
export function dealNight(
  index: number,
  salt: string,
  pools: Pools,
  consumed: ReadonlySet<string>,
): Partial<Record<Form, string>> {
  const out: Partial<Record<Form, string>> = {}
  for (const form of FORMS) {
    const pool = pools[form]
    if (pool.length === 0) continue
    const available = pool.filter((id) => !consumed.has(id))
    const from = available.length > 0 ? available : pool
    const rng = mulberry32(xmur3(`${salt}|${index}|${form}`)())
    out[form] = from[Math.floor(rng() * from.length)]
  }
  return out
}

/**
 * The deal for a night: whatever was recorded, else computed.
 * A recorded deal always wins, so history can never be rewritten by a corpus change.
 */
export function dealFor(
  index: number,
  progress: Progress,
  pools: Pools,
  nightDateKey: string,
): Partial<Record<Form, string>> {
  const recorded = progress.nights[nightDateKey]?.dealt
  if (recorded && FORMS.every((f) => recorded[f])) return recorded
  const computed = dealNight(index, progress.salt, pools, consumedBefore(progress, index))
  return { ...computed, ...(recorded ?? {}) }
}
