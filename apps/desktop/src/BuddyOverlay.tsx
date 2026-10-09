import { useState, useEffect, useRef, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { BuddyCanvas } from '@buddy/renderer'
import { ChatBubble } from './ChatBubble'
import { useBuddy } from './hooks/useBuddy'
import { createPhysics, tickPhysics, setWalkTarget, randomNearbyTarget } from './physics'
import type { Avatar } from '@buddy/types'

const SPRITE = 120
const WIN_W = 280
const WIN_H = 420
const OFF_X = (WIN_W - SPRITE) / 2
const OFF_Y = WIN_H - SPRITE

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

function randomWalkDelay() {
  return 30_000 + Math.random() * 30_000 // 30–60 seconds
}

export function BuddyOverlay() {
  const [chatOpen, setChatOpen] = useState(false)

  const sw = window.screen.width
  const sh = window.screen.height
  // Avatar pos that puts the window in the bottom-right, fully on screen
  const initPos = { x: sw - WIN_W + OFF_X - 20, y: sh - WIN_H + OFF_Y - 20 }

  const physicsRef = useRef(createPhysics(initPos))
  const lastTimeRef = useRef(performance.now())
  const rafRef = useRef(0)
  const sleepTimerRef = useRef(0)
  const lastWinPos = useRef({ x: -9999, y: -9999 })
  const chatOpenRef = useRef(false)
  chatOpenRef.current = chatOpen
  const walkResumeAt = useRef(0)
  const isDraggingRef = useRef(false)

  const { state, history, thinking, sendMessage, wakeUp, startWalking, stopWalking } = useBuddy(DEFAULT_AVATAR)

  const stateRef = useRef(state)
  stateRef.current = state

  const moveWindow = useCallback((x: number, y: number) => {
    void invoke('move_window', { x, y })
  }, [])

  // Set initial window position and first walk target
  useEffect(() => {
    const { x, y } = initPos
    moveWindow(Math.round(x - OFF_X), Math.round(y - OFF_Y))
    physicsRef.current = setWalkTarget(physicsRef.current, randomNearbyTarget(physicsRef.current.pos))
  }, [])

  // Physics loop
  useEffect(() => {
    const loop = (now: number) => {
      const dt = Math.min((now - lastTimeRef.current) / 1000, 0.05)
      lastTimeRef.current = now

      if (!isDraggingRef.current) {
        const hadTarget = physicsRef.current.target !== null
        // When idle, sync pos with actual window position — handles drag, multi-monitor, etc.
        if (!hadTarget) {
          physicsRef.current = {
            ...physicsRef.current,
            pos: { x: window.screenX + OFF_X, y: window.screenY + OFF_Y },
          }
        }
        physicsRef.current = tickPhysics(physicsRef.current, dt)
        const arrivedNow = hadTarget && physicsRef.current.target === null
        if (arrivedNow) stopWalking()
      }

      if (!chatOpenRef.current && !isDraggingRef.current) {
        const { x, y } = physicsRef.current.pos
        const wx = Math.round(x - OFF_X)
        const wy = Math.round(y - OFF_Y)
        if (Math.abs(wx - lastWinPos.current.x) > 1 || Math.abs(wy - lastWinPos.current.y) > 1) {
          lastWinPos.current = { x: wx, y: wy }
          moveWindow(wx, wy)
        }
      }

      const active = physicsRef.current.target !== null || isDraggingRef.current
      if (active) {
        rafRef.current = requestAnimationFrame(loop)
      } else {
        sleepTimerRef.current = window.setTimeout(() => {
          rafRef.current = requestAnimationFrame(loop)
        }, 250)
      }
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(rafRef.current)
      clearTimeout(sleepTimerRef.current)
    }
  }, [stopWalking])

  // Autonomous walk — every 30s when idle and not recently dragged
  useEffect(() => {
    if (state !== 'idle') return
    const id = setInterval(() => {
      if (Date.now() >= walkResumeAt.current) {
        startWalking()
        physicsRef.current = setWalkTarget(physicsRef.current, randomNearbyTarget(physicsRef.current.pos))
      }
    }, 30_000)
    return () => clearInterval(id)
  }, [state, sw, sh, startWalking])

  // Drag support
  const mouseDownAt = useRef<{ x: number; y: number } | null>(null)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    mouseDownAt.current = { x: e.clientX, y: e.clientY }

    const onMove = (me: MouseEvent) => {
      if (!mouseDownAt.current) return
      const dx = me.clientX - mouseDownAt.current.x
      const dy = me.clientY - mouseDownAt.current.y
      if (Math.sqrt(dx * dx + dy * dy) > 5) {
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
        mouseDownAt.current = null
        isDraggingRef.current = true
        void invoke('start_drag').then(() => {
          // window.screenX/Y is in the same logical coordinate space as move_window
          const wx = window.screenX
          const wy = window.screenY
          physicsRef.current = createPhysics({ x: wx + OFF_X, y: wy + OFF_Y })
          walkResumeAt.current = Date.now() + 30_000
          stopWalking()
          isDraggingRef.current = false
        }).catch(() => {
          stopWalking()
          isDraggingRef.current = false
        })
      }
    }

    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [stopWalking])

  const handleClick = useCallback(() => {
    if (!mouseDownAt.current) return
    mouseDownAt.current = null
    if (stateRef.current === 'sleep') {
      wakeUp()
      return
    }
    setChatOpen(o => !o)
  }, [wakeUp])

  return (
    <div style={{ width: WIN_W, height: WIN_H, position: 'relative' }}>
      {chatOpen && (
        <div style={{
          position: 'absolute',
          top: 8, left: 8, right: 8,
          bottom: SPRITE + 8,
          overflow: 'hidden',
        }}>
          <ChatBubble
            history={history}
            thinking={thinking}
            onSend={sendMessage}
            onClose={() => setChatOpen(false)}
          />
        </div>
      )}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: OFF_X,
          width: SPRITE,
          height: SPRITE,
          cursor: 'grab',
          userSelect: 'none',
        }}
        onMouseDown={handleMouseDown}
        onClick={handleClick}
      >
        <BuddyCanvas
          riveFile={DEFAULT_AVATAR.riveFile}
          stateMachine={DEFAULT_AVATAR.stateMachine}
          state={state}
          size={SPRITE}
        />
      </div>
    </div>
  )
}
