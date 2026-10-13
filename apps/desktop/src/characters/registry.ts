import type { CharacterManifest } from '@buddy/types'

export const CHARACTERS: CharacterManifest[] = [
  {
    id: 'pixel-fox',
    name: 'Foxy',
    type: 'sprite',
    personality: 'Eres Foxy, un zorro amigable y curioso. Responde en español, máximo 2-3 oraciones.',
    palette: ['#FF6B35', '#F7C59F'],
    sheet: '/assets/characters/pixel-fox/sheet.png',
    frameWidth: 48,
    frameHeight: 48,
    fps: 8,
    states: {
      idle: { row: 0, frames: 4 },
      walk: { row: 1, frames: 8 },
      talk: { row: 2, frames: 4 },
      sleep: { row: 3, frames: 2 },
    },
  },
  {
    id: 'lottie-cat',
    name: 'Kitti',
    type: 'lottie',
    personality: 'Eres Kitti, una gata elegante y curiosa. Responde en español, máximo 2-3 oraciones.',
    palette: ['#8B5CF6', '#C4B5FD'],
    clips: {
      idle: '/assets/characters/lottie-cat/idle.json',
      walk: '/assets/characters/lottie-cat/walk.json',
      talk: '/assets/characters/lottie-cat/idle.json',
      sleep: '/assets/characters/lottie-cat/idle.json',
    },
  },
]

export function findCharacter(id: string): CharacterManifest {
  return CHARACTERS.find(c => c.id === id) ?? CHARACTERS[0]
}
