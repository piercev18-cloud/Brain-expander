import type { Field, IndexEntry, Item } from './types'

const BASE = import.meta.env.BASE_URL

let indexPromise: Promise<IndexEntry[]> | null = null
const items = new Map<string, Promise<Item>>()

export function loadIndex(): Promise<IndexEntry[]> {
  if (!indexPromise) {
    indexPromise = fetch(`${BASE}corpus/index.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`corpus index unavailable (${r.status})`)
        return r.json()
      })
      .catch((error) => {
        indexPromise = null
        throw error
      })
  }
  return indexPromise
}

export function loadItem(id: string): Promise<Item> {
  let pending = items.get(id)
  if (!pending) {
    pending = fetch(`${BASE}corpus/items/${id}.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`piece unavailable (${r.status})`)
        return r.json()
      })
      .catch((error) => {
        items.delete(id)
        throw error
      })
    items.set(id, pending)
  }
  return pending
}

/** Warm the cache for the nights ahead so a dead zone is never a broken night. */
export function prefetch(ids: string[]): void {
  for (const id of ids) void loadItem(id).catch(() => undefined)
}

/** Deliberately unhurried: this is bedtime reading, not a commute. */
export function readingMinutes(words: number): number {
  return Math.max(1, Math.round(words / 200))
}

/** Null when the length is unknown — a link-out must not claim a reading time it cannot know. */
export function readingTime(words: number): string | null {
  if (!words) return null
  const minutes = readingMinutes(words)
  return minutes < 60 ? `${minutes} min` : `${Math.round(minutes / 60)} hr`
}

/**
 * Mirrors the builder's licence rule. A link-out is either a piece we may not
 * republish, or a public domain piece whose text has not been fetched yet — and
 * the reader should be told which, accurately.
 */
export function isRedistributable(license: string): boolean {
  const normalised = license.trim().toLowerCase()
  return ['public domain', 'pd-us', 'cc0', 'cc-by', 'cc-by-sa'].some((ok) => normalised.startsWith(ok))
}

export function fieldCounts(entries: IndexEntry[]): Map<Field, number> {
  const counts = new Map<Field, number>()
  for (const entry of entries) {
    for (const field of entry.fields) counts.set(field, (counts.get(field) ?? 0) + 1)
  }
  return counts
}
