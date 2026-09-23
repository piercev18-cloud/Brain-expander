import { estimateMinutes, formatMinutes } from './curation'
import type { Field, Form, IndexEntry, Item } from './types'

/*
 * Vite rewrites `new URL(..., import.meta.url)` into a build-time asset reference,
 * so the corpus is addressed through the configured base path instead.
 */
const corpusUrl = (path: string) => `${import.meta.env.BASE_URL}corpus/${path}`

/**
 * A host may embed the corpus in the page instead of serving it as files — which is
 * what makes a single self-contained build possible, and what lets the app run
 * somewhere that cannot resolve relative paths or fetch alongside the page.
 */
interface Preloaded {
  index: IndexEntry[]
  items: Record<string, Item>
}

const preloaded = (globalThis as { __CORPUS__?: Preloaded }).__CORPUS__

let indexPromise: Promise<IndexEntry[]> | null = null
const items = new Map<string, Promise<Item>>()

export function loadIndex(): Promise<IndexEntry[]> {
  if (preloaded) return Promise.resolve(preloaded.index)
  if (!indexPromise) {
    indexPromise = fetch(corpusUrl('index.json'))
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
  const embedded = preloaded?.items[id]
  if (embedded) return Promise.resolve(embedded)

  let pending = items.get(id)
  if (!pending) {
    pending = fetch(corpusUrl(`items/${id}.json`))
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

/** Null when the length is unknown — a link-out must not claim a reading time it cannot know. */
export function readingTime(form: Form, words: number): string | null {
  if (!words) return null
  return formatMinutes(estimateMinutes(form, words))
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
