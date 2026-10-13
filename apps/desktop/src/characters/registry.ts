import type { CharacterManifest } from '@buddy/types'

export const CHARACTERS: CharacterManifest[] = [
  {
    id: 'ai-orb',
    name: 'Orb',
    type: 'rive',
    personality: 'Eres Orb, un asistente AI amigable y curioso. Responde en español, máximo 2-3 oraciones.',
    palette: ['#6366f1', '#a5b4fc'],
    riveFile: '/assets/ai-orb.riv',
    availableAnims: ['Idle', 'Lading', 'Typing', 'Correct', 'Wrong', 'Jump', 'Reveal'],
    riveAnims: {
      idle:        'Idle',
      walk:        'Jump',
      talk:        'Typing',
      think:       'Lading',
      react_happy: 'Correct',
      sleep:       'Idle',
    },
  },
  {
    id: 'joy',
    name: 'Joy',
    type: 'rive',
    personality: 'Eres Joy, un companion alegre y expresivo. Responde en español, máximo 2-3 oraciones.',
    palette: ['#f59e0b', '#fde68a'],
    riveFile: '/assets/joy.riv',
    availableAnims: ['idle', 'walk', 'sleep', 'relax', 'move', 'jump', 'eat', 'wake'],
    riveAnims: {
      idle:        'idle',
      walk:        'walk',
      talk:        'move',
      think:       'relax',
      react_happy: 'jump',
      sleep:       'sleep',
    },
  },
]

export function findCharacter(id: string): CharacterManifest {
  return CHARACTERS.find(c => c.id === id) ?? CHARACTERS[0]
}
