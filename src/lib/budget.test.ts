import { describe, expect, it } from 'vitest'
import { NIGHT_BUDGET_MINUTES, SLOT_WORDS, minutes, withinBudget, worstCaseNightMinutes } from './budget'
import { FORMS } from './types'

describe('night budget', () => {
  it('cannot exceed half an hour even when every slot runs long', () => {
    expect(worstCaseNightMinutes()).toBeLessThanOrEqual(NIGHT_BUDGET_MINUTES)
  })

  it('leaves a night worth sitting down for at the short end', () => {
    const shortest = minutes(FORMS.reduce((total, form) => total + SLOT_WORDS[form][0], 0))
    expect(shortest).toBeGreaterThanOrEqual(7)
  })

  it('keeps the story slot in Bradbury’s own range', () => {
    const [min, max] = SLOT_WORDS.story
    expect(minutes(min)).toBeGreaterThanOrEqual(4)
    expect(minutes(max)).toBeLessThanOrEqual(15)
  })

  it('accepts a piece inside its slot and rejects one outside', () => {
    expect(withinBudget('essay', 2000)).toBe(true)
    expect(withinBudget('essay', 10700)).toBe(false) // Self-Reliance, 54 minutes
    expect(withinBudget('poem', 144)).toBe(true)
    expect(withinBudget('story', 300)).toBe(false)
  })

  it('bounds every slot, with a minimum below its maximum', () => {
    for (const form of FORMS) {
      const [min, max] = SLOT_WORDS[form]
      expect(min).toBeGreaterThan(0)
      expect(max).toBeGreaterThan(min)
    }
  })
})
