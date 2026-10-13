import type { AvatarState, CharacterManifest } from '@buddy/types'

export const STATE_LABELS: Record<AvatarState, string> = {
  idle:        'En reposo',
  walk:        'Caminando',
  talk:        'Hablando',
  think:       'Pensando',
  react_happy: 'Reacción',
  sleep:       'Durmiendo',
}

export const ALL_STATES: AvatarState[] = ['idle', 'walk', 'talk', 'think', 'react_happy', 'sleep']

function key(id: string) { return `buddy-anims-${id}` }

export function loadAnimConfig(character: CharacterManifest): Record<AvatarState, string> {
  const defaults = { idle: 'Idle', walk: 'Idle', talk: 'Idle', think: 'Idle', react_happy: 'Idle', sleep: 'Idle' }
  const base = { ...defaults, ...character.riveAnims } as Record<AvatarState, string>
  try {
    const raw = localStorage.getItem(key(character.id))
    if (raw) return { ...base, ...JSON.parse(raw) }
  } catch {}
  return base
}

export function saveAnimConfig(id: string, config: Record<AvatarState, string>) {
  try { localStorage.setItem(key(id), JSON.stringify(config)) } catch {}
}
