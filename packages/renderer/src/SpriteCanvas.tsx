import { useRef, useEffect, useState } from 'react'
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

export function SpriteCanvas({ character, state, size, onStateComplete }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameRef = useRef(0)
  const rafRef = useRef(0)
  const lastFrameTimeRef = useRef(0)
  const [loadError, setLoadError] = useState(false)
  const imgRef = useRef<HTMLImageElement | null>(null)

  const fps = character.fps ?? 8
  const frameWidth = character.frameWidth ?? 48
  const frameHeight = character.frameHeight ?? 48

  // Resolve which row/frames to draw — falls back to idle row
  const resolveRow = (s: AvatarState) => {
    const row = character.states?.[s] ?? character.states?.['idle'] ?? null
    return row
  }

  // Load spritesheet image once
  useEffect(() => {
    if (!character.sheet) return
    setLoadError(false)
    const img = new Image()
    img.src = character.sheet
    img.onload = () => { imgRef.current = img }
    img.onerror = () => setLoadError(true)
    return () => {
      img.onload = null
      img.onerror = null
      imgRef.current = null
    }
  }, [character.sheet])

  // Reset frame on state change
  useEffect(() => {
    frameRef.current = 0
  }, [state])

  // RAF animation loop
  useEffect(() => {
    if (!character.sheet || loadError) return
    const interval = 1000 / fps

    const tick = (now: number) => {
      if (!canvasRef.current || !imgRef.current) {
        rafRef.current = requestAnimationFrame(tick)
        return
      }
      if (now - lastFrameTimeRef.current >= interval) {
        lastFrameTimeRef.current = now
        const rowConfig = resolveRow(state)
        if (!rowConfig) { rafRef.current = requestAnimationFrame(tick); return }

        const { row, frames } = rowConfig
        const ctx = canvasRef.current.getContext('2d')
        if (!ctx) { rafRef.current = requestAnimationFrame(tick); return }

        ctx.clearRect(0, 0, size, size)
        ctx.drawImage(
          imgRef.current,
          frameRef.current * frameWidth, row * frameHeight,
          frameWidth, frameHeight,
          0, 0, size, size,
        )

        const isLastFrame = frameRef.current >= frames - 1
        if (isLastFrame && state === 'react_happy') {
          onStateComplete?.()
        }
        frameRef.current = isLastFrame ? 0 : frameRef.current + 1
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [character.sheet, state, size, fps, frameWidth, frameHeight, loadError, onStateComplete])

  if (!character.sheet || loadError) {
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

  return <canvas ref={canvasRef} width={size} height={size} style={{ display: 'block' }} />
}
