import type { AvatarState, CharacterManifest } from '@buddy/types'
import { SpriteCanvas } from './SpriteCanvas'
import { LottieCanvas } from './LottieCanvas'

interface Props {
  character: CharacterManifest
  state: AvatarState
  size: number
  onStateComplete?: () => void
}

export function CharacterRenderer({ character, ...rest }: Props) {
  if (character.type === 'sprite') return <SpriteCanvas character={character} {...rest} />
  return <LottieCanvas character={character} {...rest} />
}
