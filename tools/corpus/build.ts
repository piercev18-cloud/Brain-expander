/**
 * Corpus builder. Runs in GitHub Actions, never on the phone — which is why no API
 * key ever reaches the client, and why a blocked or rate-limited source is a warning
 * rather than an outage.
 *
 *   npm run corpus -- --dry-run          collect and validate, write nothing
 *   npm run corpus -- --limit 40         cap each source
 *   npm run corpus -- --only poetrydb    run a single source
 */

import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { FIELDS, type IndexEntry, type Item } from '../../src/lib/types'
import { countWords, decideMode, mayStoreFullText, type RawItem, type Source } from './shared'
import { NIGHT_BUDGET_MINUTES, SLOT_WORDS, minutes, withinBudget, worstCaseNightMinutes } from '../../src/lib/budget'
import { tagFields } from './tag'
import { poetrydb } from './sources/poetrydb'
import { wikisource } from './sources/wikisource'
import { gutenberg } from './sources/gutenberg'
import { guardian } from './sources/guardian'
import { feeds } from './sources/feeds'
import { arxiv } from './sources/arxiv'

/*
 * arXiv is kept but not run by default: a research paper has no upper bound on
 * length and is not a bedtime essay, so it cannot honour the night budget.
 * Re-enable it deliberately with `npm run corpus -- --only arxiv`.
 */
const SOURCES: Source[] = [poetrydb, wikisource, gutenberg, guardian, feeds]
const OPT_IN: Source[] = [arxiv]

const ROOT = join(import.meta.dirname, '..', '..')
const OUT = join(ROOT, 'public', 'corpus')
const ITEMS = join(OUT, 'items')

function arg(name: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`)
  if (index >= 0 && process.argv[index + 1] && !process.argv[index + 1].startsWith('--')) {
    return process.argv[index + 1]
  }
  return fallback
}

const dryRun = process.argv.includes('--dry-run')
const limit = Number(arg('limit', '400'))
const only = arg('only')?.split(',').map((s) => s.trim()).filter(Boolean)

const log = (message: string) => console.log(message)

/** Titles collapse to a comparable key so the same work from two sources lands once. */
function dedupeKey(item: RawItem): string {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
  return `${item.form}:${norm(item.title)}:${norm(item.author).slice(0, 14)}`
}

async function main() {
  const ctx = {
    limit,
    contactEmail: process.env.CONTACT_EMAIL ?? '',
    secrets: process.env as Record<string, string | undefined>,
    log,
  }

  const collected: RawItem[] = []

  // Opt-in sources run only when named explicitly.
  for (const source of [...SOURCES, ...OPT_IN]) {
    if (only ? !only.includes(source.name) : OPT_IN.includes(source)) continue

    const missing = (source.requires ?? []).filter((key) => !ctx.secrets[key])
    if (missing.length > 0) {
      log(`- ${source.name}: skipped, no ${missing.join(', ')}`)
      continue
    }

    log(`- ${source.name}: collecting…`)
    try {
      const items = await source.collect(ctx)
      log(`- ${source.name}: ${items.length} items`)
      collected.push(...items)
    } catch (error) {
      // A source that fails must never take the whole corpus down with it.
      log(`- ${source.name}: FAILED (${String(error)})`)
    }
  }

  /* Keep everything already published: pools must stay stable as the corpus grows. */
  const existingIndex: IndexEntry[] = existsSync(join(OUT, 'index.json'))
    ? JSON.parse(readFileSync(join(OUT, 'index.json'), 'utf8'))
    : []

  const seenIds = new Set(existingIndex.map((e) => e.id))
  const seenWorks = new Set(
    existingIndex.map((e) => `${e.form}:${e.title.toLowerCase().replace(/[^a-z0-9]/g, '')}:${e.author.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 14)}`),
  )

  const fresh: Item[] = []
  for (const raw of collected) {
    if (seenIds.has(raw.id) || seenWorks.has(dedupeKey(raw))) continue
    seenIds.add(raw.id)
    seenWorks.add(dedupeKey(raw))

    const mode = decideMode(raw)
    const body = mode === 'full' ? raw.body : undefined
    const summary = mode === 'link' ? (raw.summary ?? '').slice(0, 700) : undefined
    if (mode === 'link' && !summary) continue

    fresh.push({
      id: raw.id,
      form: raw.form,
      title: raw.title,
      author: raw.author,
      year: raw.year,
      fields: tagFields([...raw.subjects, raw.title], raw.form, raw.id),
      // A summary's length says nothing about the work's, so link-outs
      // carry the source length when a source reports one and 0 otherwise.
      words: mode === 'full' ? countWords(body ?? '') : (raw.sourceWords ?? 0),
      mode,
      source: raw.source,
      body,
      summary,
      url: raw.url,
      license: raw.license,
    })
  }

  const index: IndexEntry[] = [
    ...existingIndex,
    ...fresh.map(({ body: _body, summary: _summary, url: _url, license: _license, ...entry }) => entry),
  ]

  /* Gates. A failure here means the corpus is wrong, so the build stops. */
  const untagged = fresh.filter((item) => item.fields.length === 0)
  const illegal = fresh.filter((item) => item.mode === 'full' && !mayStoreFullText(item.license))
  const unreadable = fresh.filter((item) => item.mode === 'full' && !item.body)
  // Checked across the whole corpus, not only this run's additions: an item that
  // busts the budget breaks the promise however it got in.
  const overlong = index.filter((item) => !withinBudget(item.form, item.words))

  if (untagged.length || illegal.length || unreadable.length || overlong.length) {
    if (untagged.length) log(`FAIL: ${untagged.length} items carry no field tag`)
    if (illegal.length) log(`FAIL: ${illegal.length} items store full text without a redistributable licence`)
    if (unreadable.length) log(`FAIL: ${unreadable.length} items claim full text but have no body`)
    for (const item of overlong.slice(0, 10)) {
      const [min, max] = SLOT_WORDS[item.form]
      log(`FAIL: ${item.form} "${item.title}" is ${item.words} words (${Math.round(minutes(item.words))} min); the slot allows ${min}-${max}`)
    }
    if (overlong.length > 10) log(`FAIL: and ${overlong.length - 10} more outside the night budget`)
    process.exit(1)
  }

  log('')
  log(`Corpus: ${index.length} items (${fresh.length} new this run)`)
  for (const form of ['story', 'poem', 'essay'] as const) {
    const rows = index.filter((e) => e.form === form)
    const full = rows.filter((e) => e.mode === 'full').length
    log(`  ${form.padEnd(6)} ${String(rows.length).padStart(5)}  (${full} readable in-app, ${rows.length - full} link out)`)
  }
  log(`  nights available: ${Math.min(...(['story', 'poem', 'essay'] as const).map((f) => index.filter((e) => e.form === f).length))}`)
  log(`  longest possible night: ${worstCaseNightMinutes().toFixed(0)} min (budget ${NIGHT_BUDGET_MINUTES})`)
  log('')
  for (const field of FIELDS) {
    const count = index.filter((e) => e.fields.includes(field)).length
    log(`  ${field.padEnd(13)} ${count}`)
  }

  if (dryRun) {
    log('\nDry run: nothing written.')
    return
  }

  mkdirSync(ITEMS, { recursive: true })
  for (const item of fresh) {
    writeFileSync(join(ITEMS, `${item.id}.json`), JSON.stringify(item))
  }
  writeFileSync(join(OUT, 'index.json'), JSON.stringify(index))
  writeFileSync(
    join(OUT, 'taxonomy.json'),
    JSON.stringify({ fields: FIELDS, generated: new Date().toISOString() }, null, 2),
  )
  log(`\nWrote ${fresh.length} items to public/corpus.`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
