import type { Field } from '../../src/lib/types'
import { FIELDS } from '../../src/lib/types'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Field tagging is deterministic, not model-based: subject hints are matched against
 * a keyword table, so the same corpus always tags the same way and a mistake is
 * corrected by editing one file rather than re-running anything.
 */
const KEYWORDS: Record<Field, string[]> = {
  philosophy: ['philosoph', 'ethic', 'metaphysic', 'epistemolog', 'logic', 'stoic', 'existential', 'aesthetics', 'moral'],
  politics: ['politic', 'government', 'democracy', 'law', 'justice', 'liberty', 'society', 'sociolog', 'war', 'revolution', 'rights', 'state', 'citizen'],
  history: ['histor', 'antiquit', 'medieval', 'biograph', 'memoir', 'chronicle', 'civilization', 'empire'],
  biology: ['biolog', 'zoolog', 'botan', 'evolution', 'genetic', 'ecolog', 'medicine', 'physiolog', 'anatom', 'neuroscien', 'microb', 'q-bio'],
  physics: ['physic', 'astronom', 'cosmolog', 'quantum', 'relativ', 'astro-ph', 'hep-', 'gr-qc', 'cond-mat', 'chemistr', 'nucl-'],
  mathematics: ['mathemat', 'geometr', 'algebra', 'calculus', 'statistic', 'probabilit', 'number theory', 'math.', 'topolog', 'logic and foundations'],
  earth: ['archaeolog', 'geolog', 'anthropolog', 'palaeo', 'paleo', 'fossil', 'excavat', 'earth', 'climate', 'ocean', 'volcan', 'physics.geo'],
  psychology: ['psycholog', 'mind', 'consciousness', 'memory', 'emotion', 'cognit', 'dream', 'perception', 'behaviour', 'behavior'],
  technology: ['technolog', 'comput', 'engineer', 'machine', 'internet', 'artificial intelligence', 'cs.', 'invention', 'software', 'robot'],
  economics: ['econom', 'trade', 'money', 'market', 'labor', 'labour', 'wealth', 'industr', 'capital', 'finance', 'q-fin'],
  art: ['art', 'music', 'paint', 'sculpt', 'architect', 'photograph', 'design', 'theatre', 'theater', 'dance', 'film'],
  literature: ['literat', 'criticism', 'poetry', 'poem', 'fiction', 'essay', 'drama', 'rhetoric', 'language', 'authorship', 'books and reading', 'short stories'],
  religion: ['religio', 'theolog', 'myth', 'bible', 'buddh', 'christian', 'islam', 'hindu', 'folklore', 'legend', 'spiritual', 'sacred'],
  nature: ['nature', 'natural history', 'wilderness', 'landscape', 'season', 'garden', 'travel', 'mountain', 'forest', 'river', 'bird', 'animal'],
}

let overrides: Record<string, Field[]> | null = null

function loadOverrides(): Record<string, Field[]> {
  if (overrides) return overrides
  try {
    const raw = readFileSync(join(import.meta.dirname, 'overrides.json'), 'utf8')
    overrides = JSON.parse(raw) as Record<string, Field[]>
  } catch {
    overrides = {}
  }
  return overrides
}

/**
 * Up to three fields, most-confident first. Falls back by form so that no item
 * ever ships untagged — an untagged piece is invisible on the Fields screen.
 */
export function tagFields(subjects: string[], form: string, id: string): Field[] {
  const override = loadOverrides()[id]
  if (Array.isArray(override) && override.length > 0) return override.slice(0, 3)

  const haystack = subjects.join(' · ').toLowerCase()
  const scored: Array<[Field, number]> = []

  for (const field of FIELDS) {
    let score = 0
    for (const keyword of KEYWORDS[field]) {
      if (haystack.includes(keyword)) score += keyword.length
    }
    if (score > 0) scored.push([field, score])
  }

  scored.sort((a, b) => b[1] - a[1] || FIELDS.indexOf(a[0]) - FIELDS.indexOf(b[0]))
  const picked = scored.slice(0, 3).map(([field]) => field)

  if (picked.length > 0) return picked
  return form === 'poem' || form === 'story' ? ['literature'] : ['philosophy']
}
