export type Form = 'story' | 'poem' | 'essay'

export const FORMS: readonly Form[] = ['story', 'poem', 'essay'] as const

export const FORM_LABEL: Record<Form, string> = {
  story: 'Short story',
  poem: 'Poem',
  essay: 'Essay',
}

export type Field =
  | 'philosophy'
  | 'politics'
  | 'history'
  | 'biology'
  | 'physics'
  | 'mathematics'
  | 'earth'
  | 'psychology'
  | 'technology'
  | 'economics'
  | 'art'
  | 'literature'
  | 'religion'
  | 'nature'

export const FIELDS: readonly Field[] = [
  'philosophy', 'politics', 'history', 'biology', 'physics', 'mathematics',
  'earth', 'psychology', 'technology', 'economics', 'art', 'literature',
  'religion', 'nature',
] as const

export const FIELD_LABEL: Record<Field, string> = {
  philosophy: 'Philosophy',
  politics: 'Politics & Society',
  history: 'History',
  biology: 'Biology & Life Sciences',
  physics: 'Physics & Cosmology',
  mathematics: 'Mathematics',
  earth: 'Earth & Archaeology',
  psychology: 'Psychology & Mind',
  technology: 'Technology & Computing',
  economics: 'Economics',
  art: 'Art & Music',
  literature: 'Literature & Criticism',
  religion: 'Religion & Myth',
  nature: 'Nature & Environment',
}

/** The light manifest row loaded for every item on boot. */
export interface IndexEntry {
  id: string
  form: Form
  title: string
  author: string
  year?: number
  /** 1-3 tags; the first is primary. */
  fields: Field[]
  words: number
  mode: 'full' | 'link'
  source: string
}

/** A full item, fetched lazily from corpus/items/<id>.json. */
export interface Item extends IndexEntry {
  /** Present when mode === 'full'. Plain text, blank-line separated paragraphs. */
  body?: string
  /** Present when mode === 'link'. */
  summary?: string
  url: string
  license: string
}

export interface NightRecord {
  /** Recorded on first interaction so a night is auditable even if the corpus changes. */
  dealt: Partial<Record<Form, string>>
  done: Form[]
  completedAt?: string
}

export interface SavedItem {
  id: string
  at: string
  note?: string
}

/**
 * The durable record, committed to the `state` branch.
 * `derived` is written for human readability only and is always recomputed on load.
 */
export interface Progress {
  version: 1
  startedOn: string
  salt: string
  nights: Record<string, NightRecord>
  saved: SavedItem[]
  updatedAt: string
  derived?: {
    nightsCompleted: number
    currentStreak: number
    longestStreak: number
  }
}

export interface Settings {
  timeZone: string
  /** Hour of the day at which the next night's reading opens. */
  rolloverHour: number
  token?: string
  owner: string
  repo: string
  branch: string
  path: string
  fontScale: number
}

export const TARGET_NIGHTS = 1000

export const DEFAULT_SETTINGS: Settings = {
  timeZone: 'America/New_York',
  rolloverHour: 18,
  owner: 'piercev18-cloud',
  repo: 'Brain-expander',
  branch: 'state',
  path: 'state/progress.json',
  fontScale: 1,
}
