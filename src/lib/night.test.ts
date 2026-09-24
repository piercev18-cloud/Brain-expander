import { describe, expect, it } from 'vitest'
import {
  addDays, daysBetween, formatCountdown, msUntilRollover,
  nightIndexFor, nightKey, wallParts, zonedInstant,
} from './night'

const TZ = 'America/New_York'
const ROLLOVER = 18

describe('night boundary', () => {
  it('treats 11pm and 1am as the same night', () => {
    const evening = zonedInstant('2026-09-22', 23, TZ)
    const afterMidnight = zonedInstant('2026-09-23', 1, TZ)
    expect(nightKey(evening, TZ, ROLLOVER)).toBe('2026-09-22')
    expect(nightKey(afterMidnight, TZ, ROLLOVER)).toBe('2026-09-22')
  })

  it('rolls over exactly at 6pm, not a minute before', () => {
    const before = new Date(zonedInstant('2026-09-23', ROLLOVER, TZ).getTime() - 60_000)
    const at = zonedInstant('2026-09-23', ROLLOVER, TZ)
    expect(nightKey(before, TZ, ROLLOVER)).toBe('2026-09-22')
    expect(nightKey(at, TZ, ROLLOVER)).toBe('2026-09-23')
  })

  it('uses the named zone, not the device offset', () => {
    // 22:00 UTC on 2026-01-15 is 17:00 EST — still the previous night.
    const instant = new Date('2026-01-15T22:00:00Z')
    expect(wallParts(instant, TZ).hour).toBe(17)
    expect(nightKey(instant, TZ, ROLLOVER)).toBe('2026-01-14')
  })
})

describe('daylight saving', () => {
  // Spring forward 2026-03-08, fall back 2026-11-01. Both nights straddle a transition.
  it('holds the boundary across a 23-hour night', () => {
    expect(nightKey(new Date('2026-03-08T21:59:00Z'), TZ, ROLLOVER)).toBe('2026-03-07')
    expect(nightKey(new Date('2026-03-08T22:00:00Z'), TZ, ROLLOVER)).toBe('2026-03-08')
  })

  it('holds the boundary across a 25-hour night', () => {
    expect(nightKey(new Date('2026-11-01T22:59:00Z'), TZ, ROLLOVER)).toBe('2026-10-31')
    expect(nightKey(new Date('2026-11-01T23:00:00Z'), TZ, ROLLOVER)).toBe('2026-11-01')
  })

  it('advances the index by exactly one per night across a full year', () => {
    const start = '2026-01-01'
    let key = start
    for (let i = 0; i < 365; i++) {
      // Sample at 8pm, inside the night that opened at 6pm on `key`.
      const sample = zonedInstant(key, 20, TZ)
      expect(nightKey(sample, TZ, ROLLOVER)).toBe(key)
      expect(nightIndexFor(nightKey(sample, TZ, ROLLOVER), start)).toBe(i)
      key = addDays(key, 1)
    }
  })

  it('keeps the countdown inside one night, even on transition days', () => {
    let key = '2026-03-06'
    for (let i = 0; i < 6; i++) {
      for (const hour of [19, 23, 3, 17]) {
        const sample = zonedInstant(key, hour, TZ)
        const ms = msUntilRollover(sample, TZ, ROLLOVER)
        expect(ms).toBeGreaterThan(0)
        expect(ms).toBeLessThanOrEqual(25 * 3600_000)
      }
      key = addDays(key, 1)
    }
  })
})

describe('date arithmetic', () => {
  it('crosses month and year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(daysBetween('2026-01-01', '2026-12-31')).toBe(364)
    expect(daysBetween('2026-12-31', '2026-01-01')).toBe(-364)
  })

  it('formats a countdown', () => {
    expect(formatCountdown(0)).toBe('now')
    expect(formatCountdown(3 * 3600_000 + 25 * 60_000)).toBe('3h 25m')
    expect(formatCountdown(7 * 60_000)).toBe('7m')
  })
})
