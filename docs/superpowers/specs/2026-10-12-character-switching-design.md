# Character Switching — Design Spec

**Date:** 2026-10-12  
**Project:** Buddy Desktop (Tauri 2 + React 19)

---

## Overview

Add a multi-character system to Buddy. The app ships with a curated catalog of animated characters (3–5 at launch). Users pick a character via "Cambiar personaje…" in the right-click context menu. Each character brings its own animations and a default personality prompt, which silently overwrites the current personality on switch.

---

## Character Formats

Two animation formats are supported, allowing pixel-art retro characters and modern vector characters to coexist:

**Sprite sheets** — A single PNG where each row is one animation state, columns are frames. Rendered via an HTML5 Canvas RAF loop at a configurable fps. Best for pixel art (48–64px frame size, ~8 fps).

**Lottie** — Per-state `.json` files exported from After Effects / LottieFiles. Rendered via `lottie-react`. Each state loads its own clip; looping states (`idle`, `walk`, `talk`) loop indefinitely; one-shot states (`react_happy`) fire once then return to `idle` via an `onComplete` callback. Best for modern vector characters (transparent background, any size).

States that have no clip or row configured fall back to `idle` silently.

---

## Character Manifest

Defined in `packages/types/src/index.ts`:

```typescript
export type BuddyState = 'idle' | 'walk' | 'talk' | 'think' | 'react_happy' | 'sleep'

export interface CharacterManifest {
  id: string
  name: string
  type: 'sprite' | 'lottie'
  personality: string          // default system prompt
  palette: [string, string]    // [primary, secondary] accent colors

  // sprite only
  sheet?: string               // e.g. '/assets/characters/fox/sheet.png'
  frameWidth?: number
  frameHeight?: number
  fps?: number
  states?: Partial<Record<BuddyState, { row: number; frames: number }>>

  // lottie only
  clips?: Partial<Record<BuddyState, string>>  // e.g. '/assets/characters/cat/walk.json'
}
```

The existing `Avatar` type remains unchanged — `CharacterManifest` is a parallel concept used only by the renderer layer.

---

## Character Registry

File: `apps/desktop/src/characters/registry.ts`

Exports a `CHARACTERS: CharacterManifest[]` array. Launch catalog (3–4 characters):

| id | name | type | source |
|----|------|------|--------|
| `pixel-fox` | Foxy | sprite | Kenney Animal Pack |
| `pixel-wolf` | Wolf | sprite | Kenney RPG Urban Pack |
| `lottie-cat` | Kitti | lottie | LottieFiles free |
| `clippy-bot` | Clippy | lottie | LottieFiles free |

Assets live in `apps/desktop/public/assets/characters/<id>/`.

---

## Renderers

All renderers share the same props interface:

```typescript
interface RendererProps {
  state: BuddyState
  character: CharacterManifest
  size: number          // always SPRITE = 120
  onStateComplete?: () => void   // fired by one-shot states
}
```

**`SpriteCanvas`** — `packages/renderer/src/SpriteCanvas.tsx`  
HTML5 `<canvas>` element. Preloads the spritesheet `Image` on mount. RAF loop advances `frameIndex` at the character's `fps`. On state change resets to frame 0 of the new row. Scales the frame to `size × size` via `drawImage`. Falls back to emoji if the image fails to load.

**`LottieCanvas`** — `packages/renderer/src/LottieCanvas.tsx`  
Wraps `lottie-react`'s `<Lottie>` component. Loads `animationData` by fetching the clip JSON for the current state (falls back to idle clip). Passes `loop={isLoopingState}` and `onComplete={onStateComplete}` for one-shot states.

**`CharacterRenderer`** — `packages/renderer/src/CharacterRenderer.tsx`  
Thin switch: renders `SpriteCanvas` for `type === 'sprite'`, `LottieCanvas` for `type === 'lottie'`. Falls back to the existing `BuddyCanvas` (emoji) if no matching character is found.

`BuddyCanvas` is kept as-is for the emoji fallback path; it is no longer the primary renderer.

---

## Character Picker UI

File: `apps/desktop/src/CharacterPicker.tsx`

Renders in the `panelSlot` (same slot as `ChatBubble` and `SettingsPanel`, below the avatar). Triggered by "Cambiar personaje…" in the context menu; closes the other panels when opened.

Layout: 2-column grid of character cards. Each card shows a static thumbnail (first frame of spritesheet or a preview image for Lottie) + the character name. The active character card has a colored border using its `palette[0]`.

Selecting a card:
1. Sets `currentCharacter` state in `BuddyOverlay`
2. Overwrites `avatarConfig.personality` with `character.personality` (silent)
3. Saves `buddy-character` and `buddy-avatar-config` to localStorage
4. Closes the picker

---

## Context Menu Update

Add "Cambiar personaje…" as the first item:

```
Cambiar personaje…
──────────────────
Anclar / Desanclar
──────────────────
Personalidad…
```

---

## BuddyOverlay Integration

New state:
```typescript
const [currentCharacter, setCurrentCharacter] = useState<CharacterManifest>(
  () => loadSavedCharacter() ?? CHARACTERS[0]
)
const [pickerOpen, setPickerOpen] = useState(false)
```

`loadSavedCharacter()` reads `localStorage.getItem('buddy-character')` and finds the matching entry in `CHARACTERS[]`.

`<BuddyCanvas>` is replaced by `<CharacterRenderer character={currentCharacter} state={state} size={SPRITE} onStateComplete={...} />`.

On character select, the `react_happy` `onStateComplete` callback calls `stopReacting()` (new export from `useBuddy`) to return to idle.

---

## Persistence

| Key | Value |
|-----|-------|
| `buddy-character` | `CharacterManifest.id` string |
| `buddy-avatar-config` | `{ name, personality }` JSON (already exists) |
| `buddy-pos` | window position (already exists) |
| `buddy-history` | chat history (already exists) |

---

## New Dependencies

- `lottie-react` — added to `apps/desktop/package.json`

---

## Error Handling

- Sprite image fails to load → fall back to emoji `BuddyCanvas`
- Lottie clip JSON 404 → fall back to idle clip; if idle also fails, fall back to emoji
- `buddy-character` localStorage value not in registry → use `CHARACTERS[0]`

---

## Out of Scope

- User-installable characters (characters are bundled only)
- Downloading characters at runtime
- Character-specific sound effects
- Transition animations between characters
- Rive format support (deferred — not enough free assets available)
