import { useEffect, useState } from 'react'
import Lottie from 'lottie-react'
import type { AvatarState, CharacterManifest } from '@buddy/types'

interface Props {
  character: CharacterManifest
  state: AvatarState
  size: number
  onStateComplete?: () => void
}

const FALLBACK_EMOJI: Record<AvatarState, string> = {
  idle: '🦊', walk: '🦊', talk: '🦊', think: '🤔', react_happy: '🥰', sleep: '😴',
}

const LOOPING_STATES: AvatarState[] = ['idle', 'walk', 'talk', 'think', 'sleep']

export function LottieCanvas({ character, state, size, onStateComplete }: Props) {
  const [clipData, setClipData] = useState<unknown>(null)
  const [loadError, setLoadError] = useState(false)

  const resolveClipUrl = (s: AvatarState): string | undefined =>
    character.clips?.[s] ?? character.clips?.['idle']

  useEffect(() => {
    const url = resolveClipUrl(state)
    if (!url) { setLoadError(true); return }
    setLoadError(false)
    setClipData(null)
    fetch(url)
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`${r.status}`)))
      .then(data => setClipData(data))
      .catch(() => {
        // try idle fallback
        const idleUrl = character.clips?.['idle']
        if (idleUrl && idleUrl !== url) {
          fetch(idleUrl)
            .then(r => r.json())
            .then(data => setClipData(data))
            .catch(() => setLoadError(true))
        } else {
          setLoadError(true)
        }
      })
  }, [state, character.clips])

  if (loadError || !character.clips) {
    return (
      <div style={{
        width: size, height: size,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.75, userSelect: 'none',
      }}>
        {FALLBACK_EMOJI[state]}
      </div>
    )
  }

  if (!clipData) return <div style={{ width: size, height: size }} />

  return (
    <Lottie
      animationData={clipData}
      loop={LOOPING_STATES.includes(state)}
      onComplete={state === 'react_happy' ? onStateComplete : undefined}
      style={{ width: size, height: size }}
    />
  )
}
