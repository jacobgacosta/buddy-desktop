import { describe, it, expect } from 'vitest'
import { fallbackMood, detectTrigger } from '../mood-engine'
import type { SensorSnapshot } from '../sensor-bus'

const snap = (overrides: {
  inputLevel?: 'idle' | 'light' | 'heavy'
  idleDuration?: number
  micActive?: boolean
  hour?: number
} = {}): SensorSnapshot => ({
  timestamp: Date.now(),
  mic: { active: overrides.micActive ?? false, level: 0 },
  input: {
    keyRate: 0, mouseDistance: 0,
    level: overrides.inputLevel ?? 'light',
    idleDuration: overrides.idleDuration ?? 0,
  },
  time: { hour: overrides.hour ?? 10, isNight: false, isWeekend: false },
})

describe('fallbackMood', () => {
  it('playful at 16h', () => expect(fallbackMood(16).name).toBe('playful'))
  it('sleepy at 23h', () => expect(fallbackMood(23).name).toBe('sleepy'))
  it('sleepy at 3h', ()  => expect(fallbackMood(3).name).toBe('sleepy'))
  it('tired at 14h',  () => expect(fallbackMood(14).name).toBe('tired'))
  it('curious at 10h', () => expect(fallbackMood(10).name).toBe('curious'))
  it('calm at 7h (morning)', () => expect(fallbackMood(7).name).toBe('calm'))
  it('calm at 20h (evening)', () => expect(fallbackMood(20).name).toBe('calm'))
  it('expiresAt is in the future', () => {
    expect(fallbackMood(10).expiresAt).toBeGreaterThan(Date.now())
  })
})

describe('detectTrigger', () => {
  const activeMood = { ...fallbackMood(10), expiresAt: Date.now() + 999_999 }
  const expiredMood = { ...fallbackMood(10), expiresAt: Date.now() - 1 }

  it('mood_expired when TTL passed', () => {
    expect(detectTrigger(null, snap(), expiredMood)).toBe('mood_expired')
  })
  it('null when prev is null and mood is active', () => {
    expect(detectTrigger(null, snap(), activeMood)).toBeNull()
  })
  it('user_went_idle when idle > 5 min', () => {
    const prev = snap({ inputLevel: 'heavy', idleDuration: 0 })
    const curr = snap({ inputLevel: 'light', idleDuration: 310_000 })
    expect(detectTrigger(prev, curr, activeMood)).toBe('user_went_idle')
  })
  it('user_returned when idle→heavy', () => {
    const prev = snap({ inputLevel: 'idle', idleDuration: 600_000 })
    const curr = snap({ inputLevel: 'heavy', idleDuration: 0 })
    expect(detectTrigger(prev, curr, activeMood)).toBe('user_returned')
  })
  it('voice_activity when mic turns on', () => {
    const prev = snap({ micActive: false })
    const curr = snap({ micActive: true })
    expect(detectTrigger(prev, curr, activeMood)).toBe('voice_activity')
  })
  it('null when nothing significant changed', () => {
    const prev = snap({ inputLevel: 'light', idleDuration: 1000 })
    const curr = snap({ inputLevel: 'light', idleDuration: 5000 })
    expect(detectTrigger(prev, curr, activeMood)).toBeNull()
  })
  it('time_shift when hour crosses a boundary', () => {
    const prev = snap({ hour: 12 })
    const curr = snap({ hour: 13 })
    expect(detectTrigger(prev, curr, activeMood)).toBe('time_shift')
  })
})
