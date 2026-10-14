import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AmbientEngine } from '../ambient-engine'
import type { SensorSnapshot } from '../sensor-bus'
import type { Mood } from '../mood-engine'

const mood: Mood = {
  name: 'calm', energy: 'low', restlessness: 'still',
  zOrder: 'normal', expiresAt: Date.now() + 60_000,
}

const snap = (ambientType: 'silence' | 'speech' | 'music', durationS = 0): SensorSnapshot => ({
  timestamp: Date.now(),
  mic: { active: false, level: 0, deviceName: '' },
  input: { keyRate: 0, mouseDistance: 0, level: 'idle', idleDuration: 0 },
  time: { hour: 10, isNight: false, isWeekend: false },
  ambientType,
  ambientDurationS: durationS,
})

describe('AmbientEngine', () => {
  it('calls onSleep after 5 min of silence', async () => {
    const engine = new AmbientEngine('http://localhost:7788')
    const onSleep = vi.fn()
    await engine.update(snap('silence', 301), mood, onSleep)
    expect(onSleep).toHaveBeenCalledOnce()
  })

  it('does not sleep for short silence', async () => {
    const engine = new AmbientEngine('http://localhost:7788')
    const onSleep = vi.fn()
    await engine.update(snap('silence', 10), mood, onSleep)
    expect(onSleep).not.toHaveBeenCalled()
  })

  it('does not sleep for music', async () => {
    const engine = new AmbientEngine('http://localhost:7788')
    const onSleep = vi.fn()
    await engine.update(snap('music', 600), mood, onSleep)
    expect(onSleep).not.toHaveBeenCalled()
  })

  it('nextCheckAt advances after timer fires with low random', async () => {
    const engine = new AmbientEngine('http://localhost:7788')
    ;(engine as any).nextCheckAt = Date.now() - 1
    const prevNext = (engine as any).nextCheckAt
    vi.spyOn(global.Math, 'random').mockReturnValue(0)  // below AMBIENT_LLM_PROB → no LLM call
    await engine.update(snap('music', 10), mood, vi.fn())
    expect((engine as any).nextCheckAt).toBeGreaterThan(prevNext)
    vi.restoreAllMocks()
  })
})
