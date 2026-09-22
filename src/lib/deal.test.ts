import { describe, expect, it } from 'vitest'
import { buildPools, consumedBefore, dealFor, dealNight } from './deal'
import { emptyProgress, isComplete, toggleDone, recordDeal } from './progress'
import { FORMS, type IndexEntry } from './types'
import { addDays } from './night'

function corpus(perForm: number): IndexEntry[] {
  const out: IndexEntry[] = []
  for (const form of FORMS) {
    for (let i = 0; i < perForm; i++) {
      out.push({
        id: `${form}-${String(i).padStart(4, '0')}`,
        form, title: `${form} ${i}`, author: 'Anon',
        fields: ['literature'], words: 1200, mode: 'full', source: 'test',
      })
    }
  }
  return out
}

const START = '2026-09-22'

describe('dealing', () => {
  const pools = buildPools(corpus(1200))

  it('is deterministic for a given night', () => {
    const a = dealNight(41, 'salt', pools, new Set())
    const b = dealNight(41, 'salt', pools, new Set())
    expect(a).toEqual(b)
    expect(FORMS.every((f) => !!a[f])).toBe(true)
  })

  it('gives different nights different pieces', () => {
    const a = dealNight(1, 'salt', pools, new Set())
    const b = dealNight(2, 'salt', pools, new Set())
    expect(a).not.toEqual(b)
  })

  it('gives different salts different programs', () => {
    expect(dealNight(1, 'a', pools, new Set())).not.toEqual(dealNight(1, 'b', pools, new Set()))
  })

  it('draws the right form into each slot', () => {
    const d = dealNight(7, 'salt', pools, new Set())
    for (const form of FORMS) expect(d[form]!.startsWith(form)).toBe(true)
  })

  it('never repeats across a simulated 1000-night run', () => {
    let progress = emptyProgress(START, 'salt')
    let key = START
    const seen = new Set<string>()
    for (let i = 0; i < 1000; i++) {
      const dealt = dealFor(i, progress, pools, key)
      for (const form of FORMS) {
        const id = dealt[form]!
        expect(seen.has(id)).toBe(false)
        seen.add(id)
      }
      progress = recordDeal(progress, key, dealt)
      for (const form of FORMS) progress = toggleDone(progress, key, form)
      expect(isComplete(progress.nights[key])).toBe(true)
      key = addDays(key, 1)
    }
    expect(seen.size).toBe(3000)
  })

  it('returns unfinished pieces to the pool', () => {
    let progress = emptyProgress(START, 'salt')
    const dealt = dealFor(0, progress, pools, START)
    progress = recordDeal(progress, START, dealt)
    progress = toggleDone(progress, START, 'poem')
    const consumed = consumedBefore(progress, 1)
    expect(consumed.has(dealt.poem!)).toBe(true)
    expect(consumed.has(dealt.story!)).toBe(false)
  })

  it('wraps rather than dead-ending on an exhausted pool', () => {
    const tiny = buildPools(corpus(2))
    let progress = emptyProgress(START, 'salt')
    let key = START
    for (let i = 0; i < 5; i++) {
      const dealt = dealFor(i, progress, tiny, key)
      expect(FORMS.every((f) => !!dealt[f])).toBe(true)
      progress = recordDeal(progress, key, dealt)
      for (const form of FORMS) progress = toggleDone(progress, key, form)
      key = addDays(key, 1)
    }
  })

  it('honours a recorded deal over a recomputed one', () => {
    let progress = emptyProgress(START, 'salt')
    const pinned = { story: 'story-0001', poem: 'poem-0002', essay: 'essay-0003' }
    progress = recordDeal(progress, START, pinned)
    // A corpus that no longer contains those ids must not rewrite settled history.
    expect(dealFor(0, progress, buildPools(corpus(5)), START)).toEqual(pinned)
  })

  it('keeps pool order stable when the corpus grows', () => {
    const small = buildPools(corpus(500))
    const grown = buildPools(corpus(1200))
    expect(grown.poem.slice(0, 500)).toEqual(small.poem)
  })
})
