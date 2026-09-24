import { agent, countWords, polite, slug, tidy, type Ctx, type RawItem, type Source } from '../shared'
import { CORPUS_BOUNDS } from '../../../src/lib/curation'
import { WIKISOURCE_CATEGORIES } from '../seed/wikisource'

const API = 'https://en.wikisource.org/w/api.php'

interface CategoryResponse {
  query?: { categorymembers?: Array<{ title: string; ns: number }> }
  continue?: { cmcontinue?: string }
}

interface ExtractResponse {
  query?: { pages?: Record<string, { title: string; extract?: string; missing?: string }> }
}

interface WikitextResponse {
  query?: {
    pages?: Record<string, { title: string; revisions?: Array<{ slots?: { main?: { '*'?: string; content?: string } } }> }>
  }
}

/** Sub-pages, talk pages and indexes are not works. */
function isWork(title: string): boolean {
  if (/^(Author|Index|Page|Portal|Template|Category|Wikisource|Help|File|Translation):/i.test(title)) return false
  if (/\/(Notes|Contents|Index|Preface|Appendix)$/i.test(title)) return false
  return true
}

async function categoryMembers(category: string, cap: number, ctx: Ctx): Promise<string[]> {
  const titles: string[] = []
  let cursor: string | undefined
  while (titles.length < cap) {
    const url =
      `${API}?action=query&format=json&formatversion=1&list=categorymembers` +
      `&cmtitle=${encodeURIComponent(`Category:${category}`)}&cmnamespace=0&cmlimit=200` +
      (cursor ? `&cmcontinue=${encodeURIComponent(cursor)}` : '')
    const data = await polite<CategoryResponse>(url, { headers: agent(ctx.contactEmail) })
    for (const member of data.query?.categorymembers ?? []) {
      if (isWork(member.title)) titles.push(member.title)
    }
    cursor = data.continue?.cmcontinue
    if (!cursor) break
  }
  return titles.slice(0, cap)
}

async function extracts(titles: string[], ctx: Ctx): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  for (let i = 0; i < titles.length; i += 20) {
    const batch = titles.slice(i, i + 20)
    const url =
      `${API}?action=query&format=json&formatversion=1&prop=extracts&explaintext=1&exlimit=20` +
      `&titles=${encodeURIComponent(batch.join('|'))}`
    const data = await polite<ExtractResponse>(url, { headers: agent(ctx.contactEmail) })
    for (const page of Object.values(data.query?.pages ?? {})) {
      if (page.extract) out.set(page.title, page.extract)
    }
  }
  return out
}

/** The {{header}} template carries author and year; extracts strip it out. */
async function headers(titles: string[], ctx: Ctx): Promise<Map<string, { author: string; year?: number }>> {
  const out = new Map<string, { author: string; year?: number }>()
  for (let i = 0; i < titles.length; i += 10) {
    const batch = titles.slice(i, i + 10)
    const url =
      `${API}?action=query&format=json&formatversion=1&prop=revisions&rvprop=content&rvslots=main` +
      `&titles=${encodeURIComponent(batch.join('|'))}`
    const data = await polite<WikitextResponse>(url, { headers: agent(ctx.contactEmail) })
    for (const page of Object.values(data.query?.pages ?? {})) {
      const slotValue = page.revisions?.[0]?.slots?.main
      const text = slotValue?.['*'] ?? slotValue?.content ?? ''
      const author = /\|\s*author\s*=\s*([^|\n}]+)/i.exec(text)?.[1]?.trim()
      const year = /\|\s*year\s*=\s*(\d{3,4})/i.exec(text)?.[1]
      out.set(page.title, {
        author: (author ?? '').replace(/\[\[|\]\]/g, '').split('|').pop()?.trim() || 'Anonymous',
        year: year ? Number(year) : undefined,
      })
    }
  }
  return out
}

/**
 * Wikisource is per-work rather than per-book, which is what makes it the right
 * spine for the story and essay slots: nothing has to be cut out of a collection.
 */
export const wikisource: Source = {
  name: 'wikisource',
  async collect(ctx: Ctx): Promise<RawItem[]> {
    const out: RawItem[] = []
    const perCategory = Math.max(20, Math.ceil(ctx.limit / WIKISOURCE_CATEGORIES.length))

    for (const entry of WIKISOURCE_CATEGORIES) {
      if (out.length >= ctx.limit) break
      let titles: string[]
      try {
        titles = await categoryMembers(entry.category, perCategory, ctx)
      } catch (error) {
        ctx.log(`  wikisource: ${entry.category} unavailable (${String(error)})`)
        continue
      }
      if (titles.length === 0) continue

      const [bodies, meta] = await Promise.all([extracts(titles, ctx), headers(titles, ctx)])
      const [min, max] = CORPUS_BOUNDS[entry.form]

      for (const title of titles) {
        if (out.length >= ctx.limit) break
        const raw = bodies.get(title)
        if (!raw) continue
        const body = tidy(raw)
        const words = countWords(body)
        if (words < min || words > max) continue

        const info = meta.get(title) ?? { author: 'Anonymous' }
        out.push({
          id: slug('ws', entry.form, title),
          form: entry.form,
          title: title.replace(/\s*\(.*?\)\s*$/, '').trim(),
          author: info.author,
          year: info.year,
          url: `https://en.wikisource.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`,
          license: 'public domain',
          subjects: [entry.form, ...entry.subjects],
          body,
          source: 'wikisource',
        })
      }
      ctx.log(`  wikisource: ${entry.category} → ${out.length} works so far`)
    }

    return out
  },
}
