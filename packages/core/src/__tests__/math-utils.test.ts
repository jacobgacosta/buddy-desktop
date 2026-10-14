import { describe, it, expect } from 'vitest'
import { gaussian, smoothstep } from '../math-utils'

describe('smoothstep', () => {
  it('returns 0 at t=0', () => expect(smoothstep(0)).toBe(0))
  it('returns 1 at t=1', () => expect(smoothstep(1)).toBe(1))
  it('returns 0.5 at t=0.5', () => expect(smoothstep(0.5)).toBe(0.5))
  it('is monotonically increasing', () => {
    expect(smoothstep(0.3)).toBeLessThan(smoothstep(0.6))
  })
  it('clamps values below 0', () => expect(smoothstep(-1)).toBe(0))
  it('clamps values above 1', () => expect(smoothstep(2)).toBe(1))
})

describe('gaussian', () => {
  it('returns a number near the mean over many samples', () => {
    const samples = Array.from({ length: 1000 }, () => gaussian(100, 10))
    const avg = samples.reduce((a, b) => a + b, 0) / samples.length
    expect(avg).toBeGreaterThan(85)
    expect(avg).toBeLessThan(115)
  })
  it('never returns below floor (20% of mean)', () => {
    for (let i = 0; i < 500; i++) {
      expect(gaussian(100, 40)).toBeGreaterThanOrEqual(20)
    }
  })
})
