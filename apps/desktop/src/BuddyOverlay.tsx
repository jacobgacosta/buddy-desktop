import { useState, useEffect, useRef, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { BuddyCanvas } from '@buddy/renderer'
import { ChatBubble } from './ChatBubble'
import { useBuddy } from './hooks/useBuddy'
import { createPhysics, tickPhysics, setWalkTarget, randomNearbyTarget } from './physics'
import type { Avatar } from '@buddy/types'
import type { Position } from './physics'

// Window dimensions and avatar placement within it.
// Avatar sits at the TOP of the window (OFF_Y = 0) so the window can reach y = 0 on screen.
// Chat bubble opens below the avatar.
const SPRITE = 120
const WIN_W = 280
const WIN_H = 420
const OFF_X = (WIN_W - SPRITE) / 2   // horizontal centering within window
const OFF_Y = 0                        // avatar at top of window

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

type MonitorBounds = { x: number; y: number; w: number; h: number }

// Returns a random walk destination that keeps the entire window on-screen.
// pos is avatar position in screen coordinates (not window position).
function clampedWalkTarget(pos: Position, mon: MonitorBounds): Position {
  const minX = mon.x + OFF_X
  const maxX = mon.x + mon.w - (WIN_W - OFF_X)
  const minY = mon.y + OFF_Y
  const maxY = mon.y + mon.h - WIN_H
  for (let i = 0; i < 12; i++) {
    const t = randomNearbyTarget(pos)
    const cx = Math.max(minX, Math.min(maxX, t.x))
    const cy = Math.max(minY, Math.min(maxY, t.y))
    if ((cx - pos.x) ** 2 + (cy - pos.y) ** 2 >= 120 ** 2) return { x: cx, y: cy }
  }
  // Fallback: walk toward screen center
  return {
    x: Math.max(minX, Math.min(maxX, mon.x + mon.w / 2)),
    y: Math.max(minY, Math.min(maxY, mon.y + mon.h / 2)),
  }
}

export function BuddyOverlay() {
  const [chatOpen, setChatOpen] = useState(false)

  // Avatar screen position on start: 20px from right/bottom edge.
  // pos.(x,y) = avatar screen coords; window pos = (pos.x - OFF_X, pos.y - OFF_Y).
  const sw = window.screen.availWidth
  const sh = window.screen.availHeight
  const initPos = { x: sw - WIN_W + OFF_X - 20, y: sh - WIN_H - 20 }

  const physicsRef   = useRef(createPhysics(initPos))
  const lastTimeRef  = useRef(performance.now())
  const rafRef       = useRef(0)
  const sleepTimerRef = useRef(0)
  const walkTimerRef = useRef(0)
  const lastWinPos   = useRef({ x: -9999, y: -9999 })
  const chatOpenRef  = useRef(false)
  chatOpenRef.current = chatOpen
  const isDraggingRef = useRef(false)
  const anchoredRef   = useRef(false)
  const monitorRef   = useRef<MonitorBounds>({ x: 0, y: 0, w: sw, h: sh })

  const { state, history, thinking, sendMessage, wakeUp, startWalking, stopWalking } = useBuddy(DEFAULT_AVATAR)
  const stateRef = useRef(state)
  stateRef.current = state

  const moveWindow = useCallback((x: number, y: number) => {
    void invoke('move_window', { x, y })
  }, [])

  const refreshMonitor = useCallback(() => {
    void invoke<[number, number, number, number]>('get_monitor_bounds')
      .then(([x, y, w, h]) => { monitorRef.current = { x, y, w, h } })
      .catch(() => {})
  }, [])

  // Schedule next autonomous walk. Cancels any pending walk timer first.
  // Does nothing while sleeping — resumeWalkAfterSleep handles that transition.
  const scheduleNextWalk = useCallback((delay: number) => {
    clearTimeout(walkTimerRef.current)
    walkTimerRef.current = window.setTimeout(() => {
      if (isDraggingRef.current || stateRef.current === 'sleep' || anchoredRef.current) return
      startWalking()
      physicsRef.current = setWalkTarget(
        physicsRef.current,
        clampedWalkTarget(physicsRef.current.pos, monitorRef.current),
      )
    }, delay)
  }, [startWalking])

  // Place window at initial position and kick off the first walk after 1 s.
  useEffect(() => {
    moveWindow(Math.round(initPos.x - OFF_X), Math.round(initPos.y - OFF_Y))
    refreshMonitor()
    scheduleNextWalk(1_000)
  }, [moveWindow, refreshMonitor, scheduleNextWalk])

  // Resume walk cycle after waking from sleep (both auto-wake and user click).
  const prevStateRef = useRef(state)
  useEffect(() => {
    const prev = prevStateRef.current
    prevStateRef.current = state
    if (prev === 'sleep' && state === 'idle') scheduleNextWalk(2_000)
  }, [state, scheduleNextWalk])

  // Sync anchor state from tray icon menu
  useEffect(() => {
    let unlisten: (() => void) | undefined
    listen<boolean>('anchor-changed', ({ payload }) => {
      anchoredRef.current = payload
    }).then(fn => { unlisten = fn })
    return () => { unlisten?.() }
  }, [])

  // Physics loop — runs via RAF when moving, polls every 250 ms when idle.
  useEffect(() => {
    const loop = (now: number) => {
      const dt = Math.min((now - lastTimeRef.current) / 1000, 0.05)
      lastTimeRef.current = now

      if (!isDraggingRef.current) {
        const hadTarget = physicsRef.current.target !== null
        physicsRef.current = tickPhysics(physicsRef.current, dt)
        if (hadTarget && physicsRef.current.target === null) {
          stopWalking()
          scheduleNextWalk(Math.random() * 5_000 + 3_000)
        }
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

      if (physicsRef.current.target !== null || isDraggingRef.current) {
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
  }, [moveWindow, stopWalking, scheduleNextWalk])

  // Drag — implemented in JS using screen coordinates so mouseup is always reliable.
  const mouseDownAt = useRef<{ x: number; y: number } | null>(null)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const startMouseX = e.screenX
    const startMouseY = e.screenY
    const startWinX = window.screenX
    const startWinY = window.screenY
    mouseDownAt.current = { x: e.clientX, y: e.clientY }
    let dragStarted = false

    const onMove = (me: MouseEvent) => {
      const dx = me.screenX - startMouseX
      const dy = me.screenY - startMouseY
      if (!dragStarted) {
        if (dx * dx + dy * dy <= 25) return  // < 5px, not a drag yet
        dragStarted = true
        isDraggingRef.current = true
        mouseDownAt.current = null
      }
      const newWx = startWinX + dx
      const newWy = startWinY + dy
      if (Math.abs(newWx - lastWinPos.current.x) > 1 || Math.abs(newWy - lastWinPos.current.y) > 1) {
        lastWinPos.current = { x: newWx, y: newWy }
        moveWindow(newWx, newWy)
      }
    }

    const onUp = (me: MouseEvent) => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      if (!dragStarted) return
      const finalWx = startWinX + (me.screenX - startMouseX)
      const finalWy = startWinY + (me.screenY - startMouseY)
      physicsRef.current = createPhysics({ x: finalWx + OFF_X, y: finalWy + OFF_Y })
      lastWinPos.current = { x: finalWx, y: finalWy }
      stopWalking()
      isDraggingRef.current = false
      refreshMonitor()
      scheduleNextWalk(2_000)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [moveWindow, stopWalking, refreshMonitor, scheduleNextWalk])

  const handleClick = useCallback(() => {
    if (!mouseDownAt.current) return
    mouseDownAt.current = null
    if (stateRef.current === 'sleep') { wakeUp(); return }
    setChatOpen(o => !o)
  }, [wakeUp])

  return (
    <div style={{ width: WIN_W, height: WIN_H, position: 'relative' }}>
      {chatOpen && (
        <div style={{
          position: 'absolute',
          top: SPRITE + 8, left: 8, right: 8, bottom: 8,
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
          top: 0, left: OFF_X,
          width: SPRITE, height: SPRITE,
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
