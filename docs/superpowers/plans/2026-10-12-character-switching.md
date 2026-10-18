# Character Switching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a multi-character system to Buddy — each character has its own sprite-sheet or Lottie animations and default personality, selectable from the right-click context menu.

**Architecture:** Two renderer components (`SpriteCanvas`, `LottieCanvas`) are selected by a thin `CharacterRenderer` switch based on a `CharacterManifest` type. Characters are bundled with the app in a registry; the user's selection is persisted in localStorage. The picker opens in the existing `panelSlot` in `BuddyOverlay`.

**Tech Stack:** React 19, TypeScript, `lottie-react` (new), vitest + @testing-library/react, pnpm workspaces.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `packages/types/src/index.ts` | Add `CharacterManifest` type |
| Modify | `packages/core/src/avatar-state.ts` | Add `reactHappy()` + `finishReacting()` |
| Modify | `packages/core/src/__tests__/avatar-state.test.ts` | Tests for new transitions |
| Modify | `packages/renderer/package.json` | Add `lottie-react` dependency |
| Create | `packages/renderer/src/SpriteCanvas.tsx` | Sprite-sheet RAF renderer |
| Create | `packages/renderer/src/__tests__/SpriteCanvas.test.tsx` | Tests |
| Create | `packages/renderer/src/LottieCanvas.tsx` | Lottie-per-state renderer |
| Create | `packages/renderer/src/__tests__/LottieCanvas.test.tsx` | Tests |
| Create | `packages/renderer/src/CharacterRenderer.tsx` | Switch: sprite vs lottie |
| Create | `packages/renderer/src/__tests__/CharacterRenderer.test.tsx` | Tests |
| Modify | `packages/renderer/src/index.ts` | Export new components |
| Modify | `apps/desktop/src/hooks/useBuddy.ts` | Add `stopReacting` export |
| Create | `apps/desktop/src/characters/registry.ts` | Bundled character catalog |
| Create | `apps/desktop/public/assets/characters/pixel-fox/sheet.png` | Placeholder spritesheet |
| Create | `apps/desktop/public/assets/characters/lottie-cat/idle.json` | Placeholder Lottie clip |
| Create | `apps/desktop/public/assets/characters/lottie-cat/walk.json` | Placeholder Lottie clip |
| Create | `apps/desktop/src/CharacterPicker.tsx` | Picker grid UI |
| Modify | `apps/desktop/src/ContextMenu.tsx` | Add "Cambiar personaje…" item |
| Modify | `apps/desktop/src/BuddyOverlay.tsx` | Wire CharacterRenderer + picker |

---

## Task 1: Add `CharacterManifest` type and `react_happy` state transitions

**Files:**
- Modify: `packages/types/src/index.ts`
- Modify: `packages/core/src/avatar-state.ts`
- Modify: `packages/core/src/__tests__/avatar-state.test.ts`

- [ ] **Step 1: Write failing tests for new AvatarStateMachine transitions**

Open `packages/core/src/__tests__/avatar-state.test.ts` and add after the existing tests:

```typescript
it('transitions idle → react_happy on reactHappy()', () => {
  const sm = new AvatarStateMachine()
  sm.reactHappy()
  expect(sm.state).toBe('react_happy')
})

it('transitions react_happy → idle on finishReacting()', () => {
  const sm = new AvatarStateMachine()
  sm.reactHappy()
  sm.finishReacting()
  expect(sm.state).toBe('idle')
})

it('ignores reactHappy() when not idle', () => {
  const sm = new AvatarStateMachine()
  sm.startWalking()
  sm.reactHappy()
  expect(sm.state).toBe('walk')
})
```

- [ ] **Step 2: Run tests to verify they fail**

```
cd packages/core && pnpm test
```

Expected: FAIL — `sm.reactHappy is not a function`

- [ ] **Step 3: Add `reactHappy()` and `finishReacting()` to `AvatarStateMachine`**

In `packages/core/src/avatar-state.ts`, add these two methods after `stopWalking()`:

```typescript
reactHappy() {
  if (this._state === 'idle') this.transition('react_happy')
}

finishReacting() {
  if (this._state === 'react_happy') this.transition('idle')
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
cd packages/core && pnpm test
```

Expected: all PASS

- [ ] **Step 5: Add `CharacterManifest` type to the types package**

Replace the full contents of `packages/types/src/index.ts` with:

```typescript
export interface Avatar {
  id: string
  name: string
  riveFile: string
  stateMachine: string
  personality: string
  voice: {
    system: string
    elevenlabs?: string
  }
  palette: string[]
  size: 'small' | 'medium' | 'large'
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  avatarId: string
  timestamp: number
}

export interface ChatRequest {
  message: string
  avatarId: string
  history: Message[]
  context?: string
}

export interface ChatResponse {
  content: string
  avatarId: string
}

export type AvatarState = 'idle' | 'walk' | 'talk' | 'think' | 'react_happy' | 'sleep'

export interface CharacterManifest {
  id: string
  name: string
  type: 'sprite' | 'lottie'
  personality: string
  palette: [string, string]

  // sprite only
  sheet?: string
  frameWidth?: number
  frameHeight?: number
  fps?: number
  states?: Partial<Record<AvatarState, { row: number; frames: number }>>

  // lottie only
  clips?: Partial<Record<AvatarState, string>>
}
```

- [ ] **Step 6: Commit**

```bash
git add packages/types/src/index.ts packages/core/src/avatar-state.ts packages/core/src/__tests__/avatar-state.test.ts
git commit -m "feat: add CharacterManifest type and react_happy state transitions"
```

---

## Task 2: Install `lottie-react` and create `SpriteCanvas`

**Files:**
- Modify: `packages/renderer/package.json`
- Create: `packages/renderer/src/SpriteCanvas.tsx`
- Create: `packages/renderer/src/__tests__/SpriteCanvas.test.tsx`

- [ ] **Step 1: Add `lottie-react` to renderer package**

In `packages/renderer/package.json`, add to `"dependencies"`:

```json
"lottie-react": "^2.4.0"
```

Then install from repo root:

```
pnpm install
```

- [ ] **Step 2: Write failing tests for `SpriteCanvas`**

Create `packages/renderer/src/__tests__/SpriteCanvas.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { SpriteCanvas } from '../SpriteCanvas'
import type { CharacterManifest } from '@buddy/types'

const spriteChar: CharacterManifest = {
  id: 'test-fox',
  name: 'Test Fox',
  type: 'sprite',
  personality: 'test',
  palette: ['#FF6B35', '#F7C59F'],
  sheet: '/assets/characters/test-fox/sheet.png',
  frameWidth: 48,
  frameHeight: 48,
  fps: 8,
  states: {
    idle: { row: 0, frames: 4 },
    walk: { row: 1, frames: 8 },
  },
}

const noSheetChar: CharacterManifest = {
  id: 'no-sheet',
  name: 'No Sheet',
  type: 'sprite',
  personality: 'test',
  palette: ['#000', '#fff'],
}

// Mock canvas context — jsdom does not implement it
beforeEach(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    clearRect: vi.fn(),
    drawImage: vi.fn(),
  }) as unknown as CanvasRenderingContext2D)
})

describe('SpriteCanvas', () => {
  it('renders a canvas element when sheet is configured', () => {
    const { container } = render(
      <SpriteCanvas character={spriteChar} state="idle" size={120} />
    )
    expect(container.querySelector('canvas')).toBeTruthy()
  })

  it('renders emoji fallback when no sheet is configured', () => {
    const { container } = render(
      <SpriteCanvas character={noSheetChar} state="idle" size={120} />
    )
    expect(container.querySelector('canvas')).toBeFalsy()
    expect(container.textContent).toBe('🦊')
  })

  it('renders emoji fallback when state has no row configured', () => {
    const { container } = render(
      <SpriteCanvas character={spriteChar} state="sleep" size={120} />
    )
    // sleep has no row in spriteChar → falls back to idle row
    // canvas still renders (idle row is used as fallback)
    expect(container.querySelector('canvas')).toBeTruthy()
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

```
cd packages/renderer && pnpm test
```

Expected: FAIL — `SpriteCanvas` not found

- [ ] **Step 4: Implement `SpriteCanvas`**

Create `packages/renderer/src/SpriteCanvas.tsx`:

```typescript
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
    const img = new Image()
    img.src = character.sheet
    img.onload = () => { imgRef.current = img }
    img.onerror = () => setLoadError(true)
    return () => { img.onload = null; img.onerror = null }
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
```

- [ ] **Step 5: Run tests to verify they pass**

```
cd packages/renderer && pnpm test
```

Expected: all PASS

- [ ] **Step 6: Commit**

```bash
git add packages/renderer/package.json packages/renderer/src/SpriteCanvas.tsx packages/renderer/src/__tests__/SpriteCanvas.test.tsx
git commit -m "feat: add SpriteCanvas renderer for sprite-sheet characters"
```

---

## Task 3: Create `LottieCanvas`

**Files:**
- Create: `packages/renderer/src/LottieCanvas.tsx`
- Create: `packages/renderer/src/__tests__/LottieCanvas.test.tsx`

- [ ] **Step 1: Write failing tests for `LottieCanvas`**

Create `packages/renderer/src/__tests__/LottieCanvas.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { LottieCanvas } from '../LottieCanvas'
import type { CharacterManifest } from '@buddy/types'

vi.mock('lottie-react', () => ({
  default: ({ animationData, 'data-testid': testId }: { animationData: unknown; 'data-testid'?: string }) => (
    <div data-testid={testId ?? 'lottie'} data-has-data={String(!!animationData)} />
  ),
}))

// Mock fetch for clip loading
const mockClipData = { v: '5.7.4', fr: 24, ip: 0, op: 48, w: 120, h: 120, layers: [] }
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve(mockClipData),
} as Response)

const lottieChar: CharacterManifest = {
  id: 'test-cat',
  name: 'Test Cat',
  type: 'lottie',
  personality: 'test',
  palette: ['#8B5CF6', '#C4B5FD'],
  clips: {
    idle: '/assets/characters/test-cat/idle.json',
    walk: '/assets/characters/test-cat/walk.json',
  },
}

describe('LottieCanvas', () => {
  it('renders a lottie element', async () => {
    const { findByTestId } = render(
      <LottieCanvas character={lottieChar} state="idle" size={120} />
    )
    const el = await findByTestId('lottie')
    expect(el).toBeTruthy()
  })

  it('renders emoji fallback when no clips configured', () => {
    const noClips: CharacterManifest = {
      ...lottieChar, clips: undefined,
    }
    const { container } = render(
      <LottieCanvas character={noClips} state="idle" size={120} />
    )
    expect(container.textContent).toBe('🦊')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```
cd packages/renderer && pnpm test
```

Expected: FAIL — `LottieCanvas` not found

- [ ] **Step 3: Implement `LottieCanvas`**

Create `packages/renderer/src/LottieCanvas.tsx`:

```typescript
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
```

- [ ] **Step 4: Run tests to verify they pass**

```
cd packages/renderer && pnpm test
```

Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add packages/renderer/src/LottieCanvas.tsx packages/renderer/src/__tests__/LottieCanvas.test.tsx
git commit -m "feat: add LottieCanvas renderer for Lottie-based characters"
```

---

## Task 4: Create `CharacterRenderer` and update package exports

**Files:**
- Create: `packages/renderer/src/CharacterRenderer.tsx`
- Create: `packages/renderer/src/__tests__/CharacterRenderer.test.tsx`
- Modify: `packages/renderer/src/index.ts`

- [ ] **Step 1: Write failing tests for `CharacterRenderer`**

Create `packages/renderer/src/__tests__/CharacterRenderer.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { CharacterRenderer } from '../CharacterRenderer'
import type { CharacterManifest } from '@buddy/types'

vi.mock('../SpriteCanvas', () => ({
  SpriteCanvas: () => <div data-testid="sprite-canvas" />,
}))
vi.mock('../LottieCanvas', () => ({
  LottieCanvas: () => <div data-testid="lottie-canvas" />,
}))
vi.mock('@rive-app/react-canvas', () => ({
  useRive: () => ({ rive: null, RiveComponent: () => <canvas data-testid="rive-canvas" /> }),
  useStateMachineInput: () => null,
}))

const spriteChar: CharacterManifest = {
  id: 'fox', name: 'Fox', type: 'sprite', personality: 'p', palette: ['#f00', '#0f0'],
}
const lottieChar: CharacterManifest = {
  id: 'cat', name: 'Cat', type: 'lottie', personality: 'p', palette: ['#00f', '#ff0'],
}

describe('CharacterRenderer', () => {
  it('renders SpriteCanvas for sprite characters', () => {
    const { getByTestId } = render(
      <CharacterRenderer character={spriteChar} state="idle" size={120} />
    )
    expect(getByTestId('sprite-canvas')).toBeTruthy()
  })

  it('renders LottieCanvas for lottie characters', () => {
    const { getByTestId } = render(
      <CharacterRenderer character={lottieChar} state="idle" size={120} />
    )
    expect(getByTestId('lottie-canvas')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```
cd packages/renderer && pnpm test
```

Expected: FAIL — `CharacterRenderer` not found

- [ ] **Step 3: Implement `CharacterRenderer`**

Create `packages/renderer/src/CharacterRenderer.tsx`:

```typescript
import type { AvatarState, CharacterManifest } from '@buddy/types'
import { SpriteCanvas } from './SpriteCanvas'
import { LottieCanvas } from './LottieCanvas'

interface Props {
  character: CharacterManifest
  state: AvatarState
  size: number
  onStateComplete?: () => void
}

export function CharacterRenderer({ character, ...rest }: Props) {
  if (character.type === 'sprite') return <SpriteCanvas character={character} {...rest} />
  return <LottieCanvas character={character} {...rest} />
}
```

- [ ] **Step 4: Export all new components from renderer index**

Replace `packages/renderer/src/index.ts` with:

```typescript
export { BuddyCanvas } from './BuddyCanvas'
export { SpriteCanvas } from './SpriteCanvas'
export { LottieCanvas } from './LottieCanvas'
export { CharacterRenderer } from './CharacterRenderer'
```

- [ ] **Step 5: Run all renderer tests**

```
cd packages/renderer && pnpm test
```

Expected: all PASS

- [ ] **Step 6: Commit**

```bash
git add packages/renderer/src/CharacterRenderer.tsx packages/renderer/src/__tests__/CharacterRenderer.test.tsx packages/renderer/src/index.ts
git commit -m "feat: add CharacterRenderer switch component and update exports"
```

---

## Task 5: Add `stopReacting` to `useBuddy`

**Files:**
- Modify: `apps/desktop/src/hooks/useBuddy.ts`

- [ ] **Step 1: Add `stopReacting` to `useBuddy`**

In `apps/desktop/src/hooks/useBuddy.ts`, add after the `stopWalking` declaration (line 89):

```typescript
const stopReacting = useCallback(() => sm.current!.finishReacting(), [])
```

Then in the return statement, add `stopReacting`:

```typescript
return { state, history, thinking, sendMessage, wakeUp, startWalking, stopWalking, stopReacting }
```

- [ ] **Step 2: Typecheck**

```
cd apps/desktop && pnpm typecheck
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/hooks/useBuddy.ts
git commit -m "feat: expose stopReacting from useBuddy for react_happy completion"
```

---

## Task 6: Create character registry and placeholder assets

**Files:**
- Create: `apps/desktop/src/characters/registry.ts`
- Create: `apps/desktop/public/assets/characters/pixel-fox/sheet.png` (manual)
- Create: `apps/desktop/public/assets/characters/lottie-cat/idle.json`
- Create: `apps/desktop/public/assets/characters/lottie-cat/walk.json`

- [ ] **Step 1: Create the characters directory and registry**

Create `apps/desktop/src/characters/registry.ts`:

```typescript
import type { CharacterManifest } from '@buddy/types'

export const CHARACTERS: CharacterManifest[] = [
  {
    id: 'pixel-fox',
    name: 'Foxy',
    type: 'sprite',
    personality: 'Eres Foxy, un zorro amigable y curioso. Responde en español, máximo 2-3 oraciones.',
    palette: ['#FF6B35', '#F7C59F'],
    sheet: '/assets/characters/pixel-fox/sheet.png',
    frameWidth: 48,
    frameHeight: 48,
    fps: 8,
    states: {
      idle: { row: 0, frames: 4 },
      walk: { row: 1, frames: 8 },
      talk: { row: 2, frames: 4 },
      sleep: { row: 3, frames: 2 },
    },
  },
  {
    id: 'lottie-cat',
    name: 'Kitti',
    type: 'lottie',
    personality: 'Eres Kitti, una gata elegante y curiosa. Responde en español, máximo 2-3 oraciones.',
    palette: ['#8B5CF6', '#C4B5FD'],
    clips: {
      idle: '/assets/characters/lottie-cat/idle.json',
      walk: '/assets/characters/lottie-cat/walk.json',
      talk: '/assets/characters/lottie-cat/idle.json',
      sleep: '/assets/characters/lottie-cat/idle.json',
    },
  },
]

export function findCharacter(id: string): CharacterManifest {
  return CHARACTERS.find(c => c.id === id) ?? CHARACTERS[0]
}
```

- [ ] **Step 2: Add placeholder Lottie JSON clips**

Create `apps/desktop/public/assets/characters/lottie-cat/idle.json`:

```json
{
  "v": "5.7.4",
  "fr": 24,
  "ip": 0,
  "op": 48,
  "w": 120,
  "h": 120,
  "nm": "idle",
  "ddd": 0,
  "assets": [],
  "layers": [
    {
      "ddd": 0,
      "ind": 1,
      "ty": 4,
      "nm": "cat",
      "sr": 1,
      "ks": {
        "o": { "a": 0, "k": 100 },
        "p": { "a": 0, "k": [60, 60, 0] },
        "s": { "a": 1, "k": [
          { "t": 0,  "s": [100, 100, 100] },
          { "t": 12, "s": [100, 105, 100] },
          { "t": 24, "s": [100, 100, 100] },
          { "t": 36, "s": [100, 95, 100] },
          { "t": 48, "s": [100, 100, 100] }
        ]}
      },
      "shapes": [
        {
          "ty": "gr",
          "it": [
            { "ty": "el", "s": { "a": 0, "k": [60, 60] }, "p": { "a": 0, "k": [0, 0] } },
            { "ty": "fl", "c": { "a": 0, "k": [0.545, 0.361, 0.965, 1] }, "o": { "a": 0, "k": 100 } }
          ]
        }
      ],
      "ip": 0,
      "op": 48,
      "st": 0
    }
  ]
}
```

Create `apps/desktop/public/assets/characters/lottie-cat/walk.json` with a different animation:

```json
{
  "v": "5.7.4",
  "fr": 24,
  "ip": 0,
  "op": 24,
  "w": 120,
  "h": 120,
  "nm": "walk",
  "ddd": 0,
  "assets": [],
  "layers": [
    {
      "ddd": 0,
      "ind": 1,
      "ty": 4,
      "nm": "cat-walk",
      "sr": 1,
      "ks": {
        "o": { "a": 0, "k": 100 },
        "p": { "a": 1, "k": [
          { "t": 0,  "s": [55, 60, 0] },
          { "t": 12, "s": [65, 60, 0] },
          { "t": 24, "s": [55, 60, 0] }
        ]},
        "s": { "a": 0, "k": [100, 100, 100] }
      },
      "shapes": [
        {
          "ty": "gr",
          "it": [
            { "ty": "el", "s": { "a": 0, "k": [60, 60] }, "p": { "a": 0, "k": [0, 0] } },
            { "ty": "fl", "c": { "a": 0, "k": [0.545, 0.361, 0.965, 1] }, "o": { "a": 0, "k": 100 } }
          ]
        }
      ],
      "ip": 0,
      "op": 24,
      "st": 0
    }
  ]
}
```

- [ ] **Step 3: Create the pixel-fox asset directory**

```bash
mkdir -p apps/desktop/public/assets/characters/pixel-fox
```

> **Note:** `pixel-fox/sheet.png` must be placed manually. Download a free sprite sheet from **kenney.nl/assets/animal-pack** (or similar). The sheet must be a PNG where each row is one animation, each frame is 48×48px. Place it at `apps/desktop/public/assets/characters/pixel-fox/sheet.png`. Until then, the `SpriteCanvas` will show the emoji fallback, which is fine.

- [ ] **Step 4: Commit what exists**

```bash
git add apps/desktop/src/characters/registry.ts apps/desktop/public/assets/characters/lottie-cat/
git commit -m "feat: add character registry and placeholder Lottie assets"
```

---

## Task 7: Create `CharacterPicker` UI

**Files:**
- Create: `apps/desktop/src/CharacterPicker.tsx`

- [ ] **Step 1: Create `CharacterPicker`**

Create `apps/desktop/src/CharacterPicker.tsx`:

```typescript
import type { CharacterManifest } from '@buddy/types'

interface Props {
  characters: CharacterManifest[]
  currentId: string
  onSelect: (character: CharacterManifest) => void
  onClose: () => void
}

export function CharacterPicker({ characters, currentId, onSelect, onClose }: Props) {
  return (
    <div style={{
      width: '100%', height: '100%',
      background: 'rgba(20,20,30,0.95)',
      borderRadius: 16, padding: 12, color: '#fff',
      fontFamily: 'system-ui', fontSize: 13,
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      display: 'flex', flexDirection: 'column',
      boxSizing: 'border-box',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>
          Elige personaje
        </span>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '2px 4px' }}
        >×</button>
      </div>

      <div style={{
        flex: 1, overflowY: 'auto',
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
      }}>
        {characters.map(char => {
          const isActive = char.id === currentId
          return (
            <button
              key={char.id}
              onClick={() => { onSelect(char); onClose() }}
              style={{
                background: isActive ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)',
                border: `2px solid ${isActive ? char.palette[0] : 'transparent'}`,
                borderRadius: 10,
                padding: '10px 6px',
                cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                color: '#fff', fontFamily: 'system-ui', fontSize: 12,
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.07)' }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
            >
              <div style={{
                width: 48, height: 48,
                borderRadius: 8,
                background: `linear-gradient(135deg, ${char.palette[0]}, ${char.palette[1]})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 28,
              }}>
                {char.type === 'sprite' ? '🦊' : '🐱'}
              </div>
              <span style={{ color: isActive ? char.palette[0] : '#d1d5db' }}>{char.name}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
```

> **Note:** The placeholder previews use emoji in a colored gradient. Once real assets are in place, these can be replaced with actual thumbnail images per character.

- [ ] **Step 2: Typecheck**

```
cd apps/desktop && pnpm typecheck
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/CharacterPicker.tsx
git commit -m "feat: add CharacterPicker grid UI"
```

---

## Task 8: Update `ContextMenu` to add "Cambiar personaje…"

**Files:**
- Modify: `apps/desktop/src/ContextMenu.tsx`

- [ ] **Step 1: Update `ContextMenu` props interface and add menu item**

Replace the full contents of `apps/desktop/src/ContextMenu.tsx` with:

```typescript
import { useEffect } from 'react'

interface Props {
  x: number
  y: number
  isAnchored: boolean
  onToggleAnchor: () => void
  onOpenSettings: () => void
  onOpenPicker: () => void
  onClose: () => void
}

const item: React.CSSProperties = {
  width: '100%', background: 'none', border: 'none',
  color: '#e5e7eb', cursor: 'pointer', padding: '7px 14px',
  textAlign: 'left', fontSize: 13, fontFamily: 'system-ui',
}

export function ContextMenu({ x, y, isAnchored, onToggleAnchor, onOpenSettings, onOpenPicker, onClose }: Props) {
  useEffect(() => {
    const close = () => onClose()
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [onClose])

  return (
    <div
      onMouseDown={e => e.stopPropagation()}
      style={{
        position: 'absolute', left: x, top: y, zIndex: 100,
        background: 'rgba(15,15,25,0.97)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 8, padding: '4px 0', minWidth: 148,
        boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
        fontFamily: 'system-ui',
      }}
    >
      <button
        style={item}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
        onClick={() => { onOpenPicker(); onClose() }}
      >
        Cambiar personaje…
      </button>
      <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '3px 0' }} />
      <button
        style={item}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
        onClick={() => { onToggleAnchor(); onClose() }}
      >
        {isAnchored ? 'Desanclar' : 'Anclar'}
      </button>
      <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '3px 0' }} />
      <button
        style={item}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
        onClick={() => { onOpenSettings(); onClose() }}
      >
        Personalidad…
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

```
cd apps/desktop && pnpm typecheck
```

Expected: TS error about missing `onOpenPicker` prop in `BuddyOverlay.tsx` — that's expected, will be fixed in Task 9.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/ContextMenu.tsx
git commit -m "feat: add Cambiar personaje item to context menu"
```

---

## Task 9: Wire everything in `BuddyOverlay`

**Files:**
- Modify: `apps/desktop/src/BuddyOverlay.tsx`

- [ ] **Step 1: Update imports at the top of `BuddyOverlay.tsx`**

Replace the existing import block with:

```typescript
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
```

- [ ] **Step 2: Add character persistence helpers and state**

After the existing `HISTORY_KEY` / `MAX_HISTORY` constants (around line 40), add:

```typescript
const CHAR_KEY = 'buddy-character'

function loadSavedCharacter() {
  try {
    const id = localStorage.getItem(CHAR_KEY)
    if (id) return findCharacter(id)
  } catch {}
  return null
}
```

Inside the `BuddyOverlay` function, after the existing `const [isAnchored, setIsAnchored] = useState(false)` line, add:

```typescript
const [pickerOpen, setPickerOpen] = useState(false)
const [currentCharacter, setCurrentCharacter] = useState(
  () => loadSavedCharacter() ?? CHARACTERS[0]
)
```

- [ ] **Step 3: Update `useBuddy` destructure to include `stopReacting`**

Find the line:

```typescript
const { state, history, thinking, sendMessage, wakeUp, startWalking, stopWalking } = useBuddy(avatar, initialHistory)
```

Replace with:

```typescript
const { state, history, thinking, sendMessage, wakeUp, startWalking, stopWalking, stopReacting } = useBuddy(avatar, initialHistory)
```

- [ ] **Step 4: Add `handleSelectCharacter` callback**

After `handleToggleAnchor`, add:

```typescript
const handleSelectCharacter = useCallback((char: typeof CHARACTERS[0]) => {
  setCurrentCharacter(char)
  setAvatarConfig({ name: char.name, personality: char.personality })
  try {
    localStorage.setItem(CHAR_KEY, char.id)
    localStorage.setItem(CONFIG_KEY, JSON.stringify({ name: char.name, personality: char.personality }))
  } catch {}
}, [])
```

- [ ] **Step 5: Update `handleContextMenu` clamping for the wider menu**

The context menu now has 3 items + 2 separators, height ~130px. Update the clamp:

```typescript
const handleContextMenu = useCallback((e: React.MouseEvent) => {
  e.preventDefault()
  e.stopPropagation()
  const MENU_W = 152, MENU_H = 130
  const x = Math.min(e.clientX, WIN_W - MENU_W)
  const y = Math.min(e.clientY, WIN_H - MENU_H)
  setContextMenu({ x, y })
}, [])
```

- [ ] **Step 6: Add picker panel slot in the JSX return**

In the JSX, after the existing `{settingsOpen && ...}` block, add:

```tsx
{pickerOpen && (
  <div style={panelSlot}>
    <CharacterPicker
      characters={CHARACTERS}
      currentId={currentCharacter.id}
      onSelect={handleSelectCharacter}
      onClose={() => setPickerOpen(false)}
    />
  </div>
)}
```

- [ ] **Step 7: Update `ContextMenu` call to pass `onOpenPicker`**

Find the `<ContextMenu` usage and add `onOpenPicker`:

```tsx
<ContextMenu
  x={contextMenu.x}
  y={contextMenu.y}
  isAnchored={isAnchored}
  onToggleAnchor={handleToggleAnchor}
  onOpenSettings={() => { setSettingsOpen(true); setChatOpen(false); setPickerOpen(false) }}
  onOpenPicker={() => { setPickerOpen(true); setChatOpen(false); setSettingsOpen(false) }}
  onClose={() => setContextMenu(null)}
/>
```

- [ ] **Step 8: Replace `<BuddyCanvas>` with `<CharacterRenderer>`**

Find:

```tsx
<BuddyCanvas
  riveFile={DEFAULT_AVATAR.riveFile}
  stateMachine={DEFAULT_AVATAR.stateMachine}
  state={state}
  size={SPRITE}
/>
```

Replace with:

```tsx
<CharacterRenderer
  character={currentCharacter}
  state={state}
  size={SPRITE}
  onStateComplete={stopReacting}
/>
```

- [ ] **Step 9: Remove unused `BuddyCanvas` import**

Remove `BuddyCanvas` from the `@buddy/renderer` import line (it's no longer used directly).

- [ ] **Step 10: Typecheck**

```
cd apps/desktop && pnpm typecheck
```

Expected: no errors

- [ ] **Step 11: Run all renderer tests**

```
cd packages/renderer && pnpm test
```

Expected: all PASS

- [ ] **Step 12: Commit**

```bash
git add apps/desktop/src/BuddyOverlay.tsx
git commit -m "feat: wire CharacterRenderer and CharacterPicker into BuddyOverlay"
```

---

## Task 10: Manual smoke test

> Run the app and verify the full flow end to end.

- [ ] **Step 1: Start the app**

```
cd apps/desktop && pnpm dev
```

- [ ] **Step 2: Verify Lottie character works**

Right-click the avatar → "Cambiar personaje…" → select "Kitti". The avatar should show the purple circle bouncing (placeholder Lottie animation). Walk, chat, and verify state changes update the animation.

- [ ] **Step 3: Verify character persistence**

Close the app and reopen. Kitti should still be selected.

- [ ] **Step 4: Verify personality overwrite**

After selecting Kitti, open "Personalidad…" — the name and personality should match Kitti's defaults.

- [ ] **Step 5: Verify emoji fallback for sprite character**

Select "Foxy". Without a real `sheet.png`, the fox emoji fallback should render. Place a real spritesheet at `apps/desktop/public/assets/characters/pixel-fox/sheet.png` (see Task 6, Step 3) to see real pixel art animation.

- [ ] **Step 6: Commit final clean-up if any**

```bash
git add -p
git commit -m "chore: character switching smoke test fixes"
```
