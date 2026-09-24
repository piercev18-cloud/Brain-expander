import { describe, expect, it } from 'vitest'
import {
  CORPUS_BOUNDS, estimateMinutes, estimateNight, formatMinutes,
  heaviestSlot, overTarget, withinCorpus,
} from './curation'
import type { IndexEntry } from './types'

function entry(form: IndexEntry['form'], words: number, id = form): IndexEntry {
  return { id, form, title: id, author: 'Anon', fields: ['literature'], words, mode: 'full', source: 't' }
}

describe('estimates', () => {
  it('reads verse more slowly than prose', () => {
    expect(estimateMinutes('poem', 440)).toBeGreaterThan(estimateMinutes('essay', 440))
  })

  it('never claims a time for an unknown length', () => {
    expect(estimateMinutes('essay', 0)).toBe(0)
  })

  it('totals only the pieces still unread', () => {
    const night = { story: entry('story', 2200), poem: entry('poem', 180), essay: entry('essay', 4400) }
    const all = estimateNight(night)
    expect(all.total).toBe(10 + 2 + 20)
    expect(all.remaining).toBe(all.total)

    const partly = estimateNight(night, ['essay'])
    expect(partly.total).toBe(32)
    expect(partly.remaining).toBe(12)
  })

  it('reports unknown lengths instead of folding them into the total', () => {
    const night = { story: entry('story', 2200), essay: entry('essay', 0) }
    const result = estimateNight(night)
    expect(result.unknown).toEqual(['essay'])
    expect(result.total).toBe(10)
  })
})

describe('what to offer a swap on', () => {
  it('picks the longest unread piece, because trimming the poem saves nothing', () => {
    const night = { story: entry('story', 2200), poem: entry('poem', 180), essay: entry('essay', 11000) }
    expect(heaviestSlot(estimateNight(night))).toBe('essay')
  })

  it('ignores what is already read', () => {
    const night = { story: entry('story', 2200), poem: entry('poem', 180), essay: entry('essay', 11000) }
    expect(heaviestSlot(estimateNight(night, ['essay']), ['essay'])).toBe('story')
  })

  it('offers nothing when the whole night is done', () => {
    const night = { story: entry('story', 2200) }
    expect(heaviestSlot(estimateNight(night, ['story']), ['story'])).toBeNull()
  })
})

describe('the target is soft', () => {
  const night = { story: entry('story', 2200), poem: entry('poem', 180), essay: entry('essay', 11000) }

  it('flags a night that runs past the target', () => {
    expect(overTarget(estimateNight(night), 30)).toBe(true)
    expect(overTarget(estimateNight(night), 90)).toBe(false)
  })

  it('never flags anything when there is no target', () => {
    expect(overTarget(estimateNight(night), null)).toBe(false)
  })

  it('keeps long work in the corpus: only books and fragments are excluded', () => {
    expect(withinCorpus('essay', 11000)).toBe(true)  // Self-Reliance, 50 minutes
    expect(withinCorpus('story', 8300)).toBe(true)   // The Open Boat, 38 minutes
    expect(withinCorpus('essay', CORPUS_BOUNDS.essay[1] + 1)).toBe(false)
    expect(withinCorpus('story', 12)).toBe(false)
  })
})

describe('formatting', () => {
  it('reads as a person would say it', () => {
    expect(formatMinutes(9)).toBe('9 min')
    expect(formatMinutes(60)).toBe('1 hr')
    expect(formatMinutes(75)).toBe('1 hr 15 min')
  })
})
