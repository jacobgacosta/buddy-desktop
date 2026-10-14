import type { CharacterManifest, VoiceCommand } from '@buddy/types'

const sharedCommands: VoiceCommand[] = [
  {
    triggers: ['duerme', 'a dormir', 'échate'],
    action: 'sleep',
    responses: ['Buenas noches... 😴', 'Qué sueño tengo...', 'Zzz...'],
  },
  {
    triggers: ['despierta', 'levántate', 'arriba', 'ya levántate'],
    action: 'wakeUp',
    responses: ['¡Ya estoy aquí!', '¿Qué pasó?', '¡Buenos días!'],
  },
  {
    triggers: ['camina', 'muévete', 'anda'],
    action: 'walk',
    responses: ['¡Vamos!', 'Me muevo...', 'Buenas piernas tengo.'],
  },
]

export const CHARACTERS: CharacterManifest[] = [
  {
    id: 'ai-orb',
    name: 'Orb',
    type: 'rive',
    personality: 'Eres Orb, un asistente AI amigable y curioso. Responde en español, máximo 2-3 oraciones. Solo texto plano, sin emojis.',
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
    wakeWord: 'orb',
    commands: sharedCommands,
  },
  {
    id: 'joy',
    name: 'Joy',
    type: 'rive',
    personality: 'Eres Joy, un companion alegre y expresivo. Responde en español, máximo 2-3 oraciones. Solo texto plano, sin emojis.',
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
    wakeWord: 'joy',
    commands: sharedCommands,
  },
  {
    id: 'aurora',
    name: 'Aurora',
    type: 'canvas',
    personality: 'Eres Aurora, una IA etérea e intuitiva. Responde en español, máximo 2-3 oraciones. Solo texto plano, sin emojis.',
    palette: ['#00f2fe', '#7b5fff'],
    wakeWord: 'aurora',
    commands: sharedCommands,
  },
]

export function findCharacter(id: string): CharacterManifest {
  return CHARACTERS.find(c => c.id === id) ?? CHARACTERS[0]
}
