import { useEffect, useState, Component } from 'react'
import type { ReactNode, ErrorInfo } from 'react'
import Lottie from 'lottie-react'
import type { AvatarState, CharacterManifest } from '@buddy/types'

interface Props {
  character: CharacterManifest
  state: AvatarState
  size: number
  onStateComplete?: () => void
}

class LottieErrorBoundary extends Component<{ size: number; emoji: string; children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false }
  static getDerivedStateFromError() { return { hasError: true } }
  componentDidCatch(_: Error, __: ErrorInfo) {}
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          width: this.props.size, height: this.props.size,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: this.props.size * 0.75, userSelect: 'none',
        }}>
          {this.props.emoji}
        </div>
      )
    }
    return this.props.children
  }
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
        const idleUrl = character.clips?.['idle']
        if (idleUrl && idleUrl !== url) {
          fetch(idleUrl)
            .then(r => r.ok ? r.json() : Promise.reject(new Error(`${r.status}`)))
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
    <LottieErrorBoundary size={size} emoji={FALLBACK_EMOJI[state]}>
      <Lottie
        animationData={clipData}
        loop={LOOPING_STATES.includes(state)}
        onComplete={state === 'react_happy' && onStateComplete ? onStateComplete : undefined}
        style={{ width: size, height: size }}
      />
    </LottieErrorBoundary>
  )
}
