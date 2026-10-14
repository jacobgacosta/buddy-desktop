import { describe, it, expect } from 'vitest'
import { moodToParams } from '../behavior-engine'
import { fallbackMood } from '../mood-engine'

const playfulMood = () => ({ ...fallbackMood(16), name: 'playful' as const, energy: 'high' as const, restlessness: 'active' as const })
const focusedMood = () => ({ ...fallbackMood(10), name: 'focused' as const, energy: 'very_low' as const, restlessness: 'still' as const })

describe('moodToParams', () => {
  it('playful has higher speed than focused', () => {
    expect(moodToParams(playfulMood()).walkSpeedPx).toBeGreaterThan(
      moodToParams(focusedMood()).walkSpeedPx
    )
  })
  it('playful has shorter walk frequency than focused', () => {
    expect(moodToParams(playfulMood()).walkFrequencyMs).toBeLessThan(
      moodToParams(focusedMood()).walkFrequencyMs
    )
  })
  it('playful has larger walk radius than focused', () => {
    expect(moodToParams(playfulMood()).walkRadius).toBeGreaterThan(
      moodToParams(focusedMood()).walkRadius
    )
  })
  it('playful enables fidgets', () => {
    expect(moodToParams(playfulMood()).fidgetEnabled).toBe(true)
  })
  it('focused disables fidgets', () => {
    expect(moodToParams(focusedMood()).fidgetEnabled).toBe(false)
  })
  it('all fields are positive numbers', () => {
    const p = moodToParams(playfulMood())
    expect(p.walkFrequencyMs).toBeGreaterThan(0)
    expect(p.walkSpeedPx).toBeGreaterThan(0)
    expect(p.walkRadius).toBeGreaterThan(0)
  })
})
