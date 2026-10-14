import type { EnergyLevel, RestLevel, Mood } from './mood-engine'

export interface BehaviorParams {
  walkFrequencyMs: number
  walkSpeedPx: number
  walkRadius: number
  fidgetEnabled: boolean
  fidgetIntervalMs: number
  fidgetRadiusPx: number
}

const SPEED: Record<EnergyLevel, number> = {
  very_low: 25, low: 45, medium: 90, high: 130, very_high: 160,
}

const FREQ: Record<EnergyLevel, number> = {
  very_low: 50_000, low: 30_000, medium: 10_000, high: 5_000, very_high: 3_000,
}

const RADIUS: Record<EnergyLevel, number> = {
  very_low: 80, low: 150, medium: 280, high: 380, very_high: 450,
}

const FIDGET: Record<RestLevel, { enabled: boolean; interval: number; radius: number }> = {
  still:    { enabled: false, interval: 0,      radius: 0  },
  slow:     { enabled: false, interval: 0,      radius: 0  },
  normal:   { enabled: true,  interval: 8_000,  radius: 6  },
  active:   { enabled: true,  interval: 4_000,  radius: 10 },
  restless: { enabled: true,  interval: 2_000,  radius: 15 },
}

export function moodToParams(mood: Mood): BehaviorParams {
  const f = FIDGET[mood.restlessness]
  return {
    walkFrequencyMs: FREQ[mood.energy],
    walkSpeedPx:     SPEED[mood.energy],
    walkRadius:      RADIUS[mood.energy],
    fidgetEnabled:   f.enabled,
    fidgetIntervalMs: f.interval,
    fidgetRadiusPx:  f.radius,
  }
}
