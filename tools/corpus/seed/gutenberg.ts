/**
 * Gutenberg topic searches for the essay slot. Bradbury's brief is "essays in every
 * field: archaeology, zoology, biology, all the great philosophers of time, comparing
 * them... On politics, analyzing literature" — these topics track that list.
 */
export const GUTENBERG_TOPICS: Array<{ topic: string; subjects: string[] }> = [
  { topic: 'essays', subjects: ['essay', 'literature'] },
  { topic: 'philosophy', subjects: ['philosophy'] },
  { topic: 'ethics', subjects: ['philosophy', 'ethics'] },
  { topic: 'politics', subjects: ['politics', 'government'] },
  { topic: 'economics', subjects: ['economics', 'trade'] },
  { topic: 'natural history', subjects: ['nature', 'natural history', 'biology'] },
  { topic: 'zoology', subjects: ['zoology', 'biology'] },
  { topic: 'botany', subjects: ['botany', 'biology'] },
  { topic: 'evolution', subjects: ['evolution', 'biology'] },
  { topic: 'astronomy', subjects: ['astronomy', 'physics'] },
  { topic: 'physics', subjects: ['physics'] },
  { topic: 'chemistry', subjects: ['chemistry', 'physics'] },
  { topic: 'mathematics', subjects: ['mathematics'] },
  { topic: 'archaeology', subjects: ['archaeology', 'earth'] },
  { topic: 'geology', subjects: ['geology', 'earth'] },
  { topic: 'anthropology', subjects: ['anthropology', 'earth'] },
  { topic: 'psychology', subjects: ['psychology', 'mind'] },
  { topic: 'criticism', subjects: ['literature', 'criticism'] },
  { topic: 'rhetoric', subjects: ['literature', 'rhetoric'] },
  { topic: 'art', subjects: ['art'] },
  { topic: 'music', subjects: ['music', 'art'] },
  { topic: 'architecture', subjects: ['architecture', 'art'] },
  { topic: 'mythology', subjects: ['myth', 'religion', 'folklore'] },
  { topic: 'religion', subjects: ['religion', 'theology'] },
  { topic: 'travel', subjects: ['travel', 'nature'] },
  { topic: 'technology', subjects: ['technology', 'engineering'] },
]
