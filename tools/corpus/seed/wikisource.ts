import type { Form } from '../../../src/lib/types'

/**
 * Wikisource categories to draw from. Each is per-work, so a category member is a
 * single story or essay rather than a whole volume. `subjects` seeds the field
 * tagger for categories whose contents sit in a consistent register.
 */
export interface CategorySeed {
  category: string
  form: Form
  subjects: string[]
}

export const WIKISOURCE_CATEGORIES: CategorySeed[] = [
  { category: 'Short stories', form: 'story', subjects: ['fiction', 'literature'] },
  { category: 'Ghost stories', form: 'story', subjects: ['fiction', 'folklore'] },
  { category: 'Science fiction short stories', form: 'story', subjects: ['fiction', 'technology'] },
  { category: 'Detective stories', form: 'story', subjects: ['fiction', 'psychology'] },
  { category: 'Fables', form: 'story', subjects: ['fiction', 'folklore', 'myth'] },
  { category: 'Fairy tales', form: 'story', subjects: ['fiction', 'folklore', 'myth'] },
  { category: 'Essays', form: 'essay', subjects: ['essay'] },
  { category: 'Political essays', form: 'essay', subjects: ['politics', 'government'] },
  { category: 'Literary criticism', form: 'essay', subjects: ['literature', 'criticism'] },
  { category: 'Philosophy', form: 'essay', subjects: ['philosophy'] },
  { category: 'Natural history', form: 'essay', subjects: ['nature', 'natural history', 'biology'] },
  { category: 'Science', form: 'essay', subjects: ['science', 'physics', 'biology'] },
  { category: 'Speeches', form: 'essay', subjects: ['politics', 'rhetoric', 'history'] },
  { category: 'History', form: 'essay', subjects: ['history'] },
  { category: 'Archaeology', form: 'essay', subjects: ['archaeology', 'earth'] },
  { category: 'Astronomy', form: 'essay', subjects: ['astronomy', 'physics'] },
  { category: 'Mathematics', form: 'essay', subjects: ['mathematics'] },
  { category: 'Psychology', form: 'essay', subjects: ['psychology', 'mind'] },
  { category: 'Economics', form: 'essay', subjects: ['economics', 'trade'] },
  { category: 'Music', form: 'essay', subjects: ['music', 'art'] },
]
