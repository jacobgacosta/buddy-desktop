import { describe, it, expect } from 'vitest'
import { classifyInput } from '../sensor-bus'

describe('classifyInput', () => {
  it('returns idle when idleDuration > 2 min', () => {
    expect(classifyInput(200, 150_000)).toBe('idle')
  })
  it('returns heavy when keyRate > 60 and not idle', () => {
    expect(classifyInput(80, 0)).toBe('heavy')
  })
  it('returns light for moderate activity', () => {
    expect(classifyInput(20, 30_000)).toBe('light')
  })
  it('idle takes priority over high key rate', () => {
    expect(classifyInput(200, 130_000)).toBe('idle')
  })
})
