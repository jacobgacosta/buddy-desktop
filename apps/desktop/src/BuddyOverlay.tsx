import { useState, useEffect, useCallback, useRef } from 'react'
import { BuddyCanvas } from '@buddy/renderer'
import { ChatBubble } from './ChatBubble'
import { useBuddy } from './hooks/useBuddy'
import { usePassthrough } from './hooks/usePassthrough'
import { createPhysics, tickPhysics, setWalkTarget, randomEdgeTarget } from './physics'
import type { Avatar } from '@buddy/types'

const SPRITE_SIZE = 120
const WALK_INTERVAL_MS = 8000

// Avatar por defecto (en producción se carga desde /avatars)
const DEFAULT_AVATAR: Avatar = {
  id: 'fox',
  name: 'Foxy',
  riveFile: '/assets/fox.riv',
  stateMachine: 'BuddySM',
  personality: 'Eres Foxy, un zorro amigable y curioso. Responde en español, máximo 2-3 oraciones.',
  voice: { system: 'es-MX' },
  palette: ['#FF6B35', '#F7C59F'],
  size: 'medium',
}

export function BuddyOverlay() {
  const [chatOpen, setChatOpen] = useState(false)
  const [pos, setPos] = useState({ x: window.innerWidth - 160, y: window.innerHeight - 180 })
  const physicsRef = useRef(createPhysics(pos))
  const lastTimeRef = useRef(performance.now())
  const { state, history, thinking, sendMessage } = useBuddy(DEFAULT_AVATAR)
  const { setIgnore } = usePassthrough()

  // Loop de física
  useEffect(() => {
    let raf: number
    const loop = (now: number) => {
      const dt = Math.min((now - lastTimeRef.current) / 1000, 0.05)
      lastTimeRef.current = now
      physicsRef.current = tickPhysics(
        physicsRef.current,
        window.innerWidth,
        window.innerHeight,
        SPRITE_SIZE,
        dt
      )
      setPos({ ...physicsRef.current.pos })
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  // Caminar aleatoriamente cuando está idle
  useEffect(() => {
    if (state !== 'idle') return
    const timer = setInterval(() => {
      physicsRef.current = setWalkTarget(
        physicsRef.current,
        randomEdgeTarget(window.innerWidth, window.innerHeight, SPRITE_SIZE)
      )
    }, WALK_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [state])

  const handleMouseEnter = useCallback(() => setIgnore(false), [setIgnore])
  const handleMouseLeave = useCallback(() => setIgnore(true), [setIgnore])

  return (
    <>
      <div
        style={{
          position: 'fixed',
          left: pos.x,
          top: pos.y,
          width: SPRITE_SIZE,
          height: SPRITE_SIZE,
          cursor: 'pointer',
          userSelect: 'none',
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={() => setChatOpen(o => !o)}
      >
        <BuddyCanvas
          riveFile={DEFAULT_AVATAR.riveFile}
          stateMachine={DEFAULT_AVATAR.stateMachine}
          state={state}
          size={SPRITE_SIZE}
        />
      </div>

      {chatOpen && (
        <ChatBubble
          history={history}
          thinking={thinking}
          onSend={sendMessage}
          onClose={() => setChatOpen(false)}
        />
      )}
    </>
  )
}
