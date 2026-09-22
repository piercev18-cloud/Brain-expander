/**
 * A small, hand-checked starter corpus so the app is usable on night one, before the
 * corpus workflow has run. Poems are carried in full: they are short, unambiguously
 * public domain, and the poem slot is the one Bradbury is most specific about. The
 * stories and essays here link to Wikisource until the workflow hydrates their text.
 *
 *   npx tsx tools/corpus/bootstrap.ts
 *
 * Re-running is safe: ids already present in index.json are left alone.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { FIELDS, type IndexEntry, type Item } from '../../src/lib/types'
import { countWords, slug } from './shared'
import { SLOT_WORDS, minutes, withinBudget } from '../../src/lib/budget'

const OUT = join(import.meta.dirname, '..', '..', 'public', 'corpus')
const ITEMS = join(OUT, 'items')

interface Seed {
  form: Item['form']
  title: string
  author: string
  year: number
  fields: Item['fields']
  url: string
  body?: string
  summary?: string
  /** Approximate length of the work at its source, for the linked pieces. */
  sourceWords?: number
}

const POEMS: Seed[] = [
  {
    form: 'poem', title: 'The Road Not Taken', author: 'Robert Frost', year: 1916,
    fields: ['literature', 'nature'],
    url: 'https://en.wikisource.org/wiki/Mountain_Interval/The_Road_Not_Taken',
    body: `Two roads diverged in a yellow wood,
And sorry I could not travel both
And be one traveler, long I stood
And looked down one as far as I could
To where it bent in the undergrowth;

Then took the other, as just as fair,
And having perhaps the better claim,
Because it was grassy and wanted wear;
Though as for that the passing there
Had worn them really about the same,

And both that morning equally lay
In leaves no step had trodden black.
Oh, I kept the first for another day!
Yet knowing how way leads on to way,
I doubted if I should ever come back.

I shall be telling this with a sigh
Somewhere ages and ages hence:
Two roads diverged in a wood, and I—
I took the one less traveled by,
And that has made all the difference.`,
  },
  {
    form: 'poem', title: 'Fire and Ice', author: 'Robert Frost', year: 1920,
    fields: ['literature', 'philosophy'],
    url: 'https://en.wikisource.org/wiki/Fire_and_Ice',
    body: `Some say the world will end in fire,
Some say in ice.
From what I've tasted of desire
I hold with those who favor fire.
But if it had to perish twice,
I think I know enough of hate
To say that for destruction ice
Is also great
And would suffice.`,
  },
  {
    form: 'poem', title: 'Nothing Gold Can Stay', author: 'Robert Frost', year: 1923,
    fields: ['nature', 'literature'],
    url: 'https://en.wikisource.org/wiki/New_Hampshire/Nothing_Gold_Can_Stay',
    body: `Nature's first green is gold,
Her hardest hue to hold.
Her early leaf's a flower;
But only so an hour.
Then leaf subsides to leaf.
So Eden sank to grief,
So dawn goes down to day.
Nothing gold can stay.`,
  },
  {
    form: 'poem', title: 'Stopping by Woods on a Snowy Evening', author: 'Robert Frost', year: 1923,
    fields: ['nature', 'literature'],
    url: 'https://en.wikisource.org/wiki/New_Hampshire/Stopping_by_Woods_on_a_Snowy_Evening',
    body: `Whose woods these are I think I know.
His house is in the village though;
He will not see me stopping here
To watch his woods fill up with snow.

My little horse must think it queer
To stop without a farmhouse near
Between the woods and frozen lake
The darkest evening of the year.

He gives his harness bells a shake
To ask if there is some mistake.
The only other sound's the sweep
Of easy wind and downy flake.

The woods are lovely, dark and deep,
But I have promises to keep,
And miles to go before I sleep,
And miles to go before I sleep.`,
  },
  {
    form: 'poem', title: '"Hope" is the thing with feathers', author: 'Emily Dickinson', year: 1891,
    fields: ['psychology', 'literature'],
    url: 'https://en.wikisource.org/wiki/%22Hope%22_is_the_thing_with_feathers',
    body: `"Hope" is the thing with feathers—
That perches in the soul—
And sings the tune without the words—
And never stops—at all—

And sweetest—in the Gale—is heard—
And sore must be the storm—
That could abash the little Bird
That kept so many warm—

I've heard it in the chillest land—
And on the strangest Sea—
Yet, never, in Extremity,
It asked a crumb—of Me.`,
  },
  {
    form: 'poem', title: 'Because I could not stop for Death', author: 'Emily Dickinson', year: 1890,
    fields: ['philosophy', 'literature'],
    url: 'https://en.wikisource.org/wiki/Because_I_could_not_stop_for_Death',
    body: `Because I could not stop for Death—
He kindly stopped for me—
The Carriage held but just Ourselves—
And Immortality.

We slowly drove—He knew no haste
And I had put away
My labor and my leisure too,
For His Civility—

We passed the School, where Children strove
At Recess—in the Ring—
We passed the Fields of Gazing Grain—
We passed the Setting Sun—

Or rather—He passed Us—
The Dews drew quivering and Chill—
For only Gossamer, my Gown—
My Tippet—only Tulle—

We paused before a House that seemed
A Swelling of the Ground—
The Roof was scarcely visible—
The Cornice—in the Ground—

Since then—'tis Centuries—and yet
Feels shorter than the Day
I first surmised the Horses' Heads
Were toward Eternity—`,
  },
  {
    form: 'poem', title: 'The Tyger', author: 'William Blake', year: 1794,
    fields: ['religion', 'literature'],
    url: 'https://en.wikisource.org/wiki/Songs_of_Innocence_and_of_Experience/The_Tyger',
    body: `Tyger Tyger, burning bright,
In the forests of the night;
What immortal hand or eye,
Could frame thy fearful symmetry?

In what distant deeps or skies,
Burnt the fire of thine eyes?
On what wings dare he aspire?
What the hand, dare seize the fire?

And what shoulder, & what art,
Could twist the sinews of thy heart?
And when thy heart began to beat,
What dread hand? & what dread feet?

What the hammer? what the chain,
In what furnace was thy brain?
What the anvil? what dread grasp,
Dare its deadly terrors clasp!

When the stars threw down their spears
And water'd heaven with their tears:
Did he smile his work to see?
Did he who made the Lamb make thee?

Tyger Tyger burning bright,
In the forests of the night:
What immortal hand or eye,
Dare frame thy fearful symmetry?`,
  },
  {
    form: 'poem', title: 'Sonnet 18: Shall I compare thee to a summer’s day?', author: 'William Shakespeare', year: 1609,
    fields: ['literature', 'art'],
    url: 'https://en.wikisource.org/wiki/Sonnet_18_(Shakespeare)',
    body: `Shall I compare thee to a summer's day?
Thou art more lovely and more temperate:
Rough winds do shake the darling buds of May,
And summer's lease hath all too short a date:
Sometime too hot the eye of heaven shines,
And often is his gold complexion dimm'd;
And every fair from fair sometime declines,
By chance or nature's changing course untrimm'd;
But thy eternal summer shall not fade
Nor lose possession of that fair thou owest;
Nor shall Death brag thou wander'st in his shade,
When in eternal lines to time thou growest:
  So long as men can breathe or eyes can see,
  So long lives this and this gives life to thee.`,
  },
  {
    form: 'poem', title: 'Ozymandias', author: 'Percy Bysshe Shelley', year: 1818,
    fields: ['history', 'politics'],
    url: 'https://en.wikisource.org/wiki/Ozymandias',
    body: `I met a traveller from an antique land
Who said: Two vast and trunkless legs of stone
Stand in the desert. Near them, on the sand,
Half sunk, a shattered visage lies, whose frown,
And wrinkled lip, and sneer of cold command,
Tell that its sculptor well those passions read
Which yet survive, stamped on these lifeless things,
The hand that mocked them and the heart that fed:
And on the pedestal these words appear:
"My name is Ozymandias, king of kings:
Look on my works, ye Mighty, and despair!"
Nothing beside remains. Round the decay
Of that colossal wreck, boundless and bare
The lone and level sands stretch far away.`,
  },
  {
    form: 'poem', title: 'The Lake Isle of Innisfree', author: 'William Butler Yeats', year: 1890,
    fields: ['nature', 'literature'],
    url: 'https://en.wikisource.org/wiki/The_Lake_Isle_of_Innisfree',
    body: `I will arise and go now, and go to Innisfree,
And a small cabin build there, of clay and wattles made:
Nine bean-rows will I have there, a hive for the honey-bee,
And live alone in the bee-loud glade.

And I shall have some peace there, for peace comes dropping slow,
Dropping from the veils of the morning to where the cricket sings;
There midnight's all a glimmer, and noon a purple glow,
And evening full of the linnet's wings.

I will arise and go now, for always night and day
I hear lake water lapping with low sounds by the shore;
While I stand on the roadway, or on the pavements grey,
I hear it in the deep heart's core.`,
  },
]

/**
 * Canonical Wikisource works, linked rather than stored until the workflow hydrates
 * them. Deliberately short: anything that cannot fit the night budget is left for the
 * corpus workflow to find, rather than shipped here and rejected by the build.
 */
const LINKED: Seed[] = [
  {
    form: 'story', title: 'The Tell-Tale Heart', author: 'Edgar Allan Poe', year: 1843,
    fields: ['psychology', 'literature'],
    url: 'https://en.wikisource.org/wiki/The_Tell-Tale_Heart',
    sourceWords: 2100,
    summary: 'A narrator insists on his own sanity while describing, in careful detail, the murder he committed and the heartbeat he cannot stop hearing. Poe compresses an entire psychology of guilt into a few pages.',
  },
  {
    form: 'story', title: 'The Gift of the Magi', author: 'O. Henry', year: 1905,
    fields: ['literature', 'economics'],
    url: 'https://en.wikisource.org/wiki/The_Gift_of_the_Magi',
    sourceWords: 2100,
    summary: 'A young couple with almost nothing each sell the one thing they own to buy the other a Christmas present. The most famous ending in American short fiction, and still a genuinely good argument about what value is.',
  },
]

function toItem(seed: Seed): Item {
  const mode = seed.body ? 'full' : 'link'
  return {
    id: slug(seed.form, seed.author, seed.title),
    form: seed.form,
    title: seed.title,
    author: seed.author,
    year: seed.year,
    fields: seed.fields,
    words: seed.body ? countWords(seed.body) : (seed.sourceWords ?? 0),
    mode,
    source: 'bootstrap',
    body: seed.body,
    summary: seed.summary,
    url: seed.url,
    license: 'public domain',
  }
}

const existing: IndexEntry[] = existsSync(join(OUT, 'index.json'))
  ? JSON.parse(readFileSync(join(OUT, 'index.json'), 'utf8'))
  : []
const known = new Set(existing.map((e) => e.id))

mkdirSync(ITEMS, { recursive: true })

const added: IndexEntry[] = []
for (const seed of [...POEMS, ...LINKED]) {
  const item = toItem(seed)
  // The same gate the builder applies, so the starter corpus can never be the
  // reason a night runs long.
  if (!withinBudget(item.form, item.words)) {
    const [min, max] = SLOT_WORDS[item.form]
    console.error(
      `skipped "${item.title}": ${item.words} words (${Math.round(minutes(item.words))} min), slot allows ${min}-${max}`,
    )
    continue
  }
  if (known.has(item.id)) continue
  writeFileSync(join(ITEMS, `${item.id}.json`), JSON.stringify(item))
  const { body: _b, summary: _s, url: _u, license: _l, ...entry } = item
  added.push(entry)
}

const index = [...existing, ...added]
writeFileSync(join(OUT, 'index.json'), JSON.stringify(index))
writeFileSync(
  join(OUT, 'taxonomy.json'),
  JSON.stringify({ fields: FIELDS, generated: new Date().toISOString() }, null, 2),
)

console.log(`Bootstrap: ${added.length} added, ${index.length} in corpus.`)
for (const form of ['story', 'poem', 'essay'] as const) {
  console.log(`  ${form.padEnd(6)} ${index.filter((e) => e.form === form).length}`)
}
