import { agent, countWords, polite, slug, type Ctx, type RawItem, type Source } from '../shared'

interface Result {
  id: string
  webTitle: string
  webUrl: string
  sectionName: string
  webPublicationDate: string
  fields?: { trailText?: string; byline?: string; bodyText?: string; wordcount?: string }
  tags?: Array<{ webTitle: string }>
}

interface Response {
  response?: { results?: Result[]; pages?: number }
}

/**
 * Sections that reliably carry long-form essays rather than news.
 * The Guardian's own tagging is good, which also makes the field tagger's job easy.
 */
const SECTIONS = [
  'science', 'books', 'environment', 'technology', 'music', 'artanddesign',
  'politics', 'commentisfree', 'education', 'society', 'global-development',
]

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

/**
 * The Guardian Open Platform, free developer tier.
 *
 * NOTE ON LICENSING: the API returns full body text, but Guardian articles are
 * copyright Guardian News & Media. The developer tier covers using the content, not
 * republishing it — and this corpus is committed to a public repository, which is
 * republication. So these are stored as metadata plus the Guardian's own standfirst
 * and read at the source. `mayStoreFullText` enforces that automatically; body text
 * is never written to disk.
 */
export const guardian: Source = {
  name: 'guardian',
  requires: ['GUARDIAN_API_KEY'],
  async collect(ctx: Ctx): Promise<RawItem[]> {
    const key = ctx.secrets.GUARDIAN_API_KEY!
    const out: RawItem[] = []
    const perSection = Math.max(10, Math.ceil(ctx.limit / SECTIONS.length))

    for (const section of SECTIONS) {
      if (out.length >= ctx.limit) break
      const pages = Math.ceil(perSection / 50)

      for (let page = 1; page <= pages; page++) {
        let data: Response
        try {
          data = await polite<Response>(
            `https://content.guardianapis.com/search?section=${section}` +
              `&show-fields=trailText,byline,wordcount&show-tags=keyword` +
              `&page-size=50&page=${page}&order-by=relevance&api-key=${encodeURIComponent(key)}`,
            { headers: agent(ctx.contactEmail) },
            1100, // free tier is one call per second
          )
        } catch (error) {
          ctx.log(`  guardian: ${section} unavailable (${String(error)})`)
          break
        }

        for (const article of data.response?.results ?? []) {
          if (out.length >= ctx.limit) break
          const summary = stripHtml(article.fields?.trailText ?? '')
          const words = Number(article.fields?.wordcount ?? 0)
          // Long-form only: below this it is news, not an essay.
          if (!summary || words < 1200) continue

          out.push({
            id: slug('gu', article.id.replace(/\//g, '-')),
            form: 'essay',
            title: article.webTitle.trim(),
            author: (article.fields?.byline ?? 'The Guardian').trim(),
            year: new Date(article.webPublicationDate).getUTCFullYear(),
            url: article.webUrl,
            license: '© Guardian News & Media',
            subjects: [article.sectionName, ...(article.tags ?? []).map((t) => t.webTitle)],
            summary,
            sourceWords: words,
            source: 'guardian',
          })
        }
      }
      ctx.log(`  guardian: ${section} → ${out.length} essays so far`)
    }

    return out.filter((item) => countWords(item.summary ?? '') >= 8)
  },
}
