import { gaussian } from './math-utils'
import type { SensorSnapshot } from './sensor-bus'
import type { Mood } from './mood-engine'

const SILENCE_SLEEP_S = 300
const AMBIENT_LLM_PROB = 0.15
const AMBIENT_LLM_MEAN_MS = 30 * 60 * 1000
const AMBIENT_LLM_STD_MS  = 10 * 60 * 1000

export class AmbientEngine {
  private nextCheckAt: number

  constructor(private serverUrl: string) {
    this.nextCheckAt = Date.now() + gaussian(AMBIENT_LLM_MEAN_MS, AMBIENT_LLM_STD_MS)
  }

  async update(
    snapshot: SensorSnapshot,
    mood: Mood,
    onSleep: () => void,
  ): Promise<string | null> {
    if (snapshot.ambientType === 'silence' && snapshot.ambientDurationS > SILENCE_SLEEP_S) {
      onSleep()
      return null
    }

    if (Date.now() >= this.nextCheckAt) {
      this.nextCheckAt = Date.now() + gaussian(AMBIENT_LLM_MEAN_MS, AMBIENT_LLM_STD_MS)
      if (Math.random() < AMBIENT_LLM_PROB) {
        return this.fetchAmbientReaction(snapshot, mood)
      }
    }

    return null
  }

  private async fetchAmbientReaction(snapshot: SensorSnapshot, mood: Mood): Promise<string | null> {
    const systemPrompt = `Eres un companion de escritorio con mood "${mood.name}". Reacciona espontáneamente al ambiente con UNA frase corta en español (máx 8 palabras). Ambiente: ${snapshot.ambientType} por ${snapshot.ambientDurationS}s. Son las ${snapshot.time.hour}h.`
    try {
      const resp = await fetch(`${this.serverUrl}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `ambiente detectado: ${snapshot.ambientType}`,
          avatarId: 'ambient',
          personality: systemPrompt,
          history: [],
        }),
      })
      if (!resp.ok) return null
      const { content } = await resp.json() as { content: string }
      return content ?? null
    } catch { return null }
  }
}
