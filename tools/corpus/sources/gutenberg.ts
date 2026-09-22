import { agent, countWords, firstSentences, polite, slug, tidy, type Ctx, type RawItem, type Source } from '../shared'
import { GUTENBERG_TOPICS } from '../seed/gutenberg'
import { SLOT_WORDS } from '../../../src/lib/budget'

interface Book {
  id: number
  title: string
  authors: Array<{ name: string; birth_year?: number; death_year?: number }>
  subjects: string[]
  bookshelves: string[]
  formats: Record<string, string>
}

interface Page {
  results?: Book[]
  next?: string | null
}

const START = /\*\*\*\s*START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^*]*\*\*\*/i
const END = /\*\*\*\s*END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^*]*\*\*\*/i

/** Gutenberg wraps every text in licence boilerplate that is not part of the work. */
export function stripBoilerplate(text: string): string {
  let body = text
  const start = START.exec(body)
  if (start) body = body.slice(start.index + start[0].length)
  const end = END.exec(body)
  if (end) body = body.slice(0, end.index)
  // Transcriber's notes and produced-by lines sit outside the work proper.
  body = body.replace(/^\s*Produced by .*$/gim, '')
  return tidy(body)
}

function plainTextUrl(formats: Record<string, string>): string | undefined {
  for (const [type, url] of Object.entries(formats)) {
    if (type.startsWith('text/plain') && !url.endsWith('.zip')) return url
  }
  return undefined
}

/**
 * Gutenberg through Gutendex — no key. Most Gutenberg texts are whole volumes, so
 * the word-count gate does the work here: what survives is the pamphlet, the lecture
 * and the single long essay, which is exactly the shape the essay slot wants.
 */
export const gutenberg: Source = {
  name: 'gutenberg',
  async collect(ctx: Ctx): Promise<RawItem[]> {
    const out: RawItem[] = []
    const perTopic = Math.max(6, Math.ceil(ctx.limit / GUTENBERG_TOPICS.length))

    for (const topic of GUTENBERG_TOPICS) {
      if (out.length >= ctx.limit) break
      let page: Page
      try {
        page = await polite<Page>(
          `https://gutendex.com/books?languages=en&topic=${encodeURIComponent(topic.topic)}&sort=popular`,
          { headers: agent(ctx.contactEmail) },
        )
      } catch (error) {
        ctx.log(`  gutenberg: ${topic.topic} unavailable (${String(error)})`)
        continue
      }

      let kept = 0
      for (const book of page.results ?? []) {
        if (kept >= perTopic || out.length >= ctx.limit) break
        const url = plainTextUrl(book.formats)
        if (!url) continue

        let raw: string
        try {
          raw = await polite<string>(url, { headers: agent(ctx.contactEmail) }, 600)
        } catch {
          continue
        }

        const body = stripBoilerplate(typeof raw === 'string' ? raw : String(raw))
        const words = countWords(body)
        // Most Gutenberg texts are whole volumes; the budget is what selects the
        // single essay and the lecture out of them.
        const [min, max] = SLOT_WORDS.essay
        if (words < min || words > max) continue

        const author = book.authors[0]
        out.push({
          id: slug('pg', String(book.id), book.title),
          form: 'essay',
          title: book.title.split('\n')[0].trim(),
          author: author ? author.name.split(',').reverse().join(' ').trim() : 'Anonymous',
          year: author?.death_year,
          url: `https://www.gutenberg.org/ebooks/${book.id}`,
          license: 'public domain',
          subjects: [...book.subjects, ...book.bookshelves, ...topic.subjects],
          body,
          summary: firstSentences(body),
          source: 'gutenberg',
        })
        kept++
      }
      ctx.log(`  gutenberg: ${topic.topic} → ${out.length} works so far`)
    }

    return out
  },
}
