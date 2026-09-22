import { XMLParser } from 'fast-xml-parser'
import { agent, polite, slug, type Ctx, type RawItem, type Source } from '../shared'

/**
 * arXiv categories chosen for readability rather than novelty: history, overview and
 * "general interest" sections carry writing addressed to a reader, not only to referees.
 * This is how mathematics and physics reach the essay slot at all — the public domain
 * cannot supply them.
 */
const CATEGORIES: Array<{ cat: string; subjects: string[] }> = [
  { cat: 'math.HO', subjects: ['mathematics', 'history'] },
  { cat: 'physics.hist-ph', subjects: ['physics', 'history', 'philosophy'] },
  { cat: 'physics.pop-ph', subjects: ['physics', 'astronomy'] },
  { cat: 'astro-ph.EP', subjects: ['astronomy', 'physics'] },
  { cat: 'q-bio.PE', subjects: ['biology', 'evolution'] },
  { cat: 'cs.CY', subjects: ['technology', 'computing', 'society'] },
  { cat: 'econ.GN', subjects: ['economics'] },
  { cat: 'stat.OT', subjects: ['statistics', 'mathematics'] },
]

function text(value: unknown): string {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object' && '#text' in value) return String((value as Record<string, unknown>)['#text'])
  return ''
}

export const arxiv: Source = {
  name: 'arxiv',
  async collect(ctx: Ctx): Promise<RawItem[]> {
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' })
    const out: RawItem[] = []
    const perCategory = Math.max(10, Math.ceil(ctx.limit / CATEGORIES.length))

    for (const { cat, subjects } of CATEGORIES) {
      if (out.length >= ctx.limit) break
      let xml: string
      try {
        xml = await polite<string>(
          `https://export.arxiv.org/api/query?search_query=cat:${encodeURIComponent(cat)}` +
            `&start=0&max_results=${Math.min(perCategory, 100)}&sortBy=relevance`,
          { headers: agent(ctx.contactEmail) },
          3100, // arXiv asks for one request every three seconds
        )
      } catch (error) {
        ctx.log(`  arxiv: ${cat} unavailable (${String(error)})`)
        continue
      }

      const parsed = parser.parse(typeof xml === 'string' ? xml : String(xml))
      const raw = parsed?.feed?.entry ?? []
      for (const entry of (Array.isArray(raw) ? raw : [raw]) as Record<string, unknown>[]) {
        if (out.length >= ctx.limit) break
        const title = text(entry.title).replace(/\s+/g, ' ').trim()
        const summary = text(entry.summary).replace(/\s+/g, ' ').trim()
        const link = text(entry.id)
        if (!title || summary.length < 120 || !link) continue

        const authors = Array.isArray(entry.author) ? entry.author : [entry.author]
        const byline = authors
          .slice(0, 3)
          .map((a) => text((a as Record<string, unknown>)?.name))
          .filter(Boolean)
          .join(', ')

        out.push({
          id: slug('arxiv', link.split('/abs/').pop() ?? title),
          form: 'essay',
          title,
          author: byline || 'arXiv',
          year: new Date(text(entry.published)).getUTCFullYear() || undefined,
          url: link,
          // Most arXiv postings keep author copyright under a non-redistributable licence,
          // so the abstract plus a link is the honest treatment for all of them.
          license: 'arXiv (author retains copyright)',
          subjects: [...subjects, cat],
          summary: summary.slice(0, 700),
          source: 'arxiv',
        })
      }
      ctx.log(`  arxiv: ${cat} → ${out.length} papers so far`)
    }

    return out
  },
}
