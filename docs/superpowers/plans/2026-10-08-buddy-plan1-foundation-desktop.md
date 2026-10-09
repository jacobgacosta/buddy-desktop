# Buddy — Plan 1: Foundation + Desktop MVP

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Buddy flotando en el desktop (Win/Mac/Linux) con un personaje 2D animado, chat de texto contra Ollama, y el sidecar Rust arrancando automáticamente con Tauri.

**Architecture:** Monorepo pnpm con tres paquetes compartidos (`@buddy/types`, `@buddy/core`, `@buddy/renderer`) y una app Tauri que lanza un sidecar Axum en Rust. El sidecar proxifica mensajes a Ollama local. La ventana Tauri es transparente, sin decoraciones, siempre al frente, con passthrough de mouse cuando el cursor no está sobre el sprite.

**Tech Stack:** pnpm workspaces, TypeScript 5, React 19, Rive (`@rive-app/react-canvas`), Tauri 2, Rust + Axum 0.7 + Tokio + reqwest, Ollama (llama3.2:3b o similar), Vitest, rusqlite.

---

## Mapa de archivos

```
buddy/
├── package.json                          # workspace root
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── packages/
│   ├── types/
│   │   ├── package.json
│   │   └── src/index.ts                  # Avatar, Message, ChatRequest, AvatarState
│   ├── core/
│   │   ├── package.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── llm-client.ts             # HTTP client → /chat
│   │       ├── avatar-state.ts           # state machine idle/walk/talk/think/sleep
│   │       └── __tests__/
│   │           ├── llm-client.test.ts
│   │           └── avatar-state.test.ts
│   └── renderer/
│       ├── package.json
│       └── src/
│           ├── index.ts
│           ├── BuddyCanvas.tsx           # Rive player wrapeado en React
│           └── __tests__/
│               └── BuddyCanvas.test.tsx
├── apps/
│   └── desktop/
│       ├── package.json
│       ├── vite.config.ts
│       ├── index.html
│       ├── src/
│       │   ├── main.tsx
│       │   ├── App.tsx
│       │   ├── BuddyOverlay.tsx          # posiciona avatar + maneja clicks
│       │   ├── ChatBubble.tsx            # popup de chat
│       │   ├── physics.ts                # loop de movimiento + bordes
│       │   └── hooks/useBuddy.ts         # conecta core + renderer
│       └── src-tauri/
│           ├── Cargo.toml
│           ├── tauri.conf.json
│           └── src/
│               ├── main.rs
│               ├── passthrough.rs        # ignore_cursor_events por OS
│               └── sidecar.rs            # lanza buddy-server al arrancar
└── server/
    ├── Cargo.toml
    ├── avatars/
    │   └── fox.json                      # definición del primer personaje
    └── src/
        ├── main.rs
        ├── state.rs                      # AppState
        └── routes/
            ├── mod.rs
            ├── health.rs
            └── chat.rs                   # proxy a Ollama
```

---

## Task 1: Monorepo Setup

**Files:**
- Create: `buddy/package.json`
- Create: `buddy/pnpm-workspace.yaml`
- Create: `buddy/tsconfig.base.json`

- [ ] **Instalar pnpm si no está instalado**

```bash
npm install -g pnpm@9
```

- [ ] **Crear `package.json` en la raíz**

```json
{
  "name": "buddy",
  "private": true,
  "scripts": {
    "test": "pnpm -r test",
    "build": "pnpm -r build",
    "typecheck": "pnpm -r typecheck"
  },
  "devDependencies": {
    "typescript": "^5.5.0"
  }
}
```

- [ ] **Crear `pnpm-workspace.yaml`**

```yaml
packages:
  - 'packages/*'
  - 'apps/*'
```

- [ ] **Crear `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "jsx": "react-jsx"
  }
}
```

- [ ] **Crear `.gitignore` en la raíz**

```
node_modules/
dist/
.superpowers/
target/
*.riv
!server/assets/placeholder.riv
```

- [ ] **Inicializar git y hacer primer commit**

```bash
cd C:\Users\jacob\develop\buddy
git init
git add package.json pnpm-workspace.yaml tsconfig.base.json .gitignore
git commit -m "chore: monorepo scaffold"
```

---

## Task 2: @buddy/types

**Files:**
- Create: `packages/types/package.json`
- Create: `packages/types/tsconfig.json`
- Create: `packages/types/src/index.ts`

- [ ] **Crear `packages/types/package.json`**

```json
{
  "name": "@buddy/types",
  "version": "0.1.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.5.0"
  }
}
```

- [ ] **Crear `packages/types/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Crear `packages/types/src/index.ts`**

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
```

- [ ] **Verificar tipos**

```bash
cd packages/types && pnpm typecheck
```

Esperado: sin errores.

- [ ] **Commit**

```bash
git add packages/types
git commit -m "feat: add @buddy/types package"
```

---

## Task 3: Rust Server — Scaffold + /health

**Files:**
- Create: `server/Cargo.toml`
- Create: `server/src/main.rs`
- Create: `server/src/state.rs`
- Create: `server/src/routes/mod.rs`
- Create: `server/src/routes/health.rs`

- [ ] **Crear `server/Cargo.toml`**

```toml
[package]
name = "buddy-server"
version = "0.1.0"
edition = "2021"

[[bin]]
name = "buddy-server"
path = "src/main.rs"

[dependencies]
axum = "0.7"
tokio = { version = "1", features = ["full"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
reqwest = { version = "0.12", features = ["json"] }
tower-http = { version = "0.6", features = ["cors"] }
anyhow = "1"
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }

[dev-dependencies]
axum-test = "15"
tokio = { version = "1", features = ["full"] }
```

- [ ] **Escribir test de /health primero** en `server/src/routes/health.rs`

```rust
use axum::{Json, http::StatusCode};
use serde_json::{json, Value};

pub async fn health() -> (StatusCode, Json<Value>) {
    (StatusCode::OK, Json(json!({ "status": "ok", "version": "0.1.0" })))
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::StatusCode;

    #[tokio::test]
    async fn health_returns_ok() {
        let (status, Json(body)) = health().await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(body["status"], "ok");
    }
}
```

- [ ] **Crear `server/src/routes/mod.rs`**

```rust
pub mod health;
pub mod chat;
pub mod avatars;
```

- [ ] **Crear `server/src/state.rs`**

```rust
#[derive(Clone)]
pub struct AppState {
    pub ollama_url: String,
    pub avatars_dir: String,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            ollama_url: std::env::var("OLLAMA_URL")
                .unwrap_or_else(|_| "http://localhost:11434".into()),
            avatars_dir: std::env::var("AVATARS_DIR")
                .unwrap_or_else(|_| "avatars".into()),
        }
    }
}
```

- [ ] **Crear `server/src/main.rs`**

```rust
mod routes;
mod state;

use axum::{Router, routing::get};
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
        .layer(cors)
        .with_state(state);

    let listener = tokio::net::TcpListener::bind(("0.0.0.0", port))
        .await
        .expect("failed to bind");

    tracing::info!("buddy-server listening on :{port}");
    axum::serve(listener, app).await.expect("server error");
}
```

- [ ] **Ejecutar tests del servidor**

```bash
cd server && cargo test
```

Esperado: `health_returns_ok ... ok`

- [ ] **Verificar que el servidor arranca**

```bash
cargo run &
curl http://localhost:7788/health
# {"status":"ok","version":"0.1.0"}
pkill buddy-server
```

- [ ] **Commit**

```bash
git add server/
git commit -m "feat: rust axum server scaffold with /health"
```

---

## Task 4: Servidor — Catálogo de Avatares (/avatars)

**Files:**
- Create: `server/avatars/fox.json`
- Create: `server/src/routes/avatars.rs`
- Modify: `server/src/main.rs`

- [ ] **Crear `server/avatars/fox.json`**

```json
{
  "id": "fox",
  "name": "Foxy",
  "riveFile": "fox.riv",
  "stateMachine": "BuddySM",
  "personality": "Eres Foxy, un zorro amigable y curioso. Eres entusiasta, haces preguntas cuando no entiendes algo, y celebras los logros del usuario. Responde siempre en español. Sé conciso — máximo 2-3 oraciones.",
  "voice": {
    "system": "es-MX"
  },
  "palette": ["#FF6B35", "#F7C59F", "#EFEFD0"],
  "size": "medium"
}
```

- [ ] **Escribir tests primero** en `server/src/routes/avatars.rs`

```rust
use axum::{extract::State, Json, http::StatusCode};
use serde_json::Value;
use std::fs;
use crate::state::AppState;

pub async fn list_avatars(
    State(state): State<AppState>,
) -> Result<Json<Vec<Value>>, StatusCode> {
    let dir = fs::read_dir(&state.avatars_dir)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let avatars: Vec<Value> = dir
        .filter_map(|entry| entry.ok())
        .filter(|e| e.path().extension().map_or(false, |ext| ext == "json"))
        .filter_map(|e| fs::read_to_string(e.path()).ok())
        .filter_map(|s| serde_json::from_str(&s).ok())
        .collect();

    Ok(Json(avatars))
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum_test::TestServer;
    use axum::{Router, routing::get};
    use std::fs;

    #[tokio::test]
    async fn list_avatars_returns_json_array() {
        // crear directorio temporal con un avatar de prueba
        let dir = std::env::temp_dir().join("buddy_test_avatars");
        fs::create_dir_all(&dir).unwrap();
        fs::write(
            dir.join("test.json"),
            r#"{"id":"test","name":"Test","riveFile":"test.riv","stateMachine":"SM","personality":"test","voice":{"system":"es"},"palette":[],"size":"small"}"#
        ).unwrap();

        let state = AppState {
            ollama_url: "http://localhost:11434".into(),
            avatars_dir: dir.to_str().unwrap().into(),
        };

        let app = Router::new()
            .route("/avatars", get(list_avatars))
            .with_state(state);

        let server = TestServer::new(app).unwrap();
        let response = server.get("/avatars").await;
        response.assert_status_ok();
        let body: Vec<Value> = response.json();
        assert!(!body.is_empty());
        assert_eq!(body[0]["id"], "test");
    }
}
```

- [ ] **Registrar la ruta en `server/src/main.rs`** — agregar después del import de routes:

```rust
use axum::routing::{get, post};

// en la función main, reemplazar la definición de app:
let app = Router::new()
    .route("/health", get(routes::health::health))
    .route("/avatars", get(routes::avatars::list_avatars))
    .layer(cors)
    .with_state(state);
```

- [ ] **Ejecutar tests**

```bash
cd server && cargo test
```

Esperado: `list_avatars_returns_json_array ... ok`

- [ ] **Verificar manualmente**

```bash
cargo run &
curl http://localhost:7788/avatars
# [{"id":"fox","name":"Foxy",...}]
pkill buddy-server
```

- [ ] **Commit**

```bash
git add server/
git commit -m "feat: GET /avatars endpoint with JSON catalog"
```

---

## Task 5: Servidor — /chat con Ollama

**Files:**
- Create: `server/src/routes/chat.rs`
- Modify: `server/src/main.rs`
- Modify: `server/src/state.rs`

- [ ] **Agregar `reqwest::Client` a AppState** en `server/src/state.rs`

```rust
#[derive(Clone)]
pub struct AppState {
    pub ollama_url: String,
    pub avatars_dir: String,
    pub http: reqwest::Client,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            ollama_url: std::env::var("OLLAMA_URL")
                .unwrap_or_else(|_| "http://localhost:11434".into()),
            avatars_dir: std::env::var("AVATARS_DIR")
                .unwrap_or_else(|_| "avatars".into()),
            http: reqwest::Client::new(),
        }
    }
}
```

- [ ] **Escribir tests primero** en `server/src/routes/chat.rs`

```rust
use axum::{extract::State, Json, http::StatusCode};
use serde::{Deserialize, Serialize};
use crate::state::AppState;

#[derive(Deserialize)]
pub struct ChatRequest {
    pub message: String,
    pub avatar_id: String,
    pub personality: String,
    pub history: Vec<HistoryMessage>,
}

#[derive(Deserialize, Serialize, Clone)]
pub struct HistoryMessage {
    pub role: String,
    pub content: String,
}

#[derive(Serialize)]
pub struct ChatResponse {
    pub content: String,
    pub avatar_id: String,
}

pub async fn chat(
    State(state): State<AppState>,
    Json(req): Json<ChatRequest>,
) -> Result<Json<ChatResponse>, StatusCode> {
    let mut messages = vec![
        HistoryMessage {
            role: "system".into(),
            content: req.personality.clone(),
        }
    ];
    messages.extend(req.history.clone());
    messages.push(HistoryMessage {
        role: "user".into(),
        content: req.message.clone(),
    });

    let ollama_req = serde_json::json!({
        "model": std::env::var("OLLAMA_MODEL").unwrap_or_else(|_| "llama3.2:3b".into()),
        "messages": messages,
        "stream": false
    });

    let resp = state.http
        .post(format!("{}/api/chat", state.ollama_url))
        .json(&ollama_req)
        .send()
        .await
        .map_err(|_| StatusCode::BAD_GATEWAY)?;

    let body: serde_json::Value = resp.json().await
        .map_err(|_| StatusCode::BAD_GATEWAY)?;

    let content = body["message"]["content"]
        .as_str()
        .unwrap_or("...")
        .to_string();

    Ok(Json(ChatResponse {
        content,
        avatar_id: req.avatar_id,
    }))
}

#[cfg(test)]
mod tests {
    // Test unitario del parsing — el test de integración con Ollama
    // se hace manualmente porque requiere Ollama corriendo.
    use super::*;

    #[test]
    fn chat_response_serializes_correctly() {
        let resp = ChatResponse {
            content: "Hola!".into(),
            avatar_id: "fox".into(),
        };
        let json = serde_json::to_string(&resp).unwrap();
        assert!(json.contains("Hola!"));
        assert!(json.contains("fox"));
    }
}
```

- [ ] **Registrar la ruta en `server/src/main.rs`**

```rust
let app = Router::new()
    .route("/health", get(routes::health::health))
    .route("/avatars", get(routes::avatars::list_avatars))
    .route("/chat", post(routes::chat::chat))
    .layer(cors)
    .with_state(state);
```

- [ ] **Ejecutar tests**

```bash
cd server && cargo test
```

Esperado: todos los tests pasan.

- [ ] **Test de integración manual** (requiere Ollama corriendo)

```bash
# primero asegúrate de tener Ollama con llama3.2:3b
ollama pull llama3.2:3b

cargo run &
curl -X POST http://localhost:7788/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"hola","avatar_id":"fox","personality":"Eres Foxy, un zorro amigable.","history":[]}'
# {"content":"¡Hola! ...","avatar_id":"fox"}
pkill buddy-server
```

- [ ] **Commit**

```bash
git add server/
git commit -m "feat: POST /chat endpoint proxying to Ollama"
```

---

## Task 6: @buddy/core — LLM Client

**Files:**
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/src/llm-client.ts`
- Create: `packages/core/src/__tests__/llm-client.test.ts`
- Create: `packages/core/src/index.ts`

- [ ] **Crear `packages/core/package.json`**

```json
{
  "name": "@buddy/core",
  "version": "0.1.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@buddy/types": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Crear `packages/core/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
  "include": ["src"]
}
```

- [ ] **Escribir el test primero** en `packages/core/src/__tests__/llm-client.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LlmClient } from '../llm-client'
import type { Message } from '@buddy/types'

const mockFetch = vi.fn()
global.fetch = mockFetch

describe('LlmClient', () => {
  beforeEach(() => mockFetch.mockReset())

  it('posts to /chat with correct payload', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ content: 'Hola!', avatar_id: 'fox' }),
    })

    const client = new LlmClient('http://localhost:7788')
    const result = await client.chat({
      message: 'hola',
      avatarId: 'fox',
      personality: 'Eres Foxy.',
      history: [],
    })

    expect(result.content).toBe('Hola!')
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:7788/chat',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('throws when server returns error', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 502 })

    const client = new LlmClient('http://localhost:7788')
    await expect(
      client.chat({ message: 'hola', avatarId: 'fox', personality: '', history: [] })
    ).rejects.toThrow('LLM request failed: 502')
  })
})
```

- [ ] **Ejecutar test para ver que falla**

```bash
cd packages/core && pnpm test
```

Esperado: FAIL — `LlmClient is not defined`

- [ ] **Implementar `packages/core/src/llm-client.ts`**

```typescript
import type { Message, ChatResponse } from '@buddy/types'

interface ChatParams {
  message: string
  avatarId: string
  personality: string
  history: Message[]
  context?: string
}

export class LlmClient {
  constructor(private readonly baseUrl: string) {}

  async chat(params: ChatParams): Promise<ChatResponse> {
    const resp = await fetch(`${this.baseUrl}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: params.message,
        avatar_id: params.avatarId,
        personality: params.personality,
        history: params.history.map(m => ({ role: m.role, content: m.content })),
        context: params.context,
      }),
    })

    if (!resp.ok) throw new Error(`LLM request failed: ${resp.status}`)
    return resp.json()
  }
}
```

- [ ] **Crear `packages/core/src/index.ts`**

```typescript
export { LlmClient } from './llm-client'
export { AvatarStateMachine } from './avatar-state'
```

- [ ] **Ejecutar tests — deben pasar**

```bash
pnpm test
```

Esperado: `2 passed`

- [ ] **Commit**

```bash
git add packages/core/
git commit -m "feat: @buddy/core LlmClient with tests"
```

---

## Task 7: @buddy/core — Avatar State Machine

**Files:**
- Create: `packages/core/src/avatar-state.ts`
- Create: `packages/core/src/__tests__/avatar-state.test.ts`

- [ ] **Escribir tests primero** en `packages/core/src/__tests__/avatar-state.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest'
import { AvatarStateMachine } from '../avatar-state'

describe('AvatarStateMachine', () => {
  it('starts in idle state', () => {
    const sm = new AvatarStateMachine()
    expect(sm.state).toBe('idle')
  })

  it('transitions to think when sendMessage is called', () => {
    const sm = new AvatarStateMachine()
    sm.sendMessage()
    expect(sm.state).toBe('think')
  })

  it('transitions to talk when response arrives', () => {
    const sm = new AvatarStateMachine()
    sm.sendMessage()
    sm.receiveResponse()
    expect(sm.state).toBe('talk')
  })

  it('returns to idle after talk finishes', () => {
    const sm = new AvatarStateMachine()
    sm.sendMessage()
    sm.receiveResponse()
    sm.finishTalking()
    expect(sm.state).toBe('idle')
  })

  it('calls onStateChange callback on every transition', () => {
    const onChange = vi.fn()
    const sm = new AvatarStateMachine(onChange)
    sm.sendMessage()
    expect(onChange).toHaveBeenCalledWith('think')
  })

  it('enters sleep after setSleep()', () => {
    const sm = new AvatarStateMachine()
    sm.setSleep()
    expect(sm.state).toBe('sleep')
  })

  it('wakes to idle from sleep on sendMessage', () => {
    const sm = new AvatarStateMachine()
    sm.setSleep()
    sm.sendMessage()
    expect(sm.state).toBe('think')
  })
})
```

- [ ] **Ejecutar — deben fallar**

```bash
pnpm test
```

- [ ] **Implementar `packages/core/src/avatar-state.ts`**

```typescript
import type { AvatarState } from '@buddy/types'

export class AvatarStateMachine {
  private _state: AvatarState = 'idle'

  constructor(private readonly onChange?: (state: AvatarState) => void) {}

  get state(): AvatarState {
    return this._state
  }

  private transition(next: AvatarState) {
    this._state = next
    this.onChange?.(next)
  }

  sendMessage() {
    this.transition('think')
  }

  receiveResponse() {
    if (this._state === 'think') this.transition('talk')
  }

  finishTalking() {
    if (this._state === 'talk') this.transition('idle')
  }

  setSleep() {
    this.transition('sleep')
  }

  startWalking() {
    if (this._state === 'idle') this.transition('walk')
  }

  stopWalking() {
    if (this._state === 'walk') this.transition('idle')
  }
}
```

- [ ] **Ejecutar tests — todos deben pasar**

```bash
pnpm test
```

Esperado: `7 passed`

- [ ] **Commit**

```bash
git add packages/core/src/avatar-state.ts packages/core/src/__tests__/avatar-state.test.ts
git commit -m "feat: AvatarStateMachine with full state transitions"
```

---

## Task 8: @buddy/renderer — BuddyCanvas (Rive)

**Files:**
- Create: `packages/renderer/package.json`
- Create: `packages/renderer/tsconfig.json`
- Create: `packages/renderer/src/BuddyCanvas.tsx`
- Create: `packages/renderer/src/__tests__/BuddyCanvas.test.tsx`
- Create: `packages/renderer/src/index.ts`

> **Nota sobre archivos .riv:** Los archivos de animación Rive los creas con el editor gratuito en rive.app. Para este scaffold se usa el archivo de demo que incluye la librería. Cada avatar necesitará su propio `.riv` con:
> - State machine llamada `BuddySM`
> - Un input de tipo **Number** llamado `state` con valores: `0=idle, 1=walk, 2=talk, 3=think, 4=react_happy, 5=sleep`
> - Las animaciones nombradas igual en los estados de la state machine

- [ ] **Crear `packages/renderer/package.json`**

```json
{
  "name": "@buddy/renderer",
  "version": "0.1.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@buddy/types": "workspace:*",
    "@rive-app/react-canvas": "^4.0.0",
    "react": "^19.0.0"
  },
  "devDependencies": {
    "@testing-library/react": "^16.0.0",
    "@types/react": "^19.0.0",
    "jsdom": "^25.0.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Crear `packages/renderer/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
  "include": ["src"]
}
```

- [ ] **Escribir test primero** en `packages/renderer/src/__tests__/BuddyCanvas.test.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { BuddyCanvas } from '../BuddyCanvas'

// mock Rive para tests — no necesita WebGL en CI
vi.mock('@rive-app/react-canvas', () => ({
  useRive: () => ({
    rive: null,
    RiveComponent: () => <canvas data-testid="rive-canvas" />,
  }),
  useStateMachineInput: () => null,
}))

describe('BuddyCanvas', () => {
  it('renders without crashing', () => {
    const { getByTestId } = render(
      <BuddyCanvas riveFile="fox.riv" stateMachine="BuddySM" state="idle" size={120} />
    )
    expect(getByTestId('rive-canvas')).toBeTruthy()
  })
})
```

- [ ] **Implementar `packages/renderer/src/BuddyCanvas.tsx`**

```typescript
import { useRive, useStateMachineInput } from '@rive-app/react-canvas'
import { useEffect } from 'react'
import type { AvatarState } from '@buddy/types'

interface Props {
  riveFile: string
  stateMachine: string
  state: AvatarState
  size: number
}

export function BuddyCanvas({ riveFile, stateMachine, state, size }: Props) {
  const { rive, RiveComponent } = useRive({
    src: riveFile,
    stateMachines: stateMachine,
    autoplay: true,
  })

  const stateInput = useStateMachineInput(rive, stateMachine, 'state')

  useEffect(() => {
    if (!stateInput) return
    const stateMap: Record<AvatarState, number> = {
      idle: 0, walk: 1, talk: 2, think: 3, react_happy: 4, sleep: 5,
    }
    stateInput.value = stateMap[state]
  }, [state, stateInput])

  return <RiveComponent style={{ width: size, height: size }} />
}
```

- [ ] **Crear `packages/renderer/src/index.ts`**

```typescript
export { BuddyCanvas } from './BuddyCanvas'
```

- [ ] **Ejecutar tests**

```bash
cd packages/renderer && pnpm test
```

Esperado: `1 passed`

- [ ] **Commit**

```bash
git add packages/renderer/
git commit -m "feat: @buddy/renderer BuddyCanvas with Rive"
```

---

## Task 9: Desktop — Tauri Setup + Ventana Transparente

**Files:**
- Create: `apps/desktop/package.json`
- Create: `apps/desktop/vite.config.ts`
- Create: `apps/desktop/index.html`
- Create: `apps/desktop/src/main.tsx`
- Create: `apps/desktop/src/App.tsx`
- Create: `apps/desktop/src-tauri/tauri.conf.json`
- Create: `apps/desktop/src-tauri/Cargo.toml`
- Create: `apps/desktop/src-tauri/src/main.rs`

- [ ] **Instalar Tauri CLI si no está**

```bash
cargo install tauri-cli --version "^2.0"
```

- [ ] **Crear `apps/desktop/package.json`**

```json
{
  "name": "@buddy/desktop",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "tauri dev",
    "build": "tauri build",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@buddy/core": "workspace:*",
    "@buddy/renderer": "workspace:*",
    "@buddy/types": "workspace:*",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@tauri-apps/api": "^2.0.0",
    "@tauri-apps/cli": "^2.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.0.0",
    "typescript": "^5.5.0",
    "vite": "^6.0.0"
  }
}
```

- [ ] **Crear `apps/desktop/vite.config.ts`**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: { port: 1420, strictPort: true },
  envPrefix: ['VITE_', 'TAURI_'],
  build: { target: 'chrome105', minify: 'esbuild' },
})
```

- [ ] **Crear `apps/desktop/index.html`**

```html
<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Buddy</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { background: transparent; overflow: hidden; }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Crear `apps/desktop/src/main.tsx`**

```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

- [ ] **Crear `apps/desktop/src/App.tsx`** (stub inicial)

```typescript
import { BuddyOverlay } from './BuddyOverlay'

export function App() {
  return <BuddyOverlay />
}
```

- [ ] **Crear `apps/desktop/src-tauri/tauri.conf.json`**

```json
{
  "productName": "Buddy",
  "version": "0.1.0",
  "identifier": "com.buddy.desktop",
  "build": {
    "beforeDevCommand": "pnpm dev --port 1420",
    "devUrl": "http://localhost:1420",
    "beforeBuildCommand": "pnpm build",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "label": "buddy",
        "title": "Buddy",
        "width": 200,
        "height": 200,
        "minWidth": 120,
        "minHeight": 120,
        "transparent": true,
        "decorations": false,
        "alwaysOnTop": true,
        "skipTaskbar": true,
        "resizable": false,
        "x": 100,
        "y": 100
      }
    ],
    "security": { "csp": null }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": []
  }
}
```

- [ ] **Crear `apps/desktop/src-tauri/Cargo.toml`**

```toml
[package]
name = "buddy-desktop"
version = "0.1.0"
edition = "2021"

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = [] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

- [ ] **Crear `apps/desktop/src-tauri/src/main.rs`**

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Crear `apps/desktop/src-tauri/build.rs`**

```rust
fn main() {
    tauri_build::build()
}
```

- [ ] **Ejecutar en modo dev para verificar ventana transparente**

```bash
cd apps/desktop && pnpm dev
```

Esperado: ventana transparente pequeña (200x200) visible, sin decoraciones, siempre al frente.

- [ ] **Commit**

```bash
git add apps/desktop/
git commit -m "feat: tauri desktop app with transparent always-on-top window"
```

---

## Task 10: Desktop — Mouse Passthrough

**Files:**
- Create: `apps/desktop/src-tauri/src/passthrough.rs`
- Modify: `apps/desktop/src-tauri/src/main.rs`

- [ ] **Crear `apps/desktop/src-tauri/src/passthrough.rs`**

```rust
use tauri::{command, AppHandle, Manager};

/// Activa/desactiva el passthrough de mouse.
/// Llamado desde JS cuando el cursor entra/sale del sprite.
#[command]
pub fn set_ignore_cursor(app: AppHandle, ignore: bool) {
    if let Some(window) = app.get_webview_window("buddy") {
        let _ = window.set_ignore_cursor_events(ignore);
    }
}
```

- [ ] **Registrar el comando en `apps/desktop/src-tauri/src/main.rs`**

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod passthrough;

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![passthrough::set_ignore_cursor])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Crear `apps/desktop/src/hooks/usePassthrough.ts`** — hook React que llama al comando Rust

```typescript
import { invoke } from '@tauri-apps/api/core'
import { useCallback } from 'react'

export function usePassthrough() {
  const setIgnore = useCallback((ignore: boolean) => {
    invoke('set_ignore_cursor', { ignore }).catch(console.error)
  }, [])

  return { setIgnore }
}
```

- [ ] **Compilar para verificar que no hay errores Rust**

```bash
cd apps/desktop/src-tauri && cargo check
```

Esperado: sin errores.

- [ ] **Commit**

```bash
git add apps/desktop/src-tauri/src/passthrough.rs apps/desktop/src-tauri/src/main.rs apps/desktop/src/hooks/usePassthrough.ts
git commit -m "feat: mouse passthrough via Tauri command"
```

---

## Task 11: Desktop — Física de Movimiento

**Files:**
- Create: `apps/desktop/src/physics.ts`

- [ ] **Crear `apps/desktop/src/physics.ts`**

```typescript
export interface Position { x: number; y: number }
export interface PhysicsState {
  pos: Position
  vel: Position
  target: Position | null
}

export function createPhysics(initial: Position): PhysicsState {
  return { pos: initial, vel: { x: 0, y: 0 }, target: null }
}

export function tickPhysics(
  state: PhysicsState,
  screenW: number,
  screenH: number,
  spriteSize: number,
  dt: number
): PhysicsState {
  const { pos, vel, target } = state

  if (target) {
    const dx = target.x - pos.x
    const dy = target.y - pos.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < 2) {
      return { pos: target, vel: { x: 0, y: 0 }, target: null }
    }
    const speed = 80 // px/s
    return {
      pos: {
        x: pos.x + (dx / dist) * speed * dt,
        y: pos.y + (dy / dist) * speed * dt,
      },
      vel: { x: dx / dist, y: dy / dist },
      target,
    }
  }

  // gravedad hacia borde inferior cuando no hay target
  const gravity = 200
  const newVelY = vel.y + gravity * dt
  const newX = Math.max(0, Math.min(screenW - spriteSize, pos.x + vel.x * dt))
  const newY = Math.max(0, Math.min(screenH - spriteSize, pos.y + newVelY * dt))

  return {
    pos: { x: newX, y: newY },
    vel: { x: vel.x, y: newVelY },
    target,
  }
}

export function setWalkTarget(state: PhysicsState, target: Position): PhysicsState {
  return { ...state, target }
}

export function randomEdgeTarget(screenW: number, screenH: number, spriteSize: number): Position {
  const edge = Math.floor(Math.random() * 4)
  switch (edge) {
    case 0: return { x: Math.random() * (screenW - spriteSize), y: 0 }
    case 1: return { x: screenW - spriteSize, y: Math.random() * (screenH - spriteSize) }
    case 2: return { x: Math.random() * (screenW - spriteSize), y: screenH - spriteSize }
    default: return { x: 0, y: Math.random() * (screenH - spriteSize) }
  }
}
```

- [ ] **Commit**

```bash
git add apps/desktop/src/physics.ts
git commit -m "feat: physics loop for avatar movement"
```

---

## Task 12: Desktop — BuddyOverlay + ChatBubble

**Files:**
- Create: `apps/desktop/src/BuddyOverlay.tsx`
- Create: `apps/desktop/src/ChatBubble.tsx`
- Create: `apps/desktop/src/hooks/useBuddy.ts`

- [ ] **Crear `apps/desktop/src/hooks/useBuddy.ts`**

```typescript
import { useState, useEffect, useCallback, useRef } from 'react'
import { LlmClient } from '@buddy/core'
import { AvatarStateMachine } from '@buddy/core'
import type { Avatar, Message, AvatarState } from '@buddy/types'

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:7788'

export function useBuddy(avatar: Avatar) {
  const [state, setState] = useState<AvatarState>('idle')
  const [history, setHistory] = useState<Message[]>([])
  const [thinking, setThinking] = useState(false)
  const sm = useRef(new AvatarStateMachine(setState))
  const client = useRef(new LlmClient(SERVER_URL))

  const sendMessage = useCallback(async (text: string) => {
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      avatarId: avatar.id,
      timestamp: Date.now(),
    }
    setHistory(h => [...h, userMsg])
    setThinking(true)
    sm.current.sendMessage()

    try {
      const resp = await client.current.chat({
        message: text,
        avatarId: avatar.id,
        personality: avatar.personality,
        history: [...history, userMsg],
      })
      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: resp.content,
        avatarId: avatar.id,
        timestamp: Date.now(),
      }
      setHistory(h => [...h, assistantMsg])
      sm.current.receiveResponse()
      // vuelve a idle tras 4 segundos de "hablar"
      setTimeout(() => sm.current.finishTalking(), 4000)
    } catch (err) {
      console.error(err)
      sm.current.finishTalking()
    } finally {
      setThinking(false)
    }
  }, [avatar, history])

  // entrar en sleep tras 5 minutos de inactividad
  useEffect(() => {
    const timer = setTimeout(() => sm.current.setSleep(), 5 * 60 * 1000)
    return () => clearTimeout(timer)
  }, [history])

  return { state, history, thinking, sendMessage }
}
```

- [ ] **Crear `apps/desktop/src/ChatBubble.tsx`**

```typescript
import { useState, useRef, useEffect } from 'react'
import type { Message } from '@buddy/types'

interface Props {
  history: Message[]
  thinking: boolean
  onSend: (text: string) => void
  onClose: () => void
}

export function ChatBubble({ history, thinking, onSend, onClose }: Props) {
  const [input, setInput] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history])

  const handleSend = () => {
    const text = input.trim()
    if (!text) return
    onSend(text)
    setInput('')
  }

  return (
    <div style={{
      position: 'fixed', bottom: 220, right: 20,
      width: 280, background: 'rgba(20,20,30,0.95)',
      borderRadius: 16, padding: 12, color: '#fff',
      fontFamily: 'system-ui', fontSize: 13,
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    }}>
      <button
        onClick={onClose}
        style={{ float: 'right', background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 16 }}
      >×</button>
      <div style={{ height: 160, overflowY: 'auto', marginBottom: 8 }}>
        {history.map(m => (
          <div key={m.id} style={{
            textAlign: m.role === 'user' ? 'right' : 'left',
            marginBottom: 6,
          }}>
            <span style={{
              background: m.role === 'user' ? '#4338ca' : '#1f2937',
              borderRadius: 8, padding: '4px 8px', display: 'inline-block',
            }}>
              {m.content}
            </span>
          </div>
        ))}
        {thinking && (
          <div style={{ color: '#6b7280', fontStyle: 'italic' }}>pensando...</div>
        )}
        <div ref={endRef} />
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="Escríbele a Buddy..."
          style={{
            flex: 1, background: '#1f2937', border: 'none', borderRadius: 8,
            padding: '6px 10px', color: '#fff', fontSize: 13, outline: 'none',
          }}
        />
        <button
          onClick={handleSend}
          style={{
            background: '#4338ca', border: 'none', borderRadius: 8,
            padding: '6px 10px', color: '#fff', cursor: 'pointer',
          }}
        >▶</button>
      </div>
    </div>
  )
}
```

- [ ] **Crear `apps/desktop/src/BuddyOverlay.tsx`**

```typescript
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
```

- [ ] **Commit**

```bash
git add apps/desktop/src/
git commit -m "feat: BuddyOverlay with physics, ChatBubble, useBuddy hook"
```

---

## Task 13: Desktop — Tauri lanza el sidecar Axum

**Files:**
- Create: `apps/desktop/src-tauri/src/sidecar.rs`
- Modify: `apps/desktop/src-tauri/src/main.rs`
- Modify: `apps/desktop/src-tauri/tauri.conf.json`

- [ ] **Crear el directorio `binaries/`**

```bash
mkdir apps\desktop\src-tauri\binaries
```

- [ ] **Compilar el servidor como binario para distribuir con Tauri**

Agregar en `server/Cargo.toml`:
```toml
[profile.release]
strip = true
opt-level = 3
```

Compilar:
```bash
cd server && cargo build --release
```

El binario quedará en `server/target/release/buddy-server` (o `.exe` en Windows).

- [ ] **Copiar el binario al directorio de recursos de Tauri**

```bash
# Windows
copy server\target\release\buddy-server.exe apps\desktop\src-tauri\binaries\buddy-server-x86_64-pc-windows-msvc.exe

# macOS
cp server/target/release/buddy-server apps/desktop/src-tauri/binaries/buddy-server-aarch64-apple-darwin

# Linux
cp server/target/release/buddy-server apps/desktop/src-tauri/binaries/buddy-server-x86_64-unknown-linux-gnu
```

- [ ] **Registrar el sidecar en `apps/desktop/src-tauri/tauri.conf.json`** — agregar dentro de `"bundle"`:

```json
"externalBin": ["binaries/buddy-server"],
"resources": {
  "server/avatars/*": "avatars/"
}
```

Y en `"app"` agregar capabilities:
```json
"security": {
  "csp": null,
  "capabilities": ["default"]
}
```

- [ ] **Crear `apps/desktop/src-tauri/src/sidecar.rs`**

```rust
use tauri::Manager;
use tauri::plugin::TauriPlugin;
use std::process::Command;

pub fn launch_sidecar(app: &tauri::App) {
    let resource_path = app
        .path()
        .resource_dir()
        .expect("no resource dir");

    let sidecar_path = resource_path.join("buddy-server");

    std::thread::spawn(move || {
        let _ = Command::new(&sidecar_path)
            .env("PORT", "7788")
            .env("AVATARS_DIR", resource_path.join("avatars").to_str().unwrap_or("avatars"))
            .spawn();
    });
}
```

- [ ] **Modificar `apps/desktop/src-tauri/src/main.rs`** para lanzar el sidecar al arrancar

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod passthrough;
mod sidecar;

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![passthrough::set_ignore_cursor])
        .setup(|app| {
            sidecar::launch_sidecar(app);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Probar el flujo completo**

```bash
cd apps/desktop && pnpm dev
```

Verificar en la terminal que el servidor arranca en `:7788`:
```
buddy-server listening on :7788
```

- [ ] **Commit**

```bash
git add apps/desktop/src-tauri/ server/
git commit -m "feat: tauri launches buddy-server sidecar on startup"
```

---

## Task 14: Smoke Test de Integración

Este es el test final que verifica que todo el flujo funciona de punta a punta.

- [ ] **Asegurarse de que Ollama tiene el modelo**

```bash
ollama list
# debe mostrar llama3.2:3b o similar
# si no: ollama pull llama3.2:3b
```

- [ ] **Ejecutar todos los unit tests**

```bash
cd C:\Users\jacob\develop\buddy
pnpm test
```

Esperado: todos los tests de `@buddy/core` y `@buddy/renderer` pasan.

- [ ] **Levantar la app de escritorio**

```bash
cd apps/desktop && pnpm dev
```

- [ ] **Checklist de verificación manual:**

  - [ ] Buddy aparece flotando en la pantalla, sin barra de título
  - [ ] El sprite se ve animado (estado idle)
  - [ ] El cursor pasa "a través" de la zona transparente sin bloquear clicks
  - [ ] Al pasar el cursor sobre el sprite, el cursor cambia a pointer
  - [ ] Click en Buddy abre el chat bubble
  - [ ] Escribir "hola" y presionar Enter — Buddy entra en estado `think`
  - [ ] Ollama responde — Buddy entra en estado `talk`
  - [ ] Tras ~4 segundos Buddy vuelve a `idle`
  - [ ] Buddy camina hacia una esquina cada ~8 segundos

- [ ] **Commit final del plan 1**

```bash
git add .
git commit -m "feat: buddy desktop MVP complete — floating avatar with Ollama chat"
```

---

## Siguientes planes

- **Plan 2:** Voz (TTS + STT + lip-sync) + Screen Context + avatares adicionales (robot-k, sage)
- **Plan 3:** React Native mobile (Android burbuja flotante + iOS PiP)
- **Plan 4:** Browser Extension Chrome/Firefox MV3
