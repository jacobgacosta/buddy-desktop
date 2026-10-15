import { useRive, Layout, Fit, Alignment } from '@rive-app/react-canvas'
import { useEffect, useRef, useState } from 'react'
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

function resolveAnim(name: string, available: string[]): string {
  if (!available.length) return name
  return [name, `${name}9`, `${name}9x`, `${name}3609`].find(n => available.includes(n)) ?? name
}

function RiveAnim({ src, anim, size }: { src: string; anim: string; size: number }) {
  const { RiveComponent } = useRive({
    src,
    animations: anim,
    autoplay: true,
    layout: new Layout({ fit: Fit.Contain, alignment: Alignment.Center }),
  })
  return <RiveComponent style={{ width: size, height: size, display: 'block' }} />
}

interface Slot { uid: number; anim: string; opacity: 0 | 1 }

// Two-slot crossfade: while one slot fades out, the other fades in.
// rive.stop()/play() resets canvas to frame 0 — never use it.
// Instead we remount via uid key and let CSS opacity transition do the blend.
export function RiveCharacter({ character, state, size, onStateComplete }: Props) {
  const anims = loadSavedAnims(character)
  const available = character.availableAnims ?? []
  const resolve = (s: AvatarState) => resolveAnim(anims[s], available)

  const uidRef = useRef(2)
  const frontRef = useRef<0 | 1>(0)
  const currentAnimRef = useRef(resolve(state))

  const [slots, setSlots] = useState<[Slot, Slot]>([
    { uid: 0, anim: resolve(state), opacity: 1 },
    { uid: 1, anim: resolve(state), opacity: 0 },
  ])

  useEffect(() => {
    const newAnim = resolve(state)
    if (newAnim === currentAnimRef.current) return
    currentAnimRef.current = newAnim

    const front = frontRef.current
    const back = (1 - front) as 0 | 1
    const newUid = uidRef.current++

    // Mount new anim in back slot (invisible)
    setSlots(prev => {
      const next: [Slot, Slot] = [{ ...prev[0] }, { ...prev[1] }]
      next[back] = { uid: newUid, anim: newAnim, opacity: 0 }
      return next
    })

    // Double RAF: first ensures React committed the new mount,
    // second ensures browser painted so CSS transition triggers correctly.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      frontRef.current = back
      setSlots(prev => {
        const next: [Slot, Slot] = [{ ...prev[0] }, { ...prev[1] }]
        next[back] = { ...next[back], opacity: 1 }
        next[front] = { ...next[front], opacity: 0 }
        return next
      })
    }))

    if (state === 'react_happy' && onStateComplete) {
      const t = setTimeout(onStateComplete, 1200)
      return () => clearTimeout(t)
    }
  }, [state])

  return (
    <div style={{ width: size, height: size, position: 'relative', flexShrink: 0 }}>
      {slots.map(slot => (
        <div
          key={slot.uid}
          style={{
            position: 'absolute', top: 0, left: 0,
            opacity: slot.opacity,
            transition: 'opacity 350ms ease',
            pointerEvents: 'none',
          }}
        >
          <RiveAnim src={character.riveFile ?? ''} anim={slot.anim} size={size} />
        </div>
      ))}
    </div>
  )
}
