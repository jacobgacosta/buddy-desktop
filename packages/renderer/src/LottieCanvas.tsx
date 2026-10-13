import { useEffect, useRef, useState } from 'react'
import lottie from 'lottie-web'
import type { AnimationItem } from 'lottie-web'
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
  const containerRef = useRef<HTMLDivElement>(null)
  const animRef = useRef<AnimationItem | null>(null)
  const [loadError, setLoadError] = useState(false)

  const resolveClipUrl = (s: AvatarState): string | undefined =>
    character.clips?.[s] ?? character.clips?.['idle']

  useEffect(() => {
    if (!containerRef.current) return

    const url = resolveClipUrl(state)
    if (!url || !character.clips) { setLoadError(true); return }

    let cancelled = false

    const loadAnimation = (clipUrl: string) => {
      fetch(clipUrl)
        .then(r => r.ok ? r.json() : Promise.reject(new Error(`${r.status}`)))
        .then(data => {
          if (cancelled || !containerRef.current) return

          // Destroy previous instance before creating new one
          if (animRef.current) {
            animRef.current.destroy()
            animRef.current = null
          }
          // Clear any stale canvas elements lottie-web may have left behind
          containerRef.current.innerHTML = ''

          setLoadError(false)
          animRef.current = lottie.loadAnimation({
            container: containerRef.current,
            animationData: data,
            renderer: 'canvas',
            loop: LOOPING_STATES.includes(state),
            autoplay: true,
          })

          if (state === 'react_happy' && onStateComplete) {
            animRef.current.addEventListener('complete', onStateComplete)
          }
        })
        .catch(() => {
          if (cancelled) return
          const idleUrl = character.clips?.['idle']
          if (idleUrl && idleUrl !== clipUrl) {
            loadAnimation(idleUrl)
          } else {
            setLoadError(true)
          }
        })
    }

    loadAnimation(url)

    return () => {
      cancelled = true
      if (animRef.current) {
        animRef.current.destroy()
        animRef.current = null
      }
    }
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

  return <div ref={containerRef} style={{ width: size, height: size }} />
}
