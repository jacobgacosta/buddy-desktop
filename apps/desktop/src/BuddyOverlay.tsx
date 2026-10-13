import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { CharacterRenderer } from '@buddy/renderer'
import { ChatBubble } from './ChatBubble'
import { ContextMenu } from './ContextMenu'
import { SettingsPanel } from './SettingsPanel'
import { CharacterPicker } from './CharacterPicker'
import { useBuddy } from './hooks/useBuddy'
import { CHARACTERS, findCharacter } from './characters/registry'
import { createPhysics, tickPhysics, setWalkTarget, randomNearbyTarget } from './physics'
import type { Avatar, Message } from '@buddy/types'
import type { Position } from './physics'

// Window dimensions and avatar placement within it.
// Avatar sits at the TOP of the window (OFF_Y = 0) so the window can reach y = 0 on screen.
// Chat bubble opens below the avatar.
const SPRITE = 200
const WIN_W = 260
const WIN_H = 480
const PANEL_TOP = 168                  // where chat/menus start (independent of SPRITE)
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

const POS_KEY     = 'buddy-pos'
const CONFIG_KEY  = 'buddy-avatar-config'
const HISTORY_KEY = 'buddy-history'
const MAX_HISTORY = 30

const CHAR_KEY = 'buddy-character-v2'

function loadSavedCharacter() {
  try {
    const id = localStorage.getItem(CHAR_KEY)
    if (id) return findCharacter(id)
  } catch {}
  return null
}

function loadConfig(): { name: string; personality: string } | null {
  try {
    const raw = localStorage.getItem(CONFIG_KEY)
    if (!raw) return null
    const { name, personality } = JSON.parse(raw)
    if (typeof name === 'string' && typeof personality === 'string') return { name, personality }
  } catch {}
  return null
}

function loadHistory(): Message[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    if (Array.isArray(arr)) return arr as Message[]
  } catch {}
  return []
}
function loadSavedWinPos(): { x: number; y: number } | null {
  try {
    const raw = localStorage.getItem(POS_KEY)
    if (!raw) return null
    const { x, y } = JSON.parse(raw)
    if (typeof x === 'number' && typeof y === 'number') return { x, y }
  } catch {}
  return null
}
function saveWinPos(x: number, y: number) {
  try { localStorage.setItem(POS_KEY, JSON.stringify({ x, y })) } catch {}
}

// Returns a random walk destination that keeps the entire window on-screen.
// pos is avatar position in screen coordinates (not window position).
function clampedWalkTarget(pos: Position, mon: MonitorBounds, radius = 350): Position {
  const minX = mon.x + OFF_X
  const maxX = mon.x + mon.w - (WIN_W - OFF_X)
  const minY = mon.y + OFF_Y
  const maxY = mon.y + mon.h - WIN_H
  for (let i = 0; i < 12; i++) {
    const t = randomNearbyTarget(pos, radius)
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
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [isAnchored, setIsAnchored] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [currentCharacter, setCurrentCharacter] = useState(
    () => loadSavedCharacter() ?? CHARACTERS[0]
  )
  const [animVersion, setAnimVersion] = useState(0)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)

  // Avatar screen position on start: 20px from right/bottom edge.
  // pos.(x,y) = avatar screen coords; window pos = (pos.x - OFF_X, pos.y - OFF_Y).
  const sw = window.screen.availWidth
  const sh = window.screen.availHeight
  const savedWin = loadSavedWinPos()
  // initPos is the avatar center in screen coords. If saved, restore from saved window top-left.
  const initPos = savedWin
    ? { x: savedWin.x + OFF_X, y: savedWin.y + OFF_Y }
    : { x: sw - WIN_W + OFF_X - 20, y: sh - WIN_H - 20 }

  const physicsRef   = useRef(createPhysics(initPos))
  const lastTimeRef  = useRef(performance.now())
  const rafRef       = useRef(0)
  const sleepTimerRef = useRef(0)
  const walkTimerRef = useRef(0)
  const lastWinPos   = useRef({ x: -9999, y: -9999 })
  const chatOpenRef  = useRef(false)
  chatOpenRef.current = chatOpen
  const uiBusyRef = useRef(false)
  uiBusyRef.current = chatOpen || !!contextMenu || settingsOpen || pickerOpen
  const isDraggingRef = useRef(false)
  const anchoredRef   = useRef(false)
  const monitorRef   = useRef<MonitorBounds>({ x: 0, y: 0, w: sw, h: sh })

  const [avatarConfig, setAvatarConfig] = useState(() => loadConfig() ?? { name: DEFAULT_AVATAR.name, personality: DEFAULT_AVATAR.personality })
  const avatar = useMemo<Avatar>(() => ({ ...DEFAULT_AVATAR, id: currentCharacter.id, name: avatarConfig.name, personality: avatarConfig.personality }), [avatarConfig, currentCharacter.id])

  const handleSaveConfig = useCallback((name: string, personality: string) => {
    const cfg = { name, personality }
    setAvatarConfig(cfg)
    try { localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg)) } catch {}
  }, [])

  const [initialHistory] = useState(loadHistory)
  const { state, history, thinking, sendMessage, wakeUp, startWalking, stopWalking, stopReacting } = useBuddy(avatar, initialHistory)
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
      if (isDraggingRef.current || anchoredRef.current) return
      if (uiBusyRef.current) { scheduleNextWalk(3_000); return }
      if (stateRef.current === 'sleep') return
      if (stateRef.current !== 'idle') { scheduleNextWalk(2_000); return }
      startWalking()
      const scale = Math.max(0.75, Math.min(2, monitorRef.current.w / 1920))
      physicsRef.current = setWalkTarget(
        physicsRef.current,
        clampedWalkTarget(physicsRef.current.pos, monitorRef.current, Math.round(350 * scale)),
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

  // Persist chat history (last MAX_HISTORY messages)
  useEffect(() => {
    if (history.length === 0) return
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-MAX_HISTORY))) } catch {}
  }, [history])

  // Refresh monitor bounds when window is moved by OS (snap, keyboard, multi-monitor drag)
  useEffect(() => {
    let unlisten: (() => void) | undefined
    let debounce = 0
    getCurrentWindow().onMoved(() => {
      clearTimeout(debounce)
      debounce = window.setTimeout(refreshMonitor, 500)
    }).then(fn => { unlisten = fn })
    return () => { clearTimeout(debounce); unlisten?.() }
  }, [refreshMonitor])

  // Sync anchor state from tray icon menu; resume walk cycle on unanchor
  useEffect(() => {
    let unlisten: (() => void) | undefined
    listen<boolean>('anchor-changed', ({ payload }) => {
      anchoredRef.current = payload
      setIsAnchored(payload)
      if (!payload) scheduleNextWalk(2_000)
    }).then(fn => { unlisten = fn })
    return () => { unlisten?.() }
  }, [scheduleNextWalk])

  // Physics loop — runs via RAF when moving, polls every 250 ms when idle.
  useEffect(() => {
    const loop = (now: number) => {
      const dt = Math.min((now - lastTimeRef.current) / 1000, 0.05)
      lastTimeRef.current = now

      if (!isDraggingRef.current) {
        const hadTarget = physicsRef.current.target !== null
        const scale = Math.max(0.75, Math.min(2, monitorRef.current.w / 1920))
        physicsRef.current = tickPhysics(physicsRef.current, dt, Math.round(80 * scale))
        if (hadTarget && physicsRef.current.target === null) {
          stopWalking()
          const { x, y } = physicsRef.current.pos
          saveWinPos(Math.round(x - OFF_X), Math.round(y - OFF_Y))
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
    if (e.button !== 0) return
    // freeze physics immediately so the RAF loop doesn't fight the drag handler
    physicsRef.current = { ...physicsRef.current, target: null }
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
      saveWinPos(finalWx, finalWy)
      stopWalking()
      isDraggingRef.current = false
      refreshMonitor()
      scheduleNextWalk(10_000)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [moveWindow, stopWalking, refreshMonitor, scheduleNextWalk])

  const handleToggleAnchor = useCallback(() => {
    const next = !anchoredRef.current
    anchoredRef.current = next
    setIsAnchored(next)
    void invoke('set_anchor', { anchored: next })
    if (!next) scheduleNextWalk(2_000)
  }, [scheduleNextWalk])

  const handleSelectCharacter = useCallback((char: typeof CHARACTERS[0]) => {
    setCurrentCharacter(char)
    setAvatarConfig({ name: char.name, personality: char.personality })
    try {
      localStorage.setItem(CHAR_KEY, char.id)
      localStorage.setItem(CONFIG_KEY, JSON.stringify({ name: char.name, personality: char.personality }))
    } catch {}
  }, [])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const MENU_W = 152, MENU_H = 130
    const x = Math.min(e.clientX, WIN_W - MENU_W)
    const y = Math.max(PANEL_TOP, Math.min(e.clientY, WIN_H - MENU_H))
    setContextMenu({ x, y })
  }, [])

  const handleClick = useCallback(() => {
    if (!mouseDownAt.current) return
    mouseDownAt.current = null
    if (stateRef.current === 'sleep') { wakeUp(); return }
    // resync physics to actual window position on every toggle
    stopWalking()
    physicsRef.current = createPhysics({ x: lastWinPos.current.x + OFF_X, y: lastWinPos.current.y + OFF_Y })
    setChatOpen(o => {
      if (o) scheduleNextWalk(5_000) // closing chat → resume after 5s
      return !o
    })
  }, [wakeUp, stopWalking, scheduleNextWalk])

  const panelSlot: React.CSSProperties = {
    position: 'absolute', top: PANEL_TOP, left: 6, right: 6, bottom: 6,
  }

  return (
    <div style={{ width: WIN_W, height: WIN_H, position: 'relative' }}>
      {chatOpen && !settingsOpen && (
        <div style={panelSlot}>
          <ChatBubble
            history={history}
            thinking={thinking}
            onSend={sendMessage}
            onClose={() => setChatOpen(false)}
          />
        </div>
      )}
      {settingsOpen && (
        <div style={panelSlot}>
          <SettingsPanel
            avatarName={avatarConfig.name}
            avatarPersonality={avatarConfig.personality}
            onSave={handleSaveConfig}
            onClose={() => setSettingsOpen(false)}
          />
        </div>
      )}
      {pickerOpen && (
        <div style={panelSlot}>
          <CharacterPicker
            characters={CHARACTERS}
            currentId={currentCharacter.id}
            onSelect={handleSelectCharacter}
            onAnimChange={() => setAnimVersion(v => v + 1)}
            onClose={() => setPickerOpen(false)}
          />
        </div>
      )}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          isAnchored={isAnchored}
          onToggleAnchor={handleToggleAnchor}
          onOpenSettings={() => { setSettingsOpen(true); setChatOpen(false); setPickerOpen(false) }}
          onOpenPicker={() => { setPickerOpen(true); setChatOpen(false); setSettingsOpen(false) }}
          onClose={() => { setContextMenu(null); scheduleNextWalk(5_000) }}
        />
      )}
      <div
        style={{
          position: 'absolute',
          top: 0, left: OFF_X,
          width: SPRITE, height: SPRITE,
          zIndex: 10,
          cursor: 'grab',
          userSelect: 'none',
        }}
        onMouseDown={handleMouseDown}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      >
        <CharacterRenderer
          key={`${currentCharacter.id}-${animVersion}`}
          character={currentCharacter}
          state={state}
          size={SPRITE}
          onStateComplete={stopReacting}
        />
      </div>
    </div>
  )
}
