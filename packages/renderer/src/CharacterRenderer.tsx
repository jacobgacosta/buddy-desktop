import type { AvatarState, CharacterManifest } from '@buddy/types'
import { SpriteCanvas } from './SpriteCanvas'
import { LottieCanvas } from './LottieCanvas'
import { RiveCharacter } from './characters/RiveCharacter'
import { AuroraCharacter } from './characters/AuroraCharacter'

interface Props {
  character: CharacterManifest
  state: AvatarState
  size: number
  onStateComplete?: () => void
}

export function CharacterRenderer({ character, ...rest }: Props) {
  if (character.type === 'sprite') return <SpriteCanvas character={character} {...rest} />
  if (character.type === 'rive')   return <RiveCharacter character={character} {...rest} />
  if (character.type === 'canvas') return <AuroraCharacter state={rest.state} size={rest.size} />
  return <LottieCanvas character={character} {...rest} />
}
