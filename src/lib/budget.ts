import { FORMS, type Form } from './types'

/**
 * A night has to fit in the gap between putting the phone down and falling asleep.
 * Bradbury's own estimate for the story was "ten minutes, fifteen minutes", so the
 * whole night is held under half an hour.
 *
 * This is the single source of truth: the corpus builder gates every source against
 * it, the build fails if anything slips through, and the app reads tonight's total
 * from the same numbers.
 */
export const WORDS_PER_MINUTE = 200

export const NIGHT_BUDGET_MINUTES = 30

/** [minimum, maximum] words per slot. */
export const SLOT_WORDS: Record<Form, [number, number]> = {
  story: [900, 2800],
  poem: [40, 500],
  essay: [700, 2400],
}

export function withinBudget(form: Form, words: number): boolean {
  const [min, max] = SLOT_WORDS[form]
  return words >= min && words <= max
}

export function minutes(words: number): number {
  return words / WORDS_PER_MINUTE
}

/** The longest a night can be if every slot draws its maximum. */
export function worstCaseNightMinutes(): number {
  return minutes(FORMS.reduce((total, form) => total + SLOT_WORDS[form][1], 0))
}
