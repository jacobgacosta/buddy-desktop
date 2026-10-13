import { useRive, Layout, Fit, Alignment } from '@rive-app/react-canvas'
import { useEffect, useRef } from 'react'
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

export function RiveCharacter({ character, state, size, onStateComplete }: Props) {
  const anims = loadSavedAnims(character)
  const available = character.availableAnims ?? []
  const prevAnimRef = useRef<string>('')

  const resolve = (name: string): string => {
    if (!available.length) return name
    return [name, `${name}9`, `${name}9x`, `${name}3609`].find(n => available.includes(n)) ?? name
  }

  const { RiveComponent, rive } = useRive({
    src: character.riveFile ?? '',
    animations: resolve(anims.idle),
    autoplay: true,
    layout: new Layout({ fit: Fit.Contain, alignment: Alignment.Center }),
  })

  useEffect(() => {
    if (!rive) return
    // stop any state machines that auto-started so direct animations take over
    rive.stateMachineNames?.forEach(sm => { try { rive.stop(sm) } catch {} })
    const next = resolve(anims[state])
    prevAnimRef.current = next
    rive.play(next)

    if (state === 'react_happy' && onStateComplete) {
      const t = setTimeout(onStateComplete, 1200)
      return () => clearTimeout(t)
    }
  }, [state, rive])

  return (
    <div style={{ width: size, height: size, flexShrink: 0 }}>
      <RiveComponent style={{ width: size, height: size, display: 'block' }} />
    </div>
  )
}
