import { useState, useEffect, useRef, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { BuddyCanvas } from '@buddy/renderer'
import { ChatBubble } from './ChatBubble'
import { useBuddy } from './hooks/useBuddy'
import { createPhysics, tickPhysics, setWalkTarget, randomEdgeTarget } from './physics'
import type { Avatar } from '@buddy/types'

const SPRITE = 120
const WIN_W = 280
const WIN_H = 420
const OFF_X = (WIN_W - SPRITE) / 2   // 80 — avatar centered horizontally
const OFF_Y = WIN_H - SPRITE           // 300 — avatar at bottom
const WALK_INTERVAL_MS = 6000

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

  const sw = window.screen.width
  const sh = window.screen.height
  const initPos = { x: sw - SPRITE - 60, y: sh - SPRITE - 80 }

  const physicsRef = useRef(createPhysics(initPos))
  const lastTimeRef = useRef(performance.now())
  const rafRef = useRef(0)
  const lastWinPos = useRef({ x: -9999, y: -9999 })
  const chatOpenRef = useRef(false)
  chatOpenRef.current = chatOpen
  const walkResumeAt = useRef(0) // timestamp after which autonomous walk resumes

  const { state, history, thinking, sendMessage } = useBuddy(DEFAULT_AVATAR)

  // Move window via Rust command (bypasses capabilities system)
  const moveWindow = useCallback((x: number, y: number) => {
    void invoke('move_window', { x, y })
  }, [])

  // Set initial position and first walk target
  useEffect(() => {
    const { x, y } = initPos
    moveWindow(Math.round(x - OFF_X), Math.round(y - OFF_Y))
    physicsRef.current = setWalkTarget(
      physicsRef.current,
      randomEdgeTarget(sw, sh, SPRITE)
    )
  }, [])

  // Physics loop
  useEffect(() => {
    const loop = (now: number) => {
      const dt = Math.min((now - lastTimeRef.current) / 1000, 0.05)
      lastTimeRef.current = now

      if (!isDraggingRef.current) {
        physicsRef.current = tickPhysics(physicsRef.current, sw, sh, SPRITE, dt)
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

      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [sw, sh, moveWindow])

  // Random walk when idle
  useEffect(() => {
    if (state !== 'idle') return
    const id = setInterval(() => {
      if (Date.now() < walkResumeAt.current) return
      physicsRef.current = setWalkTarget(
        physicsRef.current,
        randomEdgeTarget(sw, sh, SPRITE)
      )
    }, WALK_INTERVAL_MS)
    return () => clearInterval(id)
  }, [state, sw, sh])

  // Drag support — only initiate system drag after mouse moves > 5px while held
  const mouseDownAt = useRef<{ x: number; y: number } | null>(null)
  const isDraggingRef = useRef(false)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    mouseDownAt.current = { x: e.clientX, y: e.clientY }

    const onMove = (me: MouseEvent) => {
      if (!mouseDownAt.current) return
      const dx = me.clientX - mouseDownAt.current.x
      const dy = me.clientY - mouseDownAt.current.y
      if (Math.sqrt(dx * dx + dy * dy) > 5) {
        // Threshold crossed — start system drag
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
        mouseDownAt.current = null
        isDraggingRef.current = true
        void (invoke('start_drag') as Promise<[number, number]>).then(([wx, wy]) => {
          physicsRef.current = createPhysics({ x: wx + OFF_X, y: wy + OFF_Y })
          walkResumeAt.current = Date.now() + 30_000 // stay put for 30s after drag
          isDraggingRef.current = false
        }).catch(() => {
          isDraggingRef.current = false
        })
      }
    }

    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      // mouseDownAt still set → was a click, not a drag
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [])

  const handleClick = useCallback(() => {
    if (!mouseDownAt.current) return // drag consumed the mousedown
    mouseDownAt.current = null
    setChatOpen(o => !o)
  }, [])

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
