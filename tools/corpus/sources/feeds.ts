import { XMLParser } from 'fast-xml-parser'
import { agent, countWords, polite, slug, type Ctx, type Form, type RawItem, type Source } from '../shared'
import { SLOT_WORDS } from '../../../src/lib/budget'

interface Feed {
  url: string
  publisher: string
  form: Form
  subjects: string[]
}

/**
 * Free-to-read modern writing. All copyright to their publishers, so all link-out:
 * the corpus keeps the publisher's own standfirst and sends you to the source.
 */
const FEEDS: Feed[] = [
  { url: 'https://aeon.co/feed.rss', publisher: 'Aeon', form: 'essay', subjects: ['essay', 'philosophy', 'science'] },
  { url: 'https://nautil.us/feed/', publisher: 'Nautilus', form: 'essay', subjects: ['science', 'biology', 'physics'] },
  { url: 'https://www.quantamagazine.org/feed/', publisher: 'Quanta', form: 'essay', subjects: ['mathematics', 'physics', 'biology'] },
  { url: 'https://clarkesworldmagazine.com/feed/', publisher: 'Clarkesworld', form: 'story', subjects: ['fiction', 'science fiction', 'technology'] },
  { url: 'http://strangehorizons.com/feed/', publisher: 'Strange Horizons', form: 'story', subjects: ['fiction', 'literature'] },
  { url: 'https://reactormag.com/feed/', publisher: 'Reactor', form: 'story', subjects: ['fiction', 'science fiction'] },
  { url: 'https://www.themarginalian.org/feed/', publisher: 'The Marginalian', form: 'essay', subjects: ['literature', 'philosophy', 'art'] },
]

function text(value: unknown): string {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object' && '#text' in value) return String((value as Record<string, unknown>)['#text'])
  return ''
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim()
}

export const feeds: Source = {
  name: 'feeds',
  async collect(ctx: Ctx): Promise<RawItem[]> {
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' })
    const out: RawItem[] = []

    for (const feed of FEEDS) {
      if (out.length >= ctx.limit) break
      let xml: string
      try {
        xml = await polite<string>(feed.url, { headers: agent(ctx.contactEmail) }, 500)
      } catch (error) {
        ctx.log(`  feeds: ${feed.publisher} unavailable (${String(error)})`)
        continue
      }

      let entries: Record<string, unknown>[] = []
      try {
        const parsed = parser.parse(typeof xml === 'string' ? xml : String(xml))
        const channel = parsed?.rss?.channel ?? parsed?.feed ?? {}
        const raw = channel.item ?? channel.entry ?? []
        entries = Array.isArray(raw) ? raw : [raw]
      } catch (error) {
        ctx.log(`  feeds: ${feed.publisher} unparseable (${String(error)})`)
        continue
      }

      for (const entry of entries) {
        if (out.length >= ctx.limit) break
        const title = stripHtml(text(entry.title))
        const link =
          text(entry.link) ||
          (Array.isArray(entry.link)
            ? String((entry.link[0] as Record<string, string>)?.['@_href'] ?? '')
            : String((entry.link as Record<string, string>)?.['@_href'] ?? ''))
        const summary = stripHtml(
          text(entry.description) || text(entry.summary) || text(entry['content:encoded']),
        ).slice(0, 600)
        if (!title || !link || summary.length < 60) continue

        /*
         * These pieces are read at the publisher, so their length has to come from
         * the feed itself. Most of these feeds carry the whole article in
         * content:encoded, which gives a real word count. When a feed does not, the
         * length is unknowable and the item is dropped rather than risk a 40-minute
         * essay landing in a 30-minute night.
         */
        const full = stripHtml(text(entry['content:encoded']) || text(entry.content))
        const words = countWords(full)
        const [min, max] = SLOT_WORDS[feed.form]
        if (words < min || words > max) continue

        const published = text(entry.pubDate) || text(entry.published) || text(entry.updated)
        const author = stripHtml(text(entry['dc:creator']) || text(entry.author)) || feed.publisher

        out.push({
          id: slug('feed', feed.publisher, title),
          form: feed.form,
          title,
          author,
          year: published ? new Date(published).getUTCFullYear() || undefined : undefined,
          url: link,
          license: `© ${feed.publisher}`,
          subjects: [...feed.subjects, ...(Array.isArray(entry.category) ? entry.category.map(text) : [text(entry.category)])],
          summary,
          sourceWords: words,
          source: 'feeds',
        })
      }
      ctx.log(`  feeds: ${feed.publisher} → ${out.length} pieces so far`)
    }

    return out
  },
}
