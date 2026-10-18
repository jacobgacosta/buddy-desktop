# Behavior Engine + Sensory Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar sensores (mic, teclado/mouse, hora), un motor de mood LLM-driven con fallback determinístico, traducción mood→movimiento, y física orgánica con easing/fidgets, todo sin latencia en el renderer.

**Architecture:** Hybrid event-driven: Rust recolecta sensores y emite snapshots cada 5s vía Tauri event; TypeScript detecta triggers significativos y llama POST /mood en buddy-server; buddy-server llama LM Studio con JSON Schema garantizado; BehaviorEngine traduce Mood a BehaviorParams que el physics loop consume directamente.

**Tech Stack:** Rust (cpal, rdev, Tauri 2, Axum), TypeScript (React 19, vitest), LM Studio @ 192.168.5.1:1234, Qwen2.5-3B para mood decisions.

---

## Mapa de archivos

| Archivo | Acción | Responsabilidad |
|---------|--------|-----------------|
| `packages/core/src/math-utils.ts` | CREAR | gaussian(), smoothstep() |
| `packages/core/src/sensor-bus.ts` | CREAR | SensorSnapshot types + classifyInput |
| `packages/core/src/mood-engine.ts` | CREAR | Mood types, fallbackMood, detectTrigger, MoodEngine |
| `packages/core/src/behavior-engine.ts` | CREAR | BehaviorParams, moodToParams |
| `packages/core/src/index.ts` | MODIFICAR | re-exportar todo lo nuevo |
| `packages/core/src/__tests__/math-utils.test.ts` | CREAR | tests vitest |
| `packages/core/src/__tests__/sensor-bus.test.ts` | CREAR | tests vitest |
| `packages/core/src/__tests__/mood-engine.test.ts` | CREAR | tests vitest |
| `packages/core/src/__tests__/behavior-engine.test.ts` | CREAR | tests vitest |
| `apps/desktop/src/physics.ts` | MODIFICAR | isFidget, startPos, easing, gaussian import |
| `server/src/state.rs` | MODIFICAR | MOOD_MODEL env var |
| `server/src/routes/mood.rs` | CREAR | POST /mood con JSON Schema |
| `server/src/routes/mod.rs` | MODIFICAR | pub mod mood |
| `server/src/main.rs` | MODIFICAR | registrar ruta /mood |
| `apps/desktop/src-tauri/Cargo.toml` | MODIFICAR | deps: cpal, rdev |
| `apps/desktop/src-tauri/src/sensors.rs` | CREAR | cpal mic + rdev input + emit cada 5s |
| `apps/desktop/src-tauri/src/main.rs` | MODIFICAR | launch_sensors + set_z_order command |
| `apps/desktop/src/hooks/useSensors.ts` | CREAR | escucha evento sensor-snapshot |
| `apps/desktop/src/hooks/useMood.ts` | CREAR | MoodEngine en hook |
| `apps/desktop/src/BuddyOverlay.tsx` | MODIFICAR | integrar BehaviorParams, fidgets, z_order |

---

### Task 1: Math utils — gaussian y smoothstep

**Files:**
- Create: `packages/core/src/math-utils.ts`
- Create: `packages/core/src/__tests__/math-utils.test.ts`

- [ ] **Step 1: Escribir el test**

```typescript
// packages/core/src/__tests__/math-utils.test.ts
import { describe, it, expect } from 'vitest'
import { gaussian, smoothstep } from '../math-utils'

describe('smoothstep', () => {
  it('returns 0 at t=0', () => expect(smoothstep(0)).toBe(0))
  it('returns 1 at t=1', () => expect(smoothstep(1)).toBe(1))
  it('returns 0.5 at t=0.5', () => expect(smoothstep(0.5)).toBe(0.5))
  it('is monotonically increasing', () => {
    expect(smoothstep(0.3)).toBeLessThan(smoothstep(0.6))
  })
})

describe('gaussian', () => {
  it('returns a number near the mean over many samples', () => {
    const samples = Array.from({ length: 1000 }, () => gaussian(100, 10))
    const avg = samples.reduce((a, b) => a + b, 0) / samples.length
    expect(avg).toBeGreaterThan(85)
    expect(avg).toBeLessThan(115)
  })
  it('never returns below floor (20% of mean)', () => {
    for (let i = 0; i < 500; i++) {
      expect(gaussian(100, 40)).toBeGreaterThan(20)
    }
  })
})
```

- [ ] **Step 2: Verificar que falla**

```
cd packages/core && pnpm test
```
Expected: FAIL — `math-utils` not found

- [ ] **Step 3: Implementar math-utils.ts**

```typescript
// packages/core/src/math-utils.ts
export function smoothstep(t: number): number {
  const c = Math.max(0, Math.min(1, t))
  return c * c * (3 - 2 * c)
}

export function gaussian(mean: number, std: number): number {
  const u1 = Math.random() || 1e-10
  const u2 = Math.random()
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
  return Math.max(mean * 0.2, mean + std * z)
}
```

- [ ] **Step 4: Verificar que pasa**

```
cd packages/core && pnpm test
```
Expected: PASS (todos los tests de math-utils)

- [ ] **Step 5: Commit**

```
git add packages/core/src/math-utils.ts packages/core/src/__tests__/math-utils.test.ts
git commit -m "feat(core): add gaussian and smoothstep math utils"
```

---

### Task 2: sensor-bus.ts — tipos y clasificación de input

**Files:**
- Create: `packages/core/src/sensor-bus.ts`
- Create: `packages/core/src/__tests__/sensor-bus.test.ts`

- [ ] **Step 1: Escribir el test**

```typescript
// packages/core/src/__tests__/sensor-bus.test.ts
import { describe, it, expect } from 'vitest'
import { classifyInput } from '../sensor-bus'

describe('classifyInput', () => {
  it('returns idle when idleDuration > 2 min', () => {
    expect(classifyInput(200, 150_000)).toBe('idle')
  })
  it('returns heavy when keyRate > 60 and not idle', () => {
    expect(classifyInput(80, 0)).toBe('heavy')
  })
  it('returns light for moderate activity', () => {
    expect(classifyInput(20, 30_000)).toBe('light')
  })
  it('idle takes priority over high key rate', () => {
    expect(classifyInput(200, 130_000)).toBe('idle')
  })
})
```

- [ ] **Step 2: Verificar que falla**

```
cd packages/core && pnpm test
```
Expected: FAIL — `sensor-bus` not found

- [ ] **Step 3: Implementar sensor-bus.ts**

```typescript
// packages/core/src/sensor-bus.ts
export type InputLevel = 'idle' | 'light' | 'heavy'

export interface SensorSnapshot {
  timestamp: number
  mic: {
    active: boolean
    level: number       // 0-1 RMS volume
  }
  input: {
    keyRate: number     // keypresses/min in last 60s
    mouseDistance: number
    level: InputLevel
    idleDuration: number // ms since last input
  }
  time: {
    hour: number
    isNight: boolean    // 22h-6h
    isWeekend: boolean
  }
}

export function classifyInput(keyRate: number, idleDuration: number): InputLevel {
  if (idleDuration > 120_000) return 'idle'
  if (keyRate > 60) return 'heavy'
  return 'light'
}
```

- [ ] **Step 4: Verificar que pasa**

```
cd packages/core && pnpm test
```
Expected: PASS

- [ ] **Step 5: Commit**

```
git add packages/core/src/sensor-bus.ts packages/core/src/__tests__/sensor-bus.test.ts
git commit -m "feat(core): add sensor-bus types and input classifier"
```

---

### Task 3: mood-engine.ts — fallback, triggers y MoodEngine

**Files:**
- Create: `packages/core/src/mood-engine.ts`
- Create: `packages/core/src/__tests__/mood-engine.test.ts`

- [ ] **Step 1: Escribir el test**

```typescript
// packages/core/src/__tests__/mood-engine.test.ts
import { describe, it, expect } from 'vitest'
import { fallbackMood, detectTrigger } from '../mood-engine'
import type { SensorSnapshot } from '../sensor-bus'

const snap = (overrides: {
  inputLevel?: 'idle' | 'light' | 'heavy'
  idleDuration?: number
  micActive?: boolean
  hour?: number
} = {}): SensorSnapshot => ({
  timestamp: Date.now(),
  mic: { active: overrides.micActive ?? false, level: 0 },
  input: {
    keyRate: 0, mouseDistance: 0,
    level: overrides.inputLevel ?? 'light',
    idleDuration: overrides.idleDuration ?? 0,
  },
  time: { hour: overrides.hour ?? 10, isNight: false, isWeekend: false },
})

describe('fallbackMood', () => {
  it('playful at 16h', () => expect(fallbackMood(16).name).toBe('playful'))
  it('sleepy at 23h', () => expect(fallbackMood(23).name).toBe('sleepy'))
  it('sleepy at 3h', ()  => expect(fallbackMood(3).name).toBe('sleepy'))
  it('tired at 14h',  () => expect(fallbackMood(14).name).toBe('tired'))
  it('curious at 10h', () => expect(fallbackMood(10).name).toBe('curious'))
  it('expiresAt is in the future', () => {
    expect(fallbackMood(10).expiresAt).toBeGreaterThan(Date.now())
  })
})

describe('detectTrigger', () => {
  const activeMood = { ...fallbackMood(10), expiresAt: Date.now() + 999_999 }
  const expiredMood = { ...fallbackMood(10), expiresAt: Date.now() - 1 }

  it('mood_expired when TTL passed', () => {
    expect(detectTrigger(null, snap(), expiredMood)).toBe('mood_expired')
  })
  it('null when prev is null and mood is active', () => {
    expect(detectTrigger(null, snap(), activeMood)).toBeNull()
  })
  it('user_went_idle when idle > 5 min', () => {
    const prev = snap({ inputLevel: 'heavy', idleDuration: 0 })
    const curr = snap({ inputLevel: 'light', idleDuration: 310_000 })
    expect(detectTrigger(prev, curr, activeMood)).toBe('user_went_idle')
  })
  it('user_returned when idle→heavy', () => {
    const prev = snap({ inputLevel: 'idle', idleDuration: 600_000 })
    const curr = snap({ inputLevel: 'heavy', idleDuration: 0 })
    expect(detectTrigger(prev, curr, activeMood)).toBe('user_returned')
  })
  it('voice_activity when mic turns on', () => {
    const prev = snap({ micActive: false })
    const curr = snap({ micActive: true })
    expect(detectTrigger(prev, curr, activeMood)).toBe('voice_activity')
  })
  it('null when nothing significant changed', () => {
    const prev = snap({ inputLevel: 'light', idleDuration: 1000 })
    const curr = snap({ inputLevel: 'light', idleDuration: 5000 })
    expect(detectTrigger(prev, curr, activeMood)).toBeNull()
  })
})
```

- [ ] **Step 2: Verificar que falla**

```
cd packages/core && pnpm test
```
Expected: FAIL — `mood-engine` not found

- [ ] **Step 3: Implementar mood-engine.ts**

```typescript
// packages/core/src/mood-engine.ts
import type { SensorSnapshot } from './sensor-bus'

export type MoodName    = 'playful' | 'focused' | 'tired' | 'curious' | 'calm' | 'sleepy'
export type ZOrder      = 'top' | 'normal' | 'behind'
export type EnergyLevel = 'very_low' | 'low' | 'medium' | 'high' | 'very_high'
export type RestLevel   = 'still' | 'slow' | 'normal' | 'active' | 'restless'

export interface Mood {
  name: MoodName
  energy: EnergyLevel
  restlessness: RestLevel
  zOrder: ZOrder
  expiresAt: number
}

export type MoodTrigger =
  | 'user_went_idle'
  | 'user_returned'
  | 'voice_activity'
  | 'time_shift'
  | 'mood_expired'

const MOOD_TTL = 10 * 60 * 1000

interface FallbackRow {
  from: number; to: number
  name: MoodName; energy: EnergyLevel; restlessness: RestLevel; zOrder: ZOrder
}

const FALLBACK_TABLE: FallbackRow[] = [
  { from: 6,  to: 9,  name: 'calm',    energy: 'low',      restlessness: 'slow',    zOrder: 'normal' },
  { from: 9,  to: 13, name: 'curious', energy: 'medium',   restlessness: 'normal',  zOrder: 'top'    },
  { from: 13, to: 15, name: 'tired',   energy: 'very_low', restlessness: 'still',   zOrder: 'normal' },
  { from: 15, to: 19, name: 'playful', energy: 'high',     restlessness: 'active',  zOrder: 'top'    },
  { from: 19, to: 22, name: 'calm',    energy: 'medium',   restlessness: 'slow',    zOrder: 'normal' },
  { from: 22, to: 6,  name: 'sleepy',  energy: 'very_low', restlessness: 'still',   zOrder: 'normal' },
]

export function fallbackMood(hour: number): Mood {
  const row = FALLBACK_TABLE.find(r =>
    r.from < r.to ? hour >= r.from && hour < r.to : hour >= r.from || hour < r.to
  ) ?? FALLBACK_TABLE[0]
  return { name: row.name, energy: row.energy, restlessness: row.restlessness, zOrder: row.zOrder, expiresAt: Date.now() + MOOD_TTL }
}

export function detectTrigger(
  prev: SensorSnapshot | null,
  curr: SensorSnapshot,
  mood: Mood,
): MoodTrigger | null {
  if (mood.expiresAt < Date.now()) return 'mood_expired'
  if (!prev) return null
  if (prev.input.level !== 'idle' && curr.input.idleDuration > 5 * 60_000) return 'user_went_idle'
  if (prev.input.level === 'idle' && curr.input.level === 'heavy') return 'user_returned'
  if (!prev.mic.active && curr.mic.active) return 'voice_activity'
  const BOUNDARIES = [6, 13, 18, 22]
  if (BOUNDARIES.includes(curr.time.hour) && curr.time.hour !== prev.time.hour) return 'time_shift'
  return null
}

export class MoodEngine {
  private current: Mood
  private prev: SensorSnapshot | null = null
  private lastCallAt = 0
  private readonly MIN_INTERVAL = 2 * 60 * 1000

  constructor(private readonly serverUrl: string) {
    this.current = fallbackMood(new Date().getHours())
  }

  get mood(): Mood { return this.current }

  async update(snapshot: SensorSnapshot): Promise<Mood> {
    const trigger = detectTrigger(this.prev, snapshot, this.current)
    this.prev = snapshot
    const now = Date.now()
    if (trigger && now - this.lastCallAt > this.MIN_INTERVAL) {
      this.lastCallAt = now
      try {
        this.current = await this.fetchMood(snapshot)
      } catch {
        this.current = fallbackMood(snapshot.time.hour)
      }
    }
    return this.current
  }

  private async fetchMood(s: SensorSnapshot): Promise<Mood> {
    const resp = await fetch(`${this.serverUrl}/mood`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hour: s.time.hour,
        is_night: s.time.isNight,
        input_level: s.input.level,
        idle_duration_min: Math.round(s.input.idleDuration / 60_000),
        mic_active: s.mic.active,
        current_mood: this.current.name,
      }),
    })
    if (!resp.ok) throw new Error(`/mood ${resp.status}`)
    const raw = await resp.json() as { mood: MoodName; energy: EnergyLevel; restlessness: RestLevel; z_order: ZOrder }
    return {
      name: raw.mood, energy: raw.energy, restlessness: raw.restlessness,
      zOrder: raw.z_order, expiresAt: Date.now() + MOOD_TTL,
    }
  }
}
```

- [ ] **Step 4: Verificar que pasa**

```
cd packages/core && pnpm test
```
Expected: PASS

- [ ] **Step 5: Commit**

```
git add packages/core/src/mood-engine.ts packages/core/src/__tests__/mood-engine.test.ts
git commit -m "feat(core): add mood-engine with fallback and trigger detection"
```

---

### Task 4: behavior-engine.ts — Mood → BehaviorParams

**Files:**
- Create: `packages/core/src/behavior-engine.ts`
- Create: `packages/core/src/__tests__/behavior-engine.test.ts`

- [ ] **Step 1: Escribir el test**

```typescript
// packages/core/src/__tests__/behavior-engine.test.ts
import { describe, it, expect } from 'vitest'
import { moodToParams } from '../behavior-engine'
import { fallbackMood } from '../mood-engine'

const playfulMood = () => ({ ...fallbackMood(16), name: 'playful' as const, energy: 'high' as const, restlessness: 'active' as const })
const focusedMood = () => ({ ...fallbackMood(10), name: 'focused' as const, energy: 'very_low' as const, restlessness: 'still' as const })

describe('moodToParams', () => {
  it('playful has higher speed than focused', () => {
    expect(moodToParams(playfulMood()).walkSpeedPx).toBeGreaterThan(
      moodToParams(focusedMood()).walkSpeedPx
    )
  })
  it('playful has shorter walk frequency than focused', () => {
    expect(moodToParams(playfulMood()).walkFrequencyMs).toBeLessThan(
      moodToParams(focusedMood()).walkFrequencyMs
    )
  })
  it('playful has larger walk radius than focused', () => {
    expect(moodToParams(playfulMood()).walkRadius).toBeGreaterThan(
      moodToParams(focusedMood()).walkRadius
    )
  })
  it('playful enables fidgets', () => {
    expect(moodToParams(playfulMood()).fidgetEnabled).toBe(true)
  })
  it('focused disables fidgets', () => {
    expect(moodToParams(focusedMood()).fidgetEnabled).toBe(false)
  })
  it('all fields are positive numbers', () => {
    const p = moodToParams(playfulMood())
    expect(p.walkFrequencyMs).toBeGreaterThan(0)
    expect(p.walkSpeedPx).toBeGreaterThan(0)
    expect(p.walkRadius).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Verificar que falla**

```
cd packages/core && pnpm test
```
Expected: FAIL — `behavior-engine` not found

- [ ] **Step 3: Implementar behavior-engine.ts**

```typescript
// packages/core/src/behavior-engine.ts
import type { EnergyLevel, RestLevel, Mood } from './mood-engine'

export interface BehaviorParams {
  walkFrequencyMs: number
  walkSpeedPx: number
  walkRadius: number
  fidgetEnabled: boolean
  fidgetIntervalMs: number
  fidgetRadiusPx: number
}

const SPEED: Record<EnergyLevel, number> = {
  very_low: 25, low: 45, medium: 90, high: 130, very_high: 160,
}

const FREQ: Record<EnergyLevel, number> = {
  very_low: 50_000, low: 30_000, medium: 10_000, high: 5_000, very_high: 3_000,
}

const RADIUS: Record<EnergyLevel, number> = {
  very_low: 80, low: 150, medium: 280, high: 380, very_high: 450,
}

const FIDGET: Record<RestLevel, { enabled: boolean; interval: number; radius: number }> = {
  still:    { enabled: false, interval: 0,      radius: 0  },
  slow:     { enabled: false, interval: 0,      radius: 0  },
  normal:   { enabled: true,  interval: 8_000,  radius: 6  },
  active:   { enabled: true,  interval: 4_000,  radius: 10 },
  restless: { enabled: true,  interval: 2_000,  radius: 15 },
}

export function moodToParams(mood: Mood): BehaviorParams {
  const f = FIDGET[mood.restlessness]
  return {
    walkFrequencyMs: FREQ[mood.energy],
    walkSpeedPx:     SPEED[mood.energy],
    walkRadius:      RADIUS[mood.energy],
    fidgetEnabled:   f.enabled,
    fidgetIntervalMs: f.interval,
    fidgetRadiusPx:  f.radius,
  }
}
```

- [ ] **Step 4: Verificar que pasa**

```
cd packages/core && pnpm test
```
Expected: PASS (todos los tests: math-utils, sensor-bus, mood-engine, behavior-engine)

- [ ] **Step 5: Exportar desde index.ts**

```typescript
// packages/core/src/index.ts — reemplazar contenido completo
export { LlmClient } from './llm-client'
export { AvatarStateMachine } from './avatar-state'
export { gaussian, smoothstep } from './math-utils'
export type { SensorSnapshot, InputLevel } from './sensor-bus'
export { classifyInput } from './sensor-bus'
export type { Mood, MoodName, ZOrder, EnergyLevel, RestLevel, MoodTrigger } from './mood-engine'
export { fallbackMood, detectTrigger, MoodEngine } from './mood-engine'
export type { BehaviorParams } from './behavior-engine'
export { moodToParams } from './behavior-engine'
```

- [ ] **Step 6: Typecheck**

```
cd packages/core && pnpm typecheck
```
Expected: sin errores

- [ ] **Step 7: Commit**

```
git add packages/core/src/behavior-engine.ts packages/core/src/__tests__/behavior-engine.test.ts packages/core/src/index.ts
git commit -m "feat(core): add behavior-engine and export all new modules"
```

---

### Task 5: Physics mejorado — easing, isFidget, startPos

**Files:**
- Modify: `apps/desktop/src/physics.ts`

El archivo actual está en `apps/desktop/src/physics.ts`. Reemplazar contenido completo:

- [ ] **Step 1: Reemplazar physics.ts**

```typescript
// apps/desktop/src/physics.ts
import { smoothstep } from '@buddy/core'

export interface Position { x: number; y: number }

export interface PhysicsState {
  pos: Position
  vel: Position
  target: Position | null
  isFidget: boolean
  startPos: Position | null  // saved when target is set, used for easing
}

export function createPhysics(initial: Position): PhysicsState {
  return { pos: initial, vel: { x: 0, y: 0 }, target: null, isFidget: false, startPos: null }
}

const ARRIVE_DIST = 2

export function tickPhysics(
  state: PhysicsState,
  dt: number,
  speed: number,
): PhysicsState {
  const safeDt = Math.min(dt, 0.05)
  const { pos, target, startPos } = state
  if (!target) return { ...state, vel: { x: 0, y: 0 } }

  const dx = target.x - pos.x
  const dy = target.y - pos.y
  const dist = Math.sqrt(dx * dx + dy * dy)

  if (dist < ARRIVE_DIST) {
    return { ...state, pos: target, vel: { x: 0, y: 0 }, target: null, startPos: null }
  }

  // Ease-in/out: use sin curve over progress for organic speed
  const totalDist = startPos
    ? Math.sqrt((target.x - startPos.x) ** 2 + (target.y - startPos.y) ** 2)
    : dist
  const progress = totalDist > 0 ? Math.max(0, Math.min(1, 1 - dist / totalDist)) : 0
  const speedMult = 0.25 + 0.75 * Math.sin(smoothstep(progress) * Math.PI)
  const effectiveSpeed = speed * speedMult

  return {
    ...state,
    pos: {
      x: pos.x + (dx / dist) * effectiveSpeed * safeDt,
      y: pos.y + (dy / dist) * effectiveSpeed * safeDt,
    },
    vel: { x: (dx / dist) * effectiveSpeed, y: (dy / dist) * effectiveSpeed },
  }
}

export function setWalkTarget(state: PhysicsState, target: Position): PhysicsState {
  return { ...state, target, startPos: state.pos }
}

export function randomNearbyTarget(current: Position, radius = 350): Position {
  const angle = Math.random() * 2 * Math.PI
  const dist = 80 + Math.random() * radius
  return {
    x: current.x + Math.cos(angle) * dist,
    y: current.y + Math.sin(angle) * dist,
  }
}
```

- [ ] **Step 2: Typecheck desktop**

```
cd apps/desktop && pnpm typecheck
```
Expected: sin errores (isFidget y startPos son nuevos campos, BuddyOverlay aún no los usa pero el tipo es compatible)

- [ ] **Step 3: Commit**

```
git add apps/desktop/src/physics.ts
git commit -m "feat(physics): add smoothstep easing, isFidget flag, and startPos tracking"
```

---

### Task 6: buddy-server — endpoint POST /mood

**Files:**
- Modify: `server/src/state.rs`
- Create: `server/src/routes/mood.rs`
- Modify: `server/src/routes/mod.rs`
- Modify: `server/src/main.rs`

- [ ] **Step 1: Actualizar state.rs**

```rust
// server/src/state.rs — reemplazar contenido
#[derive(Clone)]
pub struct AppState {
    pub ollama_url: String,
    pub mood_url: String,    // puede ser diferente al chat LLM
    pub avatars_dir: String,
    pub http: reqwest::Client,
}

impl AppState {
    pub fn new() -> Self {
        let ollama_url = std::env::var("OLLAMA_URL")
            .unwrap_or_else(|_| "http://localhost:11434".into());
        // MOOD_URL defaults to same as OLLAMA_URL
        let mood_url = std::env::var("MOOD_URL").unwrap_or_else(|_| ollama_url.clone());
        Self {
            ollama_url,
            mood_url,
            avatars_dir: std::env::var("AVATARS_DIR").unwrap_or_else(|_| "avatars".into()),
            http: reqwest::Client::new(),
        }
    }
}
```

- [ ] **Step 2: Crear mood.rs**

```rust
// server/src/routes/mood.rs
use axum::{extract::State, Json, http::StatusCode};
use serde::{Deserialize, Serialize};
use crate::state::AppState;

#[derive(Deserialize)]
pub struct MoodRequest {
    pub hour: u8,
    pub is_night: bool,
    pub input_level: String,
    pub idle_duration_min: u32,
    pub mic_active: bool,
    pub current_mood: String,
}

#[derive(Serialize, Deserialize)]
pub struct MoodResponse {
    pub mood: String,
    pub energy: String,
    pub restlessness: String,
    pub z_order: String,
}

pub async fn decide_mood(
    State(state): State<AppState>,
    Json(req): Json<MoodRequest>,
) -> Result<Json<MoodResponse>, StatusCode> {
    let model = std::env::var("MOOD_MODEL")
        .unwrap_or_else(|_| "qwen2.5-3b-instruct".into());

    let prompt = format!(
        "You are deciding the mood for a small AI desktop companion. \
        Current context: hour={}, night={}, user_activity={}, idle_minutes={}, \
        voice_active={}, current_mood={}. \
        Pick the most appropriate mood given this context.",
        req.hour, req.is_night, req.input_level,
        req.idle_duration_min, req.mic_active, req.current_mood
    );

    let response_format = serde_json::json!({
        "type": "json_schema",
        "json_schema": {
            "name": "mood_decision",
            "strict": true,
            "schema": {
                "type": "object",
                "properties": {
                    "mood":         { "enum": ["playful","focused","tired","curious","calm","sleepy"] },
                    "energy":       { "enum": ["very_low","low","medium","high","very_high"] },
                    "restlessness": { "enum": ["still","slow","normal","active","restless"] },
                    "z_order":      { "enum": ["top","normal","behind"] }
                },
                "required": ["mood","energy","restlessness","z_order"],
                "additionalProperties": false
            }
        }
    });

    let llm_req = serde_json::json!({
        "model": model,
        "messages": [{ "role": "user", "content": prompt }],
        "response_format": response_format,
        "stream": false
    });

    let resp = state.http
        .post(format!("{}/v1/chat/completions", state.mood_url))
        .json(&llm_req)
        .send()
        .await
        .map_err(|e| { tracing::warn!("mood LLM error: {e}"); StatusCode::BAD_GATEWAY })?;

    if !resp.status().is_success() {
        tracing::warn!("mood LLM status: {}", resp.status());
        return Err(StatusCode::BAD_GATEWAY);
    }

    let body: serde_json::Value = resp.json().await
        .map_err(|_| StatusCode::BAD_GATEWAY)?;

    let content = body["choices"][0]["message"]["content"]
        .as_str()
        .ok_or(StatusCode::BAD_GATEWAY)?;

    let mood: MoodResponse = serde_json::from_str(content)
        .map_err(|e| { tracing::warn!("mood parse error: {e} — content: {content}"); StatusCode::BAD_GATEWAY })?;

    Ok(Json(mood))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mood_response_serializes() {
        let r = MoodResponse {
            mood: "calm".into(),
            energy: "low".into(),
            restlessness: "slow".into(),
            z_order: "normal".into(),
        };
        let j = serde_json::to_string(&r).unwrap();
        assert!(j.contains("calm"));
        assert!(j.contains("z_order"));
    }
}
```

- [ ] **Step 3: Actualizar mod.rs**

```rust
// server/src/routes/mod.rs — reemplazar contenido
pub mod health;
pub mod chat;
pub mod avatars;
pub mod mood;
```

- [ ] **Step 4: Registrar ruta en main.rs**

Agregar `.route("/mood", post(routes::mood::decide_mood))` en el Router. El archivo `server/src/main.rs` queda:

```rust
// server/src/main.rs — reemplazar contenido
#![allow(unused_imports)]

mod routes;
mod state;

use axum::{Router, routing::{get, post}};
use state::AppState;
use tower_http::cors::{CorsLayer, Any};
use tracing_subscriber::EnvFilter;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env())
        .init();

    let state = AppState::new();
    let port = std::env::var("PORT")
        .unwrap_or_else(|_| "7788".into())
        .parse::<u16>()
        .expect("PORT must be a number");

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/health", get(routes::health::health))
        .route("/avatars", get(routes::avatars::list_avatars))
        .route("/chat", post(routes::chat::chat))
        .route("/mood", post(routes::mood::decide_mood))
        .layer(cors)
        .with_state(state);

    let listener = tokio::net::TcpListener::bind(("0.0.0.0", port))
        .await
        .expect("failed to bind");

    tracing::info!("buddy-server listening on :{port}");
    axum::serve(listener, app).await.expect("server error");
}
```

- [ ] **Step 5: Compilar y testear**

```
cd server && cargo test
```
Expected: PASS — `mood_response_serializes` pasa

```
cd server && cargo build
```
Expected: compile exitoso sin errores

- [ ] **Step 6: Commit**

```
git add server/src/state.rs server/src/routes/mood.rs server/src/routes/mod.rs server/src/main.rs
git commit -m "feat(server): add POST /mood endpoint with JSON Schema structured output"
```

---

### Task 7: Tauri sensors — cpal + rdev + set_z_order

**Files:**
- Modify: `apps/desktop/src-tauri/Cargo.toml`
- Create: `apps/desktop/src-tauri/src/sensors.rs`
- Modify: `apps/desktop/src-tauri/src/main.rs`

- [ ] **Step 1: Agregar dependencias en Cargo.toml**

```toml
# apps/desktop/src-tauri/Cargo.toml — reemplazar [dependencies]
[dependencies]
tauri = { version = "2", features = ["tray-icon"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
cpal = "0.15"
rdev = "0.5"
```

- [ ] **Step 2: Crear sensors.rs**

```rust
// apps/desktop/src-tauri/src/sensors.rs
use std::sync::{Arc, Mutex};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use serde::Serialize;
use tauri::{AppHandle, Emitter};

#[derive(Default)]
struct InputState {
    key_timestamps: Vec<u64>,   // timestamps of keypresses in last 60s
    mouse_events: u32,          // mouse move events since last snapshot
    last_input_at: Option<u64>,
    mic_active: bool,
    mic_level: f32,
}

#[derive(Serialize, Clone)]
pub struct SensorPayload {
    pub timestamp: u64,
    pub mic_active: bool,
    pub mic_level: f32,
    pub key_rate: f32,
    pub mouse_distance: f32,
    pub input_level: String,
    pub idle_duration_ms: u64,
    pub hour: u8,
    pub is_night: bool,
    pub is_weekend: bool,
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

pub fn launch_sensors(app: AppHandle) {
    let state = Arc::new(Mutex::new(InputState::default()));

    // rdev: global keyboard + mouse hook
    let state_input = Arc::clone(&state);
    std::thread::spawn(move || {
        let _ = rdev::listen(move |event| {
            let mut s = state_input.lock().unwrap();
            match event.event_type {
                rdev::EventType::KeyPress(_) => {
                    let t = now_ms();
                    s.key_timestamps.push(t);
                    s.last_input_at = Some(t);
                }
                rdev::EventType::MouseMove { .. } => {
                    s.mouse_events += 1;
                    s.last_input_at = Some(now_ms());
                }
                _ => {}
            }
        });
    });

    // Snapshot emitter: every 5 seconds
    let state_emit = Arc::clone(&state);
    std::thread::spawn(move || loop {
        std::thread::sleep(Duration::from_secs(5));

        let payload = {
            let mut s = state_emit.lock().unwrap();
            let now = now_ms();

            // Prune key timestamps older than 60s
            s.key_timestamps.retain(|&t| now - t < 60_000);
            let key_rate = s.key_timestamps.len() as f32;

            let idle_ms = match s.last_input_at {
                Some(t) => now.saturating_sub(t),
                None    => now,
            };

            let input_level = if idle_ms > 120_000 {
                "idle"
            } else if key_rate > 60.0 {
                "heavy"
            } else {
                "light"
            }
            .to_string();

            let mouse_events = s.mouse_events as f32;
            s.mouse_events = 0; // reset window

            let secs = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs();
            let hour = ((secs % 86400) / 3600) as u8;
            let day_of_week = (secs / 86400 + 4) % 7; // 0=Sunday

            SensorPayload {
                timestamp: now,
                mic_active: s.mic_active,
                mic_level: s.mic_level,
                key_rate,
                mouse_distance: mouse_events,
                input_level,
                idle_duration_ms: idle_ms,
                hour,
                is_night: hour < 6 || hour >= 22,
                is_weekend: day_of_week == 0 || day_of_week == 6,
            }
        };

        let _ = app.emit("sensor-snapshot", payload);
    });

    // cpal: mic volume (optional, graceful failure)
    let state_mic = Arc::clone(&state);
    std::thread::spawn(move || {
        if let Err(e) = run_mic(state_mic) {
            eprintln!("[buddy-sensors] mic disabled: {e}");
        }
    });
}

fn run_mic(state: Arc<Mutex<InputState>>) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};

    let host   = cpal::default_host();
    let device = host.default_input_device().ok_or("no audio input device")?;
    let config = device.default_input_config()?;

    let state_cb = Arc::clone(&state);
    let stream = device.build_input_stream(
        &config.into(),
        move |data: &[f32], _: &cpal::InputCallbackInfo| {
            let rms = (data.iter().map(|&s| s * s).sum::<f32>() / data.len() as f32).sqrt();
            let mut st = state_cb.lock().unwrap();
            st.mic_level  = rms;
            st.mic_active = rms > 0.01;
        },
        |err| eprintln!("[buddy-sensors] mic stream error: {err}"),
        None,
    )?;

    stream.play()?;
    loop { std::thread::sleep(Duration::from_secs(60)); }
}
```

- [ ] **Step 3: Actualizar main.rs — agregar launch_sensors y set_z_order**

```rust
// apps/desktop/src-tauri/src/main.rs — reemplazar contenido completo
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod passthrough;
mod sidecar;
mod sensors;

use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager};
use tauri::image::Image;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};

#[tauri::command]
fn move_window(window: tauri::Window, x: f64, y: f64) -> Result<(), String> {
    window.set_position(tauri::LogicalPosition::new(x, y)).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_monitor_bounds(window: tauri::Window) -> Result<(f64, f64, f64, f64), String> {
    let monitor = window.current_monitor()
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "no monitor".to_string())?;
    let sf = monitor.scale_factor();
    let pos = monitor.position();
    let size = monitor.size();
    Ok((pos.x as f64 / sf, pos.y as f64 / sf, size.width as f64 / sf, size.height as f64 / sf))
}

#[tauri::command]
fn set_z_order(window: tauri::Window, on_top: bool) -> Result<(), String> {
    window.set_always_on_top(on_top).map_err(|e| e.to_string())
}

struct TrayState { is_anchored: bool }

fn make_tray_icon() -> Image<'static> {
    const SIZE: u32 = 32;
    let mut rgba = Vec::with_capacity((SIZE * SIZE * 4) as usize);
    for _ in 0..SIZE * SIZE { rgba.extend_from_slice(&[0xFF, 0x6B, 0x35, 0xFF]); }
    Image::new_owned(rgba, SIZE, SIZE)
}

fn update_tray_menu(app: &AppHandle, is_visible: bool, is_anchored: bool) {
    let show_text   = if is_visible   { "Ocultar"   } else { "Mostrar"   };
    let anchor_text = if is_anchored  { "Desanclar" } else { "Anclar"    };
    let Ok(show_hide) = MenuItem::with_id(app, "show_hide", show_text,   true, None::<&str>) else { return };
    let Ok(anchor)    = MenuItem::with_id(app, "anchor",    anchor_text, true, None::<&str>) else { return };
    let Ok(quit)      = MenuItem::with_id(app, "quit", "Cerrar Buddy",   true, None::<&str>) else { return };
    let Ok(sep)       = PredefinedMenuItem::separator(app) else { return };
    if let Ok(menu) = Menu::with_items(app, &[&show_hide, &anchor, &sep, &quit]) {
        if let Some(tray) = app.tray_by_id("buddy-tray") { let _ = tray.set_menu(Some(menu)); }
    }
}

#[tauri::command]
fn set_anchor(app: tauri::AppHandle, anchored: bool) -> Result<(), String> {
    { app.state::<Mutex<TrayState>>().lock().unwrap().is_anchored = anchored; }
    let visible = app.get_webview_window("buddy")
        .and_then(|w| w.is_visible().ok()).unwrap_or(true);
    update_tray_menu(&app, visible, anchored);
    Ok(())
}

fn toggle_window_visibility(app: &AppHandle) {
    if let Some(win) = app.get_webview_window("buddy") {
        let visible = win.is_visible().unwrap_or(true);
        if visible { let _ = win.hide(); } else { let _ = win.show(); let _ = win.set_focus(); }
        let anchored = app.state::<Mutex<TrayState>>().lock().unwrap().is_anchored;
        update_tray_menu(app, !visible, anchored);
    }
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            passthrough::set_ignore_cursor,
            move_window,
            get_monitor_bounds,
            set_anchor,
            set_z_order,
        ])
        .setup(|app| {
            app.manage(Mutex::new(TrayState { is_anchored: false }));
            sidecar::launch_sidecar(app);
            sensors::launch_sensors(app.handle().clone());

            let icon = make_tray_icon();
            let show_hide = MenuItem::with_id(app, "show_hide", "Ocultar",       true, None::<&str>)?;
            let anchor    = MenuItem::with_id(app, "anchor",    "Anclar",        true, None::<&str>)?;
            let quit      = MenuItem::with_id(app, "quit",  "Cerrar Buddy",      true, None::<&str>)?;
            let sep       = PredefinedMenuItem::separator(app)?;
            let menu      = Menu::with_items(app, &[&show_hide, &anchor, &sep, &quit])?;

            TrayIconBuilder::with_id("buddy-tray")
                .icon(icon)
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show_hide" => toggle_window_visibility(app),
                    "anchor" => {
                        let new_anchored = {
                            let mut s = app.state::<Mutex<TrayState>>().lock().unwrap();
                            s.is_anchored = !s.is_anchored;
                            s.is_anchored
                        };
                        let _ = app.emit("anchor-changed", new_anchored);
                        let visible = app.get_webview_window("buddy")
                            .and_then(|w| w.is_visible().ok()).unwrap_or(true);
                        update_tray_menu(app, visible, new_anchored);
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up, ..
                    } = event {
                        toggle_window_visibility(tray.app_handle());
                    }
                })
                .build(app)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                sidecar::kill_sidecar(&window.app_handle());
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 4: Compilar**

```
cd apps/desktop && cargo build --manifest-path src-tauri/Cargo.toml
```
Expected: compilación exitosa (puede tomar varios minutos la primera vez por cpal/rdev)

- [ ] **Step 5: Commit**

```
git add apps/desktop/src-tauri/Cargo.toml apps/desktop/src-tauri/src/sensors.rs apps/desktop/src-tauri/src/main.rs
git commit -m "feat(tauri): add sensor collection (mic+input) and set_z_order command"
```

---

### Task 8: useSensors y useMood hooks

**Files:**
- Create: `apps/desktop/src/hooks/useSensors.ts`
- Create: `apps/desktop/src/hooks/useMood.ts`

- [ ] **Step 1: Crear useSensors.ts**

```typescript
// apps/desktop/src/hooks/useSensors.ts
import { useEffect, useState } from 'react'
import { listen } from '@tauri-apps/api/event'
import type { SensorSnapshot } from '@buddy/core'

interface RawPayload {
  timestamp: number
  mic_active: boolean
  mic_level: number
  key_rate: number
  mouse_distance: number
  input_level: 'idle' | 'light' | 'heavy'
  idle_duration_ms: number
  hour: number
  is_night: boolean
  is_weekend: boolean
}

export function useSensors(): SensorSnapshot | null {
  const [snapshot, setSnapshot] = useState<SensorSnapshot | null>(null)

  useEffect(() => {
    let unlisten: (() => void) | undefined
    listen<RawPayload>('sensor-snapshot', ({ payload: p }) => {
      setSnapshot({
        timestamp: p.timestamp,
        mic:   { active: p.mic_active, level: p.mic_level },
        input: { keyRate: p.key_rate, mouseDistance: p.mouse_distance, level: p.input_level, idleDuration: p.idle_duration_ms },
        time:  { hour: p.hour, isNight: p.is_night, isWeekend: p.is_weekend },
      })
    }).then(fn => { unlisten = fn })
    return () => { unlisten?.() }
  }, [])

  return snapshot
}
```

- [ ] **Step 2: Crear useMood.ts**

```typescript
// apps/desktop/src/hooks/useMood.ts
import { useState, useEffect, useRef } from 'react'
import { MoodEngine, fallbackMood } from '@buddy/core'
import type { Mood, SensorSnapshot } from '@buddy/core'

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:7788'

export function useMood(snapshot: SensorSnapshot | null): Mood {
  const engineRef = useRef<MoodEngine | null>(null)
  if (!engineRef.current) engineRef.current = new MoodEngine(SERVER_URL)

  const [mood, setMood] = useState<Mood>(() => fallbackMood(new Date().getHours()))

  useEffect(() => {
    if (!snapshot) return
    engineRef.current!.update(snapshot).then(setMood)
  }, [snapshot])

  return mood
}
```

- [ ] **Step 3: Typecheck**

```
cd apps/desktop && pnpm typecheck
```
Expected: sin errores

- [ ] **Step 4: Commit**

```
git add apps/desktop/src/hooks/useSensors.ts apps/desktop/src/hooks/useMood.ts
git commit -m "feat(desktop): add useSensors and useMood hooks"
```

---

### Task 9: BuddyOverlay — integrar todo

**Files:**
- Modify: `apps/desktop/src/BuddyOverlay.tsx`

Esta es la integración final. Se modifican estas partes del archivo:

- [ ] **Step 1: Agregar imports**

Al tope de `BuddyOverlay.tsx`, agregar a los imports existentes:

```typescript
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { CharacterRenderer } from '@buddy/renderer'
import { ChatBubble } from './ChatBubble'
import { ContextMenu } from './ContextMenu'
import { SettingsPanel } from './SettingsPanel'
import { CharacterPicker } from './CharacterPicker'
import { useBuddy } from './hooks/useBuddy'
import { useSensors } from './hooks/useSensors'
import { useMood } from './hooks/useMood'
import { CHARACTERS, findCharacter } from './characters/registry'
import { createPhysics, tickPhysics, setWalkTarget, randomNearbyTarget } from './physics'
import { gaussian, moodToParams } from '@buddy/core'
import type { Avatar, Message } from '@buddy/types'
import type { BehaviorParams } from '@buddy/core'
import type { Position } from './physics'
```

- [ ] **Step 2: Agregar refs de fidget y behavior dentro de BuddyOverlay**

Dentro de `BuddyOverlay()`, después de `const isDraggingRef = useRef(false)`:

```typescript
const fidgetTimerRef  = useRef(0)
const fidgetHomeRef   = useRef<Position | null>(null)
const behaviorRef     = useRef<BehaviorParams>({
  walkFrequencyMs: 8_000, walkSpeedPx: 80, walkRadius: 350,
  fidgetEnabled: false, fidgetIntervalMs: 0, fidgetRadiusPx: 0,
})
```

- [ ] **Step 3: Conectar sensores y mood**

Dentro de `BuddyOverlay()`, después de los refs anteriores:

```typescript
const snapshot = useSensors()
const mood = useMood(snapshot)

// Sync behavior params when mood changes
useEffect(() => {
  behaviorRef.current = moodToParams(mood)
}, [mood])

// Sync z-order when mood changes
const prevZOrderRef = useRef(mood.zOrder)
useEffect(() => {
  if (mood.zOrder === prevZOrderRef.current) return
  prevZOrderRef.current = mood.zOrder
  void invoke('set_z_order', { onTop: mood.zOrder !== 'behind' })
}, [mood.zOrder])
```

- [ ] **Step 4: Agregar scheduleFidget**

Dentro de `BuddyOverlay()`, después de `scheduleNextWalk`:

```typescript
const scheduleFidget = useCallback(() => {
  clearTimeout(fidgetTimerRef.current)
  const params = behaviorRef.current
  if (!params.fidgetEnabled) return
  fidgetTimerRef.current = window.setTimeout(() => {
    if (physicsRef.current.target !== null || isDraggingRef.current || uiBusyRef.current) {
      scheduleFidget()
      return
    }
    fidgetHomeRef.current = { ...physicsRef.current.pos }
    const angle = Math.random() * Math.PI * 2
    const fidgetTarget = {
      x: physicsRef.current.pos.x + Math.cos(angle) * params.fidgetRadiusPx,
      y: physicsRef.current.pos.y + Math.sin(angle) * params.fidgetRadiusPx,
    }
    physicsRef.current = { ...setWalkTarget(physicsRef.current, fidgetTarget), isFidget: true }
  }, params.fidgetIntervalMs)
}, [])
```

- [ ] **Step 5: Actualizar el physics loop para usar BehaviorParams, easing, fidgets y gaussian timing**

Reemplazar el bloque `if (!isDraggingRef.current)` dentro del loop de física:

```typescript
if (!isDraggingRef.current) {
  const hadTarget  = physicsRef.current.target !== null
  const wasFidget  = physicsRef.current.isFidget
  const scale      = Math.max(0.75, Math.min(2, monitorRef.current.w / 1920))
  const speed      = Math.round(behaviorRef.current.walkSpeedPx * scale)
  physicsRef.current = tickPhysics(physicsRef.current, dt, speed)

  if (hadTarget && physicsRef.current.target === null) {
    if (wasFidget) {
      if (fidgetHomeRef.current) {
        // arrived at fidget target → return home
        physicsRef.current = { ...setWalkTarget(physicsRef.current, fidgetHomeRef.current), isFidget: true }
        fidgetHomeRef.current = null
      } else {
        // arrived home → schedule next fidget
        physicsRef.current = { ...physicsRef.current, isFidget: false }
        scheduleFidget()
      }
    } else {
      stopWalking()
      const { x, y } = physicsRef.current.pos
      saveWinPos(Math.round(x - OFF_X), Math.round(y - OFF_Y))
      const delay = gaussian(behaviorRef.current.walkFrequencyMs, behaviorRef.current.walkFrequencyMs * 0.4)
      scheduleNextWalk(Math.round(delay))
      scheduleFidget()  // start fidgeting while waiting for next walk
    }
  }
}
```

- [ ] **Step 6: Actualizar scheduleNextWalk para usar BehaviorParams radius**

Reemplazar el `clampedWalkTarget` call dentro de `scheduleNextWalk`:

```typescript
const scale = Math.max(0.75, Math.min(2, monitorRef.current.w / 1920))
physicsRef.current = setWalkTarget(
  physicsRef.current,
  clampedWalkTarget(physicsRef.current.pos, monitorRef.current, Math.round(behaviorRef.current.walkRadius * scale)),
)
```

- [ ] **Step 7: Arrancar fidgets cuando Buddy llega a su primer destino**

En `scheduleNextWalk`, después de `stopWalking()` y antes del `setTimeout`:

Al inicio de BuddyOverlay's first `useEffect` (el que hace `scheduleNextWalk(1_000)`), agregar:
```typescript
scheduleFidget()
```

- [ ] **Step 8: Limpiar fidgetTimer en cleanup**

En el cleanup del physics `useEffect`, agregar:
```typescript
clearTimeout(fidgetTimerRef.current)
```

- [ ] **Step 9: Typecheck completo**

```
cd apps/desktop && pnpm typecheck
```
Expected: sin errores

- [ ] **Step 10: Levantar la app y verificar**

```
cd apps/desktop && pnpm dev
```

Verificar manualmente:
- [ ] Buddy se mueve con easing (arranca lento, frena antes de llegar)
- [ ] Buddy hace micro-movimientos idle cuando está parado (fidgets)
- [ ] Abre ContextMenu → "Aurora" → las pausas tienen timing variable
- [ ] En consola de Tauri (output): se ven mensajes `sensor-snapshot` emit cada 5s
- [ ] Si cambias `MOOD_MODEL` y tienes LM Studio corriendo, los moods cambian

- [ ] **Step 11: Commit**

```
git add apps/desktop/src/BuddyOverlay.tsx
git commit -m "feat(desktop): integrate behavior engine, sensor-driven mood, fidgets and organic movement"
```

---

## Configuración LM Studio (post-implementación)

Una vez compilado, para activar el LLM local de mood:

1. Descargar en LM Studio:
   - `Qwen/Qwen2.5-7B-Instruct-GGUF` → `Q4_K_M` para chat (~4.7GB)
   - `Qwen/Qwen2.5-3B-Instruct-GGUF` → `Q4_K_M` para mood (~2.0GB)

2. En LM Studio: activar servidor local en puerto 1234, cargar ambos modelos

3. Variables de entorno para buddy-server:
   ```
   OLLAMA_URL=http://192.168.5.1:1234
   MOOD_URL=http://192.168.5.1:1234
   LLM_MODEL=qwen2.5-7b-instruct
   MOOD_MODEL=qwen2.5-3b-instruct
   ```

4. Sin LM Studio, Buddy usa fallback determinístico por hora del día — funciona igual visualmente.
