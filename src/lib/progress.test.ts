import { describe, expect, it } from 'vitest'
import {
  emptyProgress, isComplete, merge, recordDeal, setNote, stats, toggleDone, toggleSaved,
} from './progress'
import { FORMS, type Progress } from './types'
import { addDays } from './night'

const START = '2026-09-22'

function finish(progress: Progress, key: string): Progress {
  let next = recordDeal(progress, key, { story: `s-${key}`, poem: `p-${key}`, essay: `e-${key}` })
  for (const form of FORMS) next = toggleDone(next, key, form)
  return next
}

describe('counting', () => {
  it('increments only when all three are checked', () => {
    let p = emptyProgress(START, 'salt')
    p = recordDeal(p, START, { story: 's', poem: 'p', essay: 'e' })
    p = toggleDone(p, START, 'story')
    p = toggleDone(p, START, 'poem')
    expect(stats(p, START).nightsCompleted).toBe(0)
    p = toggleDone(p, START, 'essay')
    expect(stats(p, START).nightsCompleted).toBe(1)
    expect(isComplete(p.nights[START])).toBe(true)
  })

  it('unchecking withdraws the night and clears its completion time', () => {
    let p = finish(emptyProgress(START, 'salt'), START)
    expect(p.nights[START].completedAt).toBeTruthy()
    p = toggleDone(p, START, 'poem')
    expect(stats(p, START).nightsCompleted).toBe(0)
    expect(p.nights[START].completedAt).toBeUndefined()
  })

  it('counts cumulatively across a gap without resetting', () => {
    let p = emptyProgress(START, 'salt')
    for (const key of [START, addDays(START, 1), addDays(START, 9)]) p = finish(p, key)
    expect(stats(p, addDays(START, 9)).nightsCompleted).toBe(3)
  })
})

describe('streaks', () => {
  it('breaks on a missed night while the total stands', () => {
    let p = emptyProgress(START, 'salt')
    for (let i = 0; i < 5; i++) p = finish(p, addDays(START, i))
    for (let i = 6; i < 9; i++) p = finish(p, addDays(START, i))
    const s = stats(p, addDays(START, 8))
    expect(s.nightsCompleted).toBe(8)
    expect(s.currentStreak).toBe(3)
    expect(s.longestStreak).toBe(5)
  })

  it('survives a night that is open but not yet finished', () => {
    let p = emptyProgress(START, 'salt')
    for (let i = 0; i < 4; i++) p = finish(p, addDays(START, i))
    // Tonight is night 4 and nothing is checked off yet.
    expect(stats(p, addDays(START, 4)).currentStreak).toBe(4)
    // By night 5 the gap is real.
    expect(stats(p, addDays(START, 5)).currentStreak).toBe(0)
  })
})

describe('saving', () => {
  it('toggles and carries a note', () => {
    let p = toggleSaved(emptyProgress(START, 'salt'), 'poem-1')
    expect(p.saved.map((s) => s.id)).toEqual(['poem-1'])
    p = setNote(p, 'poem-1', 'the last stanza')
    expect(p.saved[0].note).toBe('the last stanza')
    p = toggleSaved(p, 'poem-1')
    expect(p.saved).toEqual([])
  })
})

describe('merge', () => {
  it('loses no check-off when two devices diverge', () => {
    const base = recordDeal(emptyProgress(START, 'salt'), START, { story: 's', poem: 'p', essay: 'e' })
    const phone = toggleDone(toggleDone(base, START, 'story'), START, 'poem')
    const laptop = toggleDone(base, START, 'essay')
    const merged = merge(phone, laptop)
    expect(merged.nights[START].done.sort()).toEqual(['essay', 'poem', 'story'])
    expect(stats(merged, START).nightsCompleted).toBe(1)
  })

  it('is order independent', () => {
    let a = emptyProgress(START, 'salt')
    let b = { ...a }
    a = finish(a, START)
    b = finish(b, addDays(START, 1))
    b = toggleSaved(b, 'poem-9')
    const ab = merge(a, b)
    const ba = merge(b, a)
    expect({ ...ab, updatedAt: '' }).toEqual({ ...ba, updatedAt: '' })
  })

  it('unions distinct nights from both sides', () => {
    let a = emptyProgress(START, 'salt')
    let b = { ...a }
    for (let i = 0; i < 3; i++) a = finish(a, addDays(START, i))
    for (let i = 3; i < 7; i++) b = finish(b, addDays(START, i))
    expect(stats(merge(a, b), addDays(START, 6)).nightsCompleted).toBe(7)
  })

  it('unions saved items, keeping the earliest timestamp and never erasing a note', () => {
    const a: Progress = {
      ...emptyProgress(START, 'salt'),
      saved: [{ id: 'x', at: '2026-01-02T00:00:00Z' }],
      updatedAt: '2026-01-02T00:00:00Z',
    }
    const b: Progress = {
      ...emptyProgress(START, 'salt'),
      saved: [{ id: 'x', at: '2026-01-01T00:00:00Z', note: 'kept' }, { id: 'y', at: '2026-01-03T00:00:00Z' }],
      updatedAt: '2026-01-03T00:00:00Z',
    }
    const merged = merge(a, b)
    expect(merged.saved.find((s) => s.id === 'x')).toEqual({ id: 'x', at: '2026-01-01T00:00:00Z', note: 'kept' })
    expect(merged.saved.map((s) => s.id).sort()).toEqual(['x', 'y'])
  })

  it('keeps startedOn and salt from the earlier document so the program never re-rolls', () => {
    const a = { ...emptyProgress(START, 'salt-a'), updatedAt: '2026-01-01T00:00:00Z' }
    const b = { ...emptyProgress('2026-10-01', 'salt-b'), updatedAt: '2026-02-01T00:00:00Z' }
    const merged = merge(a, b)
    expect(merged.salt).toBe('salt-a')
    expect(merged.startedOn).toBe(START)
  })

  it('recomputes the count rather than trusting either side', () => {
    const a = { ...finish(emptyProgress(START, 'salt'), START), derived: { nightsCompleted: 999, currentStreak: 999, longestStreak: 999 } }
    const b = emptyProgress(START, 'salt')
    expect(stats(merge(a, b), START).nightsCompleted).toBe(1)
  })
})
