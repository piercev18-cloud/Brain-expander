import { agent, countWords, polite, slug, tidy, type Ctx, type RawItem, type Source } from '../shared'
import { POETS } from '../seed/poets'
import { SLOT_WORDS } from '../../../src/lib/budget'

interface Poem {
  title: string
  author: string
  lines: string[]
  linecount: string
}

/**
 * PoetryDB: public domain poetry as clean JSON, no key, one poem per record.
 * The single best source for the poem slot — it is already per-work, so nothing
 * has to be split out of a collection.
 */
export const poetrydb: Source = {
  name: 'poetrydb',
  async collect(ctx: Ctx): Promise<RawItem[]> {
    const out: RawItem[] = []

    for (const poet of POETS) {
      if (out.length >= ctx.limit) break
      let poems: Poem[]
      try {
        poems = await polite<Poem[]>(
          `https://poetrydb.org/author/${encodeURIComponent(poet.name)}`,
          { headers: agent(ctx.contactEmail) },
        )
      } catch (error) {
        ctx.log(`  poetrydb: ${poet.name} unavailable (${String(error)})`)
        continue
      }
      if (!Array.isArray(poems)) continue

      for (const poem of poems) {
        if (out.length >= ctx.limit) break
        const lines = poem.lines?.filter((l) => l !== undefined) ?? []
        // Skip fragments, and book-length verse that would swallow the whole night.
        if (lines.length < 4 || lines.length > 90) continue

        // Blank lines separate stanzas; the reader preserves line breaks inside them.
        const body = tidy(lines.join('\n'))
        out.push({
          id: slug('poem', poem.author, poem.title),
          form: 'poem',
          title: poem.title.trim(),
          author: poem.author.trim(),
          year: poet.year,
          url: `https://poetrydb.org/author,title/${encodeURIComponent(poem.author)};${encodeURIComponent(poem.title)}`,
          license: 'public domain',
          subjects: ['poetry', ...poet.subjects],
          body,
          source: 'poetrydb',
        })
      }
      ctx.log(`  poetrydb: ${poet.name} → ${out.length} poems so far`)
    }

    const [min, max] = SLOT_WORDS.poem
    return out.filter((item) => {
      const words = countWords(item.body ?? '')
      return words >= min && words <= max
    })
  },
}
