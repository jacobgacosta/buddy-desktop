import { gaussian } from './math-utils'
import { LlmClient } from './llm-client'
import type { SensorSnapshot } from './sensor-bus'
import type { Mood } from './mood-engine'

const SILENCE_SLEEP_S = 300        // 5 min silencio → sleep
const REACTION_MEAN_MS = 3 * 60 * 1000   // ~3 min entre reacciones
const REACTION_STD_MS  = 60 * 1000       // ±1 min de variación
const REACTION_PROB    = 0.40            // 40% de probabilidad al disparar

function buildContext(snapshot: SensorSnapshot, mood: Mood): string {
  const h = snapshot.time.hour
  const timeCtx = h < 6   ? 'de madrugada'
                : h < 12  ? 'en la mañana'
                : h < 18  ? 'en la tarde'
                : h < 22  ? 'en la noche'
                :            'muy noche'

  const activityCtx = snapshot.input.level === 'heavy'
    ? `el usuario está tecleando intensamente (${Math.round(snapshot.input.keyRate)} teclas/min)`
    : snapshot.input.level === 'light'
    ? 'el usuario está trabajando tranquilo'
    : 'el usuario está idle, sin hacer nada'

  const ambientCtx = snapshot.ambientType === 'music'
    ? `hay música sonando (${Math.round(snapshot.ambientDurationS / 60)} min)`
    : snapshot.ambientType === 'speech'
    ? 'hay voces o conversación de fondo'
    : 'está en silencio'

  const extras: string[] = []
  if (snapshot.time.isNight)   extras.push('es de noche')
  if (snapshot.time.isWeekend) extras.push('es fin de semana')

  return [
    `Es ${timeCtx}.`,
    activityCtx + '.',
    `El ambiente: ${ambientCtx}.`,
    extras.length ? extras.join(', ') + '.' : '',
    `Tu mood actual: ${mood.name}.`,
  ].filter(Boolean).join(' ')
}

export class AmbientEngine {
  private nextCheckAt: number
  private lastReactionAt = 0
  private llm: LlmClient

  constructor(private serverUrl: string) {
    this.llm = new LlmClient(serverUrl)
    // first reaction between 1-4 minutes after start
    this.nextCheckAt = Date.now() + gaussian(2 * 60 * 1000, 60 * 1000)
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

    if (Date.now() < this.nextCheckAt) return null

    this.nextCheckAt = Date.now() + gaussian(REACTION_MEAN_MS, REACTION_STD_MS)

    if (Math.random() >= REACTION_PROB) return null

    // don't spam — at least 90s between reactions
    if (Date.now() - this.lastReactionAt < 90_000) return null

    this.lastReactionAt = Date.now()
    return this.fetchAmbientReaction(snapshot, mood)
  }

  private async fetchAmbientReaction(snapshot: SensorSnapshot, mood: Mood): Promise<string | null> {
    const context = buildContext(snapshot, mood)
    const personality = `Eres un companion de escritorio vivo y espontáneo. ${context} Reacciona con UNA frase natural en español (máx 10 palabras). Varía entre comentarios sobre el trabajo, el ambiente, el tiempo, o simplemente expresar tu estado de ánimo. Sé directo, sin preguntas. Solo texto plano, sin emojis.`
    try {
      const { content } = await this.llm.chat({
        message: 'reacción espontánea',
        avatarId: 'ambient',
        personality,
        history: [],
      })
      return content?.trim() || null
    } catch { return null }
  }
}
