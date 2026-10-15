import { useRive, Layout, Fit, Alignment } from '@rive-app/react-canvas'
import { useEffect, useState } from 'react'
import type { AvatarState, CharacterManifest } from '@buddy/types'

interface Props {
  character: CharacterManifest
  state: AvatarState
  size: number
  onStateComplete?: () => void
}

const DEFAULT_ANIMS: Record<AvatarState, string> = {
  idle: 'Idle', walk: 'Idle', talk: 'Idle',
  think: 'Idle', react_happy: 'Idle', sleep: 'Idle',
}

function loadSavedAnims(character: CharacterManifest): Record<AvatarState, string> {
  const base = { ...DEFAULT_ANIMS, ...character.riveAnims } as Record<AvatarState, string>
  try {
    const raw = typeof localStorage !== 'undefined'
      ? localStorage.getItem(`buddy-anims-${character.id}`)
      : null
    if (raw) return { ...base, ...JSON.parse(raw) }
  } catch {}
  return base
}

// One Rive instance per animation — remounts via key when anim changes.
// This is the only reliable way to stop a looping Rive animation in v4.
function RiveAnim({ src, anim, size }: { src: string; anim: string; size: number }) {
  const { RiveComponent } = useRive({
    src,
    animations: anim,
    autoplay: true,
    layout: new Layout({ fit: Fit.Contain, alignment: Alignment.Center }),
  })
  return <RiveComponent style={{ width: size, height: size, display: 'block' }} />
}

export function RiveCharacter({ character, state, size, onStateComplete }: Props) {
  const anims = loadSavedAnims(character)
  const available = character.availableAnims ?? []

  const resolve = (name: string): string => {
    if (!available.length) return name
    return [name, `${name}9`, `${name}9x`, `${name}3609`].find(n => available.includes(n)) ?? name
  }

  const [resolvedAnim, setResolvedAnim] = useState(() => resolve(anims[state]))

  useEffect(() => {
    setResolvedAnim(resolve(anims[state]))
    if (state === 'react_happy' && onStateComplete) {
      const t = setTimeout(onStateComplete, 1200)
      return () => clearTimeout(t)
    }
  }, [state])

  return (
    <div style={{ width: size, height: size, flexShrink: 0 }}>
      <RiveAnim key={resolvedAnim} src={character.riveFile ?? ''} anim={resolvedAnim} size={size} />
    </div>
  )
}
