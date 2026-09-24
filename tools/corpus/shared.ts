import type { Field, Form } from '../../src/lib/types'

export interface RawItem {
  id: string
  form: Form
  title: string
  author: string
  year?: number
  url: string
  license: string
  /** Free-text subject hints: LCSH headings, arXiv categories, feed sections, tags. */
  subjects: string[]
  /** Full text. Only kept when the licence permits it. */
  body?: string
  summary?: string
  /** Length of the work at its source, for link-outs. 0 or absent means unknown. */
  sourceWords?: number
  source: string
}

export interface Ctx {
  limit: number
  contactEmail: string
  secrets: Record<string, string | undefined>
  log: (message: string) => void
}

export interface Source {
  name: string
  /** Environment variables this source needs. Missing ones skip it rather than fail the build. */
  requires?: string[]
  collect: (ctx: Ctx) => Promise<RawItem[]>
}

/**
 * Licences under which we are entitled to store the text itself.
 * Anything else is kept as metadata plus a link — see `decideMode`.
 */
const REDISTRIBUTABLE = [
  'public domain',
  'pd-us',
  'cc0',
  'cc-by',
  'cc-by-sa',
] as const

export function mayStoreFullText(license: string): boolean {
  const normalised = license.trim().toLowerCase()
  return REDISTRIBUTABLE.some((ok) => normalised.startsWith(ok))
}

export function decideMode(item: RawItem): 'full' | 'link' {
  return item.body && mayStoreFullText(item.license) ? 'full' : 'link'
}

export function slug(...parts: string[]): string {
  return parts
    .join('-')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72)
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

export function tidy(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function firstSentences(text: string, count = 3): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  const sentences = clean.match(/[^.!?]+[.!?]+/g) ?? [clean]
  return sentences.slice(0, count).join(' ').trim().slice(0, 600)
}

let lastCall = 0

/**
 * A source that stops responding must not be able to hang the whole run.
 * Overridable so a local run on a restricted network fails fast instead of crawling.
 */
const REQUEST_TIMEOUT_MS = Number(process.env.CORPUS_TIMEOUT_MS ?? 30_000)

/** One request at a time with a floor between calls: these are free services. */
export async function polite<T>(url: string, init: RequestInit, gapMs = 250): Promise<T> {
  const wait = Math.max(0, lastCall + gapMs - Date.now())
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  lastCall = Date.now()

  let lastError: unknown
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })
      if (response.status === 429 || response.status >= 500) {
        throw new Error(`${response.status} ${response.statusText}`)
      }
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
      const type = response.headers.get('content-type') ?? ''
      return (type.includes('json') ? await response.json() : await response.text()) as T
    } catch (error) {
      lastError = error
      await new Promise((r) => setTimeout(r, 800 * 2 ** attempt))
    }
  }
  throw lastError
}

export function agent(contactEmail: string): Record<string, string> {
  return {
    'User-Agent': `a-thousand-nights/1.0 (reading list builder; ${contactEmail || 'anonymous'})`,
    'Accept-Encoding': 'gzip, deflate',
  }
}

export type { Field, Form }
