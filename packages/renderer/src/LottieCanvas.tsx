import type { AvatarState, CharacterManifest } from '@buddy/types'
import { KittiCharacter } from './characters/KittiCharacter'
import { FoxyCharacter } from './characters/FoxyCharacter'

interface Props {
  character: CharacterManifest
  state: AvatarState
  size: number
  onStateComplete?: () => void
}

export function LottieCanvas({ character, state, size, onStateComplete }: Props) {
  const props = { state, size, palette: character.palette, onStateComplete }

  if (character.species === 'cat') return <KittiCharacter {...props} />
  if (character.species === 'fox') return <FoxyCharacter {...props} />

  // Generic fallback: animated circle
  return (
    <div style={{
      width: size, height: size,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        width: size * 0.45, height: size * 0.45,
        borderRadius: '50%',
        background: `radial-gradient(circle at 35% 35%, ${character.palette[1]}, ${character.palette[0]})`,
      }} />
    </div>
  )
}
