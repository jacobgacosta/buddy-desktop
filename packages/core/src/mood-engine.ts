import type { SensorSnapshot } from './sensor-bus'

export type MoodName    = 'playful' | 'focused' | 'tired' | 'curious' | 'calm' | 'sleepy'
export type ZOrder      = 'top' | 'normal' | 'behind'
export type EnergyLevel = 'very_low' | 'low' | 'medium' | 'high' | 'very_high'
export type RestLevel   = 'still' | 'slow' | 'normal' | 'active' | 'restless'

export interface Mood {
  name: MoodName
  energy: EnergyLevel
  restlessness: RestLevel
  zOrder: ZOrder
  expiresAt: number
}

export type MoodTrigger =
  | 'user_went_idle'
  | 'user_returned'
  | 'voice_activity'
  | 'time_shift'
  | 'mood_expired'

const MOOD_TTL = 10 * 60 * 1000

interface FallbackRow {
  from: number; to: number
  name: MoodName; energy: EnergyLevel; restlessness: RestLevel; zOrder: ZOrder
}

const FALLBACK_TABLE: FallbackRow[] = [
  { from: 6,  to: 9,  name: 'calm',    energy: 'low',      restlessness: 'slow',    zOrder: 'normal' },
  { from: 9,  to: 13, name: 'curious', energy: 'medium',   restlessness: 'normal',  zOrder: 'top'    },
  { from: 13, to: 15, name: 'tired',   energy: 'very_low', restlessness: 'still',   zOrder: 'normal' },
  { from: 15, to: 19, name: 'playful', energy: 'high',     restlessness: 'active',  zOrder: 'top'    },
  { from: 19, to: 22, name: 'calm',    energy: 'medium',   restlessness: 'slow',    zOrder: 'normal' },
  { from: 22, to: 6,  name: 'sleepy',  energy: 'very_low', restlessness: 'still',   zOrder: 'normal' },
]

export function fallbackMood(hour: number): Mood {
  const row = FALLBACK_TABLE.find(r =>
    r.from < r.to ? hour >= r.from && hour < r.to : hour >= r.from || hour < r.to
  ) ?? FALLBACK_TABLE[0]
  return { name: row.name, energy: row.energy, restlessness: row.restlessness, zOrder: row.zOrder, expiresAt: Date.now() + MOOD_TTL }
}

export function detectTrigger(
  prev: SensorSnapshot | null,
  curr: SensorSnapshot,
  mood: Mood,
): MoodTrigger | null {
  if (mood.expiresAt < Date.now()) return 'mood_expired'
  if (!prev) return null
  if (prev.input.level !== 'idle' && curr.input.idleDuration > 5 * 60_000) return 'user_went_idle'
  if (prev.input.level === 'idle' && curr.input.level === 'heavy') return 'user_returned'
  if (!prev.mic.active && curr.mic.active) return 'voice_activity'
  const BOUNDARIES = [6, 13, 18, 22]
  if (BOUNDARIES.includes(curr.time.hour) && curr.time.hour !== prev.time.hour) return 'time_shift'
  return null
}

export class MoodEngine {
  private current: Mood
  private prev: SensorSnapshot | null = null
  private lastCallAt = 0
  private readonly MIN_INTERVAL = 2 * 60 * 1000

  constructor(private readonly serverUrl: string) {
    this.current = fallbackMood(new Date().getHours())
  }

  get mood(): Mood { return this.current }

  async update(snapshot: SensorSnapshot): Promise<Mood> {
    const trigger = detectTrigger(this.prev, snapshot, this.current)
    this.prev = snapshot
    const now = Date.now()
    if (trigger && now - this.lastCallAt > this.MIN_INTERVAL) {
      this.lastCallAt = now
      try {
        this.current = await this.fetchMood(snapshot)
      } catch {
        this.current = fallbackMood(snapshot.time.hour)
      }
    }
    return this.current
  }

  private async fetchMood(s: SensorSnapshot): Promise<Mood> {
    const resp = await fetch(`${this.serverUrl}/mood`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hour: s.time.hour,
        is_night: s.time.isNight,
        input_level: s.input.level,
        idle_duration_min: Math.round(s.input.idleDuration / 60_000),
        mic_active: s.mic.active,
        current_mood: this.current.name,
      }),
    })
    if (!resp.ok) throw new Error(`/mood ${resp.status}`)
    const raw = await resp.json() as { mood: MoodName; energy: EnergyLevel; restlessness: RestLevel; z_order: ZOrder }
    return {
      name: raw.mood, energy: raw.energy, restlessness: raw.restlessness,
      zOrder: raw.z_order, expiresAt: Date.now() + MOOD_TTL,
    }
  }
}
