# Buddy — Referencia Técnica

Companion de escritorio flotante hecho con Tauri 2 + React 19. Vive encima de las demás ventanas, se mueve solo con física orgánica, reacciona al contexto real del usuario (teclado, micrófono, hora del día), escucha comandos de voz y responde con voz usando un LLM local.

---

## Índice

1. [Estructura del monorepo](#1-estructura-del-monorepo)
2. [Stack tecnológico](#2-stack-tecnológico)
3. [Arquitectura completa — diagrama](#3-arquitectura-completa--diagrama)
4. [Cómo levantar](#4-cómo-levantar)
5. [Ventana Tauri](#5-ventana-tauri)
6. [Pipeline de voz](#6-pipeline-de-voz)
7. [Ambient Engine](#7-ambient-engine)
8. [Behavior Engine + Sensory Layer](#8-behavior-engine--sensory-layer)
9. [Sistema de física](#9-sistema-de-física)
10. [Sistema de estados del avatar](#10-sistema-de-estados-del-avatar)
11. [Sistema de personajes](#11-sistema-de-personajes)
12. [Flujo de chat](#12-flujo-de-chat)
13. [buddy-server — rutas y configuración](#13-buddy-server--rutas-y-configuración)
14. [packages/core — módulos compartidos](#14-packagescore--módulos-compartidos)
15. [Persistencia (localStorage)](#15-persistencia-localstorage)
16. [Tray icon](#16-tray-icon)
17. [Gotchas conocidos](#17-gotchas-conocidos)
18. [Visión — los 5 subsistemas](#18-visión--los-5-subsistemas)

---

## 1. Estructura del monorepo

```
buddy/
├── apps/
│   └── desktop/                  ← app Tauri principal
│       ├── src/                  ← React + TypeScript
│       │   ├── BuddyOverlay.tsx  ← componente raíz, integra todo
│       │   ├── physics.ts        ← motor de física con easing
│       │   ├── hooks/
│       │   │   ├── useBuddy.ts   ← chat + estado del avatar
│       │   │   ├── useSensors.ts ← escucha eventos sensor-snapshot
│       │   │   ├── useMood.ts    ← wrappea MoodEngine
│       │   │   ├── useVoice.ts   ← VAD + Whisper STT + intent routing
│       │   │   └── useTTS.ts     ← Piper TTS → AudioContext
│       │   └── characters/       ← registry + CharacterPicker
│       └── src-tauri/            ← Rust (ventana, tray, sensores)
│           ├── src/
│           │   ├── main.rs       ← comandos Tauri + setup + single-instance
│           │   ├── sensors.rs    ← cpal mic + rdev input + emit + VAD
│           │   ├── voice.rs      ← VAD state machine + grabación de audio
│           │   ├── sidecar.rs    ← lanza buddy-server
│           │   └── passthrough.rs
│           └── Cargo.toml
├── packages/
│   ├── core/                     ← lógica compartida
│   │   └── src/
│   │       ├── math-utils.ts
│   │       ├── sensor-bus.ts
│   │       ├── mood-engine.ts
│   │       ├── behavior-engine.ts
│   │       ├── llm-client.ts     ← cliente HTTP /chat (maneja avatar_id snake_case)
│   │       ├── intent-router.ts  ← wake word + fuzzy matching + comandos
│   │       ├── ambient-engine.ts ← reacciones espontáneas cada ~3min
│   │       └── avatar-state.ts
│   ├── renderer/                 ← componentes de personaje
│   └── types/                    ← tipos compartidos
├── server/                       ← buddy-server (Rust/Axum)
│   ├── src/
│   │   ├── main.rs               ← carga .env, define rutas
│   │   ├── state.rs
│   │   └── routes/
│   │       ├── chat.rs           ← POST /chat (strip <think>, enable_thinking:false)
│   │       ├── transcribe.rs     ← POST /transcribe → Whisper
│   │       ├── tts.rs            ← POST /tts → Piper
│   │       ├── mood.rs           ← POST /mood
│   │       ├── avatars.rs
│   │       └── health.rs
│   └── .env                      ← configuración local (no en git)
├── piper-server/                 ← imagen Docker para Piper TTS
│   ├── Dockerfile
│   └── server.py                 ← FastAPI, POST /tts → WAV
├── start.ps1                     ← instalador/launcher de un click
├── start.bat                     ← wrapper para double-click desde Windows
└── docs/
```

---

## 2. Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Ventana nativa | **Tauri 2** (Rust) |
| Single-instance | **tauri-plugin-single-instance** |
| UI | **React 19** + TypeScript (Vite, sin framework) |
| Animaciones Rive | **@rive-app/react-canvas v4** |
| Animaciones canvas | HTML5 Canvas 2D (`AuroraCharacter`) |
| Paquetes | **pnpm workspaces** (monorepo) |
| Captura de audio | **cpal 0.15** (Rust) |
| Sensores de input | **rdev 0.5** (Rust) — hook global teclado/mouse |
| VAD (Voice Activity Detection) | Rust, threshold RMS 0.015, min 700ms |
| STT (Speech-to-Text) | **Whisper** vía `fedirz/faster-whisper-server:latest-cuda` (Docker, puerto 8080) |
| TTS (Text-to-Speech) | **ElevenLabs** (primario, API cloud) / **Piper** Docker `buddy-piper` (fallback, puerto 5200) |
| Servidor backend | `buddy-server` — Axum/Rust, binario sidecar |
| LLM | LM Studio en `OLLAMA_URL` (modelo `qwen3-8b` o similar) |
| Audio playback | Web Audio API (`AudioContext`) |

---

## 3. Arquitectura completa — diagrama

```
Hardware
  Micrófono ──► cpal (RMS) ──► VAD (voice.rs)
                                    │
                         audio grabado (WAV mono 16kHz)
                                    │
                         POST /transcribe (buddy-server)
                                    │
                         Whisper Docker (puerto 8080)
                         faster-whisper-large-v3, vad_filter=true
                                    │
                         texto transcrito
                                    │
                         intent-router.ts
                         detectIntent(transcript, wakeWord, commands)
                             ├── wake_word → useBuddy.sendMessage(text)
                             │                   │
                             │          POST /chat → LM Studio
                             │          ← respuesta en texto
                             │                   │
                             │          POST /tts → buddy-server → ElevenLabs API
                             │          (fallback: Piper Docker 5200)
                             │          ← MP3 / WAV audio
                             │                   │
                             │          AudioContext.play()
                             │          SpeechBubble en pantalla
                             │
                             └── command → handleCommand() (sleep/wake/walk)

  Teclado/Mouse ──► rdev ──►┐
  Reloj del sistema ─────────┤
                             │
                   sensors.rs → emit "sensor-snapshot" cada 5s
                             │
                   useSensors → SensorSnapshot
                             │
                   useMood → MoodEngine → POST /mood (trigger) → LM Studio
                             │
                   BuddyOverlay → moodToParams() → Physics loop (RAF)
                             │
                   AmbientEngine (~3min, 40% prob)
                   → POST /chat → LM Studio
                   → POST /tts → ElevenLabs (o Piper fallback)
                   → SpeechBubble espontáneo
```

---

## 4. Cómo levantar

### Producción (un click)

```
double-click start.bat
```

El script `start.ps1` hace todo automáticamente:
1. Verifica que Docker esté corriendo
2. Crea/inicia el contenedor `local-stt-server` (Whisper, puerto 8080)
3. Crea/inicia el contenedor `buddy-piper` (Piper TTS, puerto 5200)
4. Compila `buddy-server` si no existe el binario release
5. Mata cualquier instancia previa y lanza `buddy-server`
6. Compila la app Tauri si no existe el binario release
7. Lanza `buddy-desktop.exe`

Primera ejecución: descarga ~6GB (modelo Whisper large-v3) + construye imágenes Docker. Las siguientes son inmediatas.

### Dev

```powershell
# Terminal 1 — backend
cd server && cargo run

# Terminal 2 — app
cd apps/desktop && pnpm dev
# pnpm dev = pnpm copy-sidecar && tauri dev
```

**Importante:** `tauri dev` compila en debug mode. En este proyecto el GNU toolchain tiene problemas con STATUS_STACK_BUFFER_OVERRUN en debug. Si falla, usar el binario release directamente.

**Build release:** cerrar LM Studio antes de compilar con `cargo build --release`. El LLVM del toolchain GNU se queda sin memoria si qwen3-8b está cargado al mismo tiempo. El `[profile.release]` ya está configurado con `opt-level=1, codegen-units=8` para reducir el consumo de memoria del optimizador.

### Variables de entorno (`server/.env`)

```
OLLAMA_URL=http://192.168.5.1:1234   ← URL de LM Studio (puede ser localhost o red local)
LLM_MODEL=qwen3-8b                   ← modelo cargado en LM Studio
PIPER_URL=http://localhost:5200      ← Piper TTS (fallback)
WHISPER_URL=http://localhost:8080    ← Whisper STT
WHISPER_PROMPT=buddy                 ← hint para Whisper (mejora transcripción del wake word)
WHISPER_LANG=es                      ← idioma esperado
PORT=7788                            ← puerto del servidor (default)
ELEVENLABS_API_KEY=sk_...            ← API key de ElevenLabs (opcional — si no está, usa Piper)
ELEVENLABS_VOICE_ID=JBFqnCBsd6RMkjVDRZzb  ← voz por defecto (Georges)
```

---

## 5. Ventana Tauri

Configurada en `apps/desktop/src-tauri/tauri.conf.json`:

```
transparent: true
decorations: false
alwaysOnTop: true   ← dinámico vía set_z_order
skipTaskbar: true
resizable: false
```

El tamaño de la ventana es **dinámico** — se ajusta vía `invoke('set_window_size', {w, h})`:

| Estado | Ancho | Alto |
|--------|-------|------|
| Compacto (idle) | 260 | 220 |
| Speech bubble | 260 | 310 |
| Chat / menú | 260 | 480 |
| Paneles de config | 360 | 640 |

### Single-instance

`tauri-plugin-single-instance` evita que se abran múltiples ventanas. Si se lanza una segunda instancia, la primera sube al frente automáticamente.

### Comandos Tauri (JS → Rust)

| Comando | Parámetros | Descripción |
|---------|-----------|-------------|
| `move_window` | `x, y` | Mueve la ventana a coordenadas lógicas |
| `set_window_size` | `w, h` | Redimensiona la ventana (ver tabla de tamaños) |
| `get_monitor_bounds` | — | Retorna `[x, y, w, h]` del monitor actual |
| `set_anchor` | `anchored: bool` | Activa/desactiva modo anclado |
| `set_ignore_cursor` | `ignore: bool` | Passthrough de mouse (click-through) |
| `set_z_order` | `on_top: bool` | Alterna si la ventana está siempre encima |
| `set_panels_open` | `open: bool` | Notifica a click-through si hay paneles abiertos |
| `get_audio_devices` | — | Lista dispositivos de entrada de audio |
| `set_mic_device` | `device_name: string` | Cambia el micrófono activo |
| `get_screens` | — | Lista monitores disponibles (`ScreenInfo[]`) |
| `capture_screen` | `monitor: string` | Captura pantalla — `"buddy"` sigue al avatar, `"0"`, `"1"`… por índice; retorna PNG base64 |
| `open_devtools` | — | Abre DevTools (debug) |

### Eventos Tauri (Rust → JS)

| Evento | Payload | Descripción |
|--------|---------|-------------|
| `anchor-changed` | `boolean` | El tray cambió el estado de ancla |
| `sensor-snapshot` | `SensorPayload` | Snapshot de sensores cada 5 segundos |
| `mic-level` | `{ level: number, active: boolean }` | Nivel RMS del micrófono (~200ms) |
| `voice-transcript` | `{ text: string }` | Transcripción de Whisper lista |

**CRÍTICO — shadowBlur:**
`ctx.shadowBlur` en un canvas HTML dentro de una ventana transparente de Tauri corrompe el compositor DWM de Windows (ventana negra). **Nunca usar `shadowBlur`.** Usar múltiples pasadas de arcos anchos (fake glow).

---

## 6. Pipeline de voz

### VAD — Voice Activity Detection (`voice.rs`)

El VAD es una máquina de estados en Rust que analiza el nivel RMS del micrófono en tiempo real.

```
Idle ──────── RMS > 0.015 ──────────► Recording
  ▲                                       │
  │                              RMS < 0.015 durante 300ms
  │                                       ▼
  │                                   Trailing
  │                                       │
  │                         RMS sube → Recording (continúa)
  │                         o 300ms trailing completo
  │                                       │
  └── duración < 700ms (ruido) ◄──────────┘
                                           │
                              duración ≥ 700ms → emite WAV
                              → POST /transcribe
```

Parámetros clave:
- **Threshold**: `0.015` RMS (calibrado para distinguir voz de ruido ambiental)
- **Duración mínima**: `700ms` (filtra clicks, ruidos cortos)
- **Trailing**: `300ms` de silencio antes de cerrar la grabación

**Stereo → mono:** `sensors.rs` detecta el número de canales del micrófono. Si es estéreo, hace downmix promediando los canales antes de almacenar el buffer.

### Whisper STT

Servicio Docker `fedirz/faster-whisper-server:latest-cuda` en puerto 8080.

Modelo: `Systran/faster-whisper-large-v3` (se descarga automáticamente en `~/.cache/huggingface`).

Request desde `transcribe.rs`:
```
POST /v1/audio/transcriptions (multipart)
  file: audio.wav
  model: Systran/faster-whisper-large-v3
  language: es
  prompt: buddy           ← hint para que reconozca el wake word
  vad_filter: true        ← Whisper filtra silencio internamente también
```

**Filtro de alucinaciones (`useVoice.ts`):** Whisper a veces transcribe ruido como "Gracias por ver el video", "Suscríbete", etc. Se filtran client-side antes de pasarlos al intent router.

### Wake word e intent routing (`intent-router.ts`)

```typescript
detectIntent(transcript, wakeWord, commands)
  → { type: 'wake_word' | 'command' | 'none', text?, command? }
```

Lógica de matching (en orden de prioridad):

1. **Exact match** del wake word en el transcript (case-insensitive)
2. **Fuzzy match** — Levenshtein distance ≤ 2 (maneja "Body" en vez de "Buddy", "Orbe" en vez de "Orb")
3. **Universal triggers** — si el transcript empieza con `oye`, `hey`, o `ey`, siempre se activa sin importar el personaje. Esto es porque Whisper transcribe estas palabras correctamente en todos los dialectos de español.

El wake word se configura por personaje en `characters/registry.ts`. Actualmente todos usan el mismo fallback a los universal triggers.

`extractText()` limpia el transcript removiendo el trigger + nombre del personaje antes de pasarlo al LLM.

### TTS — Text-to-Speech (`useTTS.ts` + ElevenLabs + Piper fallback)

Flujo:
```
texto → POST http://localhost:7788/tts → buddy-server
  → si ELEVENLABS_API_KEY está configurado:
      POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}
      header: xi-api-key, model: eleven_v4, output_format: mp3_44100_128
      ← MP3 audio/mpeg
  → si falla o no hay clave:
      POST http://localhost:5200/tts → Piper Docker
      ← WAV audio
← ArrayBuffer → AudioContext.decodeAudioData() → BufferSource.start()
```

**AudioContext persistente:** se crea una vez y se reutiliza. Si el navegador lo suspende (política de autoplay tras inactividad), se llama `ctx.resume()` antes de reproducir.

**ElevenLabs:** requiere plan de pago para usar voces de la biblioteca vía API (plan free retorna `paid_plan_required`). Voz por defecto `JBFqnCBsd6RMkjVDRZzb` (Georges). El voice_id se cambia con `ELEVENLABS_VOICE_ID` en `.env`. Para explorar voces en español, usar el catálogo en elevenlabs.io/app/voice-library.

**Piper Docker** (`buddy-piper`): imagen custom construida desde `piper-server/`. Descarga el binario de Piper y el modelo de voz `es_MX-claude-high.onnx`. Puerto 5200 (evita los rangos 4924-5023 y 5041-5140 bloqueados por Hyper-V en Windows). Sigue siendo el fallback si ElevenLabs no está disponible.

---

## 7. Ambient Engine

`packages/core/src/ambient-engine.ts`

El Ambient Engine genera reacciones espontáneas sin que el usuario hable. Buddy "comenta" lo que pasa en el entorno.

### Timing

```
Primera reacción: gaussian(2min, 1min) después de arrancar
Reacciones siguientes: gaussian(3min, 1min)
Probabilidad de disparar: 40%
Anti-spam: mínimo 90s entre reacciones
Sleep automático: si hay silencio > 5min sin actividad
```

### Contexto que usa

Cada reacción incluye un contexto construido desde el `SensorSnapshot` + `Mood` actual:

- Hora del día (mañana/tarde/noche/madrugada)
- Nivel de actividad del teclado (tecleando intensamente / tranquilo / idle)
- Audio ambiente (silencio / música / voces) + duración
- Si es noche, si es fin de semana
- Mood actual del avatar

### Flujo

```
AmbientEngine.update(snapshot, mood, onSleep)
  → ¿es hora de reaccionar? (nextCheckAt)
  → ¿pasó el 40% de probabilidad?
  → ¿han pasado 90s desde la última?
  → buildContext(snapshot, mood)
  → LlmClient.chat({ message: 'reacción espontánea', personality: context })
  ← texto de reacción
  → BuddyOverlay: setBubbleText() + speak()
```

**Nota importante:** el Ambient Engine usa `LlmClient` (en `llm-client.ts`) que serializa correctamente a `avatar_id` (snake_case). No usar `fetch` directo — el servidor Rust espera snake_case.

---

## 8. Behavior Engine + Sensory Layer

Este es el sistema nervioso de Buddy. Convierte señales del entorno en parámetros de movimiento.

### Flujo de datos

```
SensorSnapshot (cada 5s)
    → detectTrigger() → ¿cambio significativo?
        ├── No → usa Mood actual (sin llamada al LLM)
        └── Sí → POST /mood → LM Studio → MoodDecision JSON
                                              ↓
                                    Mood { name, energy, restlessness, zOrder }
                                              ↓
                                    moodToParams(mood)
                                              ↓
                                    BehaviorParams { walkFrequencyMs, walkSpeedPx,
                                                     walkRadius, fidgetEnabled,
                                                     fidgetIntervalMs, fidgetRadiusPx }
                                              ↓
                                    Physics loop (RAF) — sin latencia
```

### Tipos clave

```typescript
interface SensorSnapshot {
  timestamp: number
  mic:   { active: boolean; level: number }
  input: { keyRate: number; mouseDistance: number;
           level: InputLevel; idleDuration: number }
  time:  { hour: number; isNight: boolean; isWeekend: boolean }
  ambientType: 'silence' | 'speech' | 'music'
  ambientDurationS: number
  inputLevel: 'idle' | 'light' | 'heavy'
  keyRate: number
}

interface Mood {
  name:         'playful' | 'focused' | 'tired' | 'curious' | 'calm' | 'sleepy'
  energy:       'very_low' | 'low' | 'medium' | 'high' | 'very_high'
  restlessness: 'still' | 'slow' | 'normal' | 'active' | 'restless'
  zOrder:       'top' | 'normal' | 'behind'
  expiresAt:    number
}
```

### Fallback por hora del día (sin LLM)

| Hora | Mood | Energy |
|------|------|--------|
| 6–9h | calm | low |
| 9–13h | curious | medium |
| 13–15h | tired | very_low |
| 15–19h | playful | high |
| 19–22h | calm | medium |
| 22–6h | sleepy | very_low |

---

## 9. Sistema de física

Archivo: `apps/desktop/src/physics.ts`

### Easing — smoothstep

```
speedMult = 0.25 + 0.75 × sin(smoothstep(progress) × π)
  progress=0 → speedMult=0.25 (arranca lento)
  progress=0.5 → speedMult=1.0 (velocidad máxima)
  progress=1 → speedMult=0.25 (frena al llegar)
```

### Timing orgánico

```typescript
gaussian(mean, std) → distribución normal, Box-Muller transform
```

### Ciclo completo de movimiento

```
1. scheduleNextWalk(gaussian(walkFrequencyMs, walkFrequencyMs × 0.4))
2. Timer → setWalkTarget(clampedWalkTarget(pos, walkRadius))
3. RAF → tickPhysics() → llega → stopWalking(), save pos
4. Mientras espera → scheduleFidget() (micro-movimientos)
```

---

## 10. Sistema de estados del avatar

```
idle ──startWalking──► walk ──stopWalking──► idle
 │                                            ▲
 ├──sendMessage──► think ──receiveResponse──► talk ──finishTalking──► idle
 ├──reactHappy──► react_happy ──finishReacting──► idle
 └──setSleep──► sleep ──wakeUp──► idle
```

**Auto-sleep:** 3 min sin actividad → `sleep`
**Fidgets:** `isFidget: true` en physics → no cambia el estado del avatar

---

## 11. Sistema de personajes

### Personajes disponibles

| ID | Nombre | Wake words | Tipo |
|----|--------|-----------|------|
| `ai-orb` | Orb | oye, hey, ey | rive |
| `joy` | Joy | oye, hey, ey | rive |
| `kabi` | Kabi | oye, hey, ey | rive |
| `aurora` | Aurora | oye, hey, ey | canvas |

Todos los personajes tienen `"Solo texto plano, sin emojis."` en su prompt de personalidad — esto previene que el LLM genere texto con emojis que Piper (o ElevenLabs) leería literalmente.

### RiveCharacter — patrón clave

`key={resolvedAnim}` en el subcomponente `RiveAnim` — cambiar de animación desmonta y remonta el componente, que es la única forma confiable de cambiar animaciones en Rive v4. **No usar `rive.stop()/play()`**: `stop()` sin argumentos resetea el canvas al frame 0 (pose por defecto con ojos cerrados) antes de que `play()` tome efecto, causando un glitch visible.

---

## 12. Flujo de chat

```
Usuario habla → VAD → WAV → POST /transcribe → Whisper → texto
  → detectIntent() → wake_word detectado → useBuddy.sendMessage(text)
    → AvatarStateMachine.sendMessage() → estado: think
    → LlmClient.chat(params) → POST /chat → LM Studio
    ← respuesta
    → AvatarStateMachine.receiveResponse() → estado: talk
    → setBubbleText() + speak()
    → POST /tts → ElevenLabs (o Piper fallback) → MP3/WAV → AudioContext.play()
    → setTimeout(4s) → finishTalking() → estado: idle
```

---

## 13. buddy-server — rutas y configuración

Binario Rust/Axum que Tauri lanza como sidecar. Lee configuración desde `server/.env` (via `dotenvy`).

### Rutas

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/health` | `{ status: "ok", version: "0.1.0" }` |
| GET | `/avatars` | Lista avatares disponibles |
| POST | `/chat` | Conversación con LLM (respuesta completa) |
| POST | `/chat/stream` | Conversación con LLM (SSE streaming — usado por defecto) |
| POST | `/transcribe` | Audio WAV → texto (via Whisper) |
| POST | `/tts` | Texto → audio MP3/WAV (ElevenLabs primario, Piper fallback) |
| POST | `/mood` | Decisión de mood via JSON Schema |
| GET/PUT | `/context/config` | Lee o actualiza `ContextConfig` (memoria, screencap) |
| POST | `/context/screenshot` | Recibe PNG base64 → analiza con Claude Haiku → guarda en memoria |
| POST | `/context/memory` | Guarda una entrada de memoria manualmente |
| GET | `/context/memories` | Lista entradas de memoria |
| DELETE | `/context/memories` | Borra todas las entradas de memoria |

### POST /chat — detalles

Request (los campos son snake_case en JSON):
```json
{
  "message": "...",
  "avatar_id": "aurora",
  "personality": "Eres Aurora...",
  "history": [{ "role": "user", "content": "..." }]
}
```

El servidor agrega `"enable_thinking": false` a la petición del LLM. Esto es necesario para `qwen3` — sin ello el modelo devuelve `content: ""` con el razonamiento en un campo separado y Buddy no muestra nada. También stripea cualquier bloque `<think>...</think>` residual de la respuesta.

### POST /transcribe — detalles

Recibe audio WAV como `multipart/form-data`, lo reenvía a Whisper con:
- `vad_filter: true` — Whisper filtra silencio internamente
- `language: es` (desde `WHISPER_LANG`)
- `prompt: buddy` (desde `WHISPER_PROMPT`) — mejora el reconocimiento del wake word

### Variables de entorno

| Variable | Default | Descripción |
|----------|---------|-------------|
| `PORT` | `7788` | Puerto del servidor |
| `ANTHROPIC_API_KEY` | — | Requerida para análisis de pantalla (Claude Haiku en /context/screenshot) |
| `OLLAMA_URL` | `http://localhost:11434` | URL del LLM (LM Studio u Ollama) |
| `LLM_MODEL` | `llama3.2:3b` | Modelo para /chat |
| `PIPER_URL` | `http://localhost:5200` | URL de Piper TTS (fallback) |
| `WHISPER_URL` | `http://localhost:8080` | URL de Whisper STT |
| `WHISPER_PROMPT` | — | Hint de transcripción |
| `WHISPER_LANG` | — | Idioma para Whisper |
| `ELEVENLABS_API_KEY` | — | API key de ElevenLabs (sin esto, solo usa Piper) |
| `ELEVENLABS_VOICE_ID` | `JBFqnCBsd6RMkjVDRZzb` | ID de voz ElevenLabs (Georges) |

---

## 14. packages/core — módulos compartidos

| Módulo | Exporta | Descripción |
|--------|---------|-------------|
| `math-utils.ts` | `smoothstep`, `gaussian` | Funciones matemáticas |
| `sensor-bus.ts` | `SensorSnapshot`, `classifyInput` | Bus de sensores |
| `mood-engine.ts` | `Mood`, `MoodEngine`, `fallbackMood` | Motor de mood |
| `behavior-engine.ts` | `BehaviorParams`, `moodToParams` | Mood → movimiento |
| `llm-client.ts` | `LlmClient` | Cliente HTTP /chat (serializa a snake_case) |
| `intent-router.ts` | `detectIntent`, `levenshtein` | Wake word + routing |
| `ambient-engine.ts` | `AmbientEngine` | Reacciones espontáneas |
| `avatar-state.ts` | `AvatarStateMachine` | Máquina de estados |

---

## 15. Persistencia (localStorage)

| Clave | Contenido |
|-------|-----------|
| `buddy-pos` | `{x, y}` — posición de la ventana |
| `buddy-character-v2` | ID del personaje activo |
| `buddy-avatar-config` | `{name, personality}` |
| `buddy-history` | `Message[]`, máx. 30 |
| `buddy-tts-voice` | `boolean` — TTS de voz activado |
| `buddy-tts-text` | `boolean` — speech bubble activado |
| `buddy-tts-volume` | `number` — volumen TTS (0–1) |
| `buddy-mic-enabled` | `boolean` — micrófono activado |
| `buddy-anims-{id}` | Mapa de animaciones custom por personaje (ej. `buddy-anims-kabi`) |

---

## 16. Tray icon

Ícono naranja (#FF6B35) generado en memoria. Menú:
- **Ocultar/Mostrar** — toggle de visibilidad
- **Anclar/Desanclar** — congela el movimiento autónomo
- **Cerrar Buddy**

El estado de ancla se sincroniza entre Rust (tray) y React (evento `anchor-changed`).

---

## 17. Gotchas conocidos

| Problema | Causa | Solución |
|----------|-------|----------|
| Ventana negra con Aurora | `shadowBlur` en canvas transparente corrompe DWM de Windows | Nunca usar shadowBlur — usar fake glow (3 pasadas) |
| Dos animaciones en Rive | React.StrictMode remonta en dev, Rive no limpia el canvas | StrictMode desactivado en `main.tsx` — no reactivar |
| `rive.stop()` causa ojos cerrados / glitch | `stop()` sin args resetea el canvas al frame 0 (pose por defecto) antes de que `play()` tome efecto | `key={animName}` en `RiveAnim` — remount completo al cambiar animación |
| Warnings de deprecación en Rive | La API usa `animations` (deprecated) en vez de `stateMachine` | Filtrados en `console.warn` en `main.tsx` |
| Ambient engine no reacciona | `avatarId` vs `avatar_id` — el servidor Rust requiere snake_case | Siempre usar `LlmClient` para /chat, nunca `fetch` directo |
| qwen3 devuelve vacío | Thinking mode activo devuelve `content: ""` | `enable_thinking: false` + strip `<think>` en `chat.rs` |
| AudioContext suspendido | Browser suspende el contexto tras inactividad | `ctx.resume()` en `useTTS.ts` antes de reproducir |
| Whisper transcribe basura | Ruido ambiental → alucinaciones ("Gracias por ver el video") | `vad_filter=true` en Whisper + filtro client-side en `useVoice.ts` |
| "buddy" transcrito como "Body" | Whisper tiende a corregir palabras raras | Levenshtein ≤ 2 en `intent-router.ts` + `WHISPER_PROMPT=buddy` |
| Piper en puertos 5000/5001 | Bloqueados por Hyper-V (rangos reservados Windows) | Puerto 5200 |
| STATUS_STACK_BUFFER_OVERRUN en rustc | GNU toolchain crashea compilando crates grandes en debug mode | Compilar siempre con `--release`; `cargo clean` si persiste |
| LLVM out of memory en release | GNU LLVM no tiene suficiente RAM si LM Studio tiene qwen3-8b cargado durante la compilación | Cerrar LM Studio antes de `cargo build --release`. El perfil release usa `opt-level=1, codegen-units=8` para aliviar la presión |
| LLVM OOM corrompe la stdlib | El crash por OOM deja archivos de la sysroot corruptos (`cannot find trait PartialEq`) | `rustup toolchain uninstall stable-x86_64-pc-windows-gnu && rustup toolchain install stable-x86_64-pc-windows-gnu` |
| ElevenLabs `paid_plan_required` | El plan Free no puede usar voces de la biblioteca vía API | Requiere plan de pago ($11/mes). Voces clonadas propias sí funcionan en Free |
| Dos instancias del avatar | `Start-Process` sin verificar si ya hay una corriendo | `tauri-plugin-single-instance` + `taskkill` en `start.ps1` |
| Sidecar no encontrado en dev | Tauri busca en `target/debug/`, no en `binaries/` | `copy-sidecar` script lo copia antes de `tauri dev` |

---

## 18. Visión — los 5 subsistemas

### Subsistema 1 — Behavior Engine + Sensory Layer ✅ IMPLEMENTADO

Sensores (mic, teclado, hora) → motor de mood LLM-driven → física orgánica.

### Subsistema 2 — Pipeline de Voz ✅ IMPLEMENTADO

VAD (Rust) → Whisper STT → intent routing → LLM → Piper TTS. Wake words fuzzy, ambient reactions espontáneas cada ~3min.

### Subsistema 3 — MCP Tools (próximo)

Buddy ejecuta acciones reales: buscar en web, crear eventos, leer archivos. Implementado como herramientas MCP que buddy-server expone al LLM durante el chat.

### Subsistema 4 — Memoria persistente ✅ IMPLEMENTADO

`MemoryStore` persiste en `server/buddy-memory.json`. Cada entrada (`MemoryEntry`) tiene `id`, `timestamp`, `source` (`"conversation"` o `"screenshot"`), `avatar_id`, y `summary`. `build_system_prompt()` inyecta las últimas N entradas en el prompt de sistema como `[Contexto reciente]`. Configurable desde `ContextPanel` (habilitar/deshabilitar, cantidad a inyectar, ruta del archivo).

### Subsistema 5 — Visión (pantalla) ✅ IMPLEMENTADO (screencap)

`capture_screen` (WinAPI `BitBlt`, sin dependencias externas) captura el monitor donde está Buddy, redimensiona a máx. 1280px y retorna PNG base64. `useScreencap` envía la captura a `POST /context/screenshot` en un intervalo configurable. El servidor llama a Claude Haiku con la imagen para describir lo que hace el usuario y guarda el resultado en memoria. Cámara web: pendiente.

---

*Última actualización: 2026-10-29 — Sistema de memoria (MemoryStore + ContextPanel + streaming), conciencia de pantalla (capture\_screen + useScreencap), personaje Kabi, tamaño de ventana dinámico, Ctrl+Shift+Space global shortcut.*
