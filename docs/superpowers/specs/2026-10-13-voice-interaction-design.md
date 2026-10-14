# Voice Interaction System — Design Spec

## Goal

Add a full voice layer to Buddy: the avatar listens to the environment, understands spoken commands, responds with text (speech bubble) and voice (TTS), and reacts autonomously to ambient audio.

## Architecture

```
Mic (existing RMS) ──► VAD recorder (voice.rs)
                              │
                              ▼ voice-captured (WAV base64)
                        useVoice.ts
                              │
                              ▼ POST /transcribe
                        buddy-server ──► Whisper HTTP (WHISPER_URL)
                              │
                              ▼ { transcript }
                        Intent Router
                         ├── wake word   ──► sendMessage() ──► /chat ──► SpeechBubble + TTS
                         ├── command     ──► AvatarStateMachine + random phrase ──► SpeechBubble + TTS
                         └── nothing     ──► ignore

Ambient classifier (voice.rs) ──► useAmbient.ts
                         ├── silence N min  ──► sleep
                         ├── music detected ──► playful mood
                         └── gaussian timer ──► AmbientEngine ──► /chat ──► SpeechBubble + TTS
```

## Tech Stack

- **STT**: Any OpenAI-compatible `/v1/audio/transcriptions` endpoint (whisper.cpp server, faster-whisper, LM Studio with Whisper model). Configured via `WHISPER_URL` env var.
- **TTS**: Piper HTTP server. Configured via `PIPER_URL` env var.
- **Audio capture**: existing `cpal` in `sensors.rs` extended in new `voice.rs`.
- **Frontend**: React hooks + Web Audio API for playback.

---

## Feature 1: Speech Bubble

### Files

- Create: `apps/desktop/src/SpeechBubble.tsx`
- Modify: `apps/desktop/src/BuddyOverlay.tsx` — add bubble slot above avatar

### Component

```tsx
interface Props {
  text: string          // full text to display
  onDone: () => void    // called after auto-dismiss
}
```

- Renders above the avatar character (positioned at `top: 0`, transforms upward)
- Typewriter animation: reveal one character every 30ms
- Auto-dismiss: after full text revealed, wait `text.length * 40ms` (min 2s, max 6s), then fade out and call `onDone`
- Style: dark semi-transparent bubble with tail pointing down toward avatar, max-width 220px, border-radius 14px, font-size 13px
- No close button — auto-managed
- If new text arrives while displaying: replace immediately (restart typewriter)

### BuddyOverlay integration

```tsx
const [bubbleText, setBubbleText] = useState<string | null>(null)

// above the character div, zIndex 30:
{bubbleText && (
  <SpeechBubble text={bubbleText} onDone={() => setBubbleText(null)} />
)}
```

`setBubbleText` is passed down to useVoice, useTTS, and useAmbient hooks.

### Visual layout

```
┌─────────────────────┐  ← zIndex 30, absolute, bottom anchored above avatar
│ ¡Hola! ¿En qué te  │
│ puedo ayudar?       │
└────────▼────────────┘
   [avatar 200×200]        ← zIndex 10
```

---

## Feature 2: Voice Input Pipeline (STT)

### Files

- Create: `apps/desktop/src-tauri/src/voice.rs`
- Modify: `apps/desktop/src-tauri/src/main.rs` — mod voice, launch_voice
- Create: `server/src/routes/transcribe.rs`
- Modify: `server/src/routes/mod.rs` — add /transcribe route
- Modify: `server/src/state.rs` — add whisper_url field
- Create: `apps/desktop/src/hooks/useVoice.ts`

### voice.rs — VAD recorder

Runs as a separate thread. Shares the existing `InputState` Arc for the RMS level. Does NOT create a second cpal stream — reads `mic_level` from shared state every 50ms.

```rust
pub struct VoiceConfig {
    pub enabled: bool,
}

pub fn launch_voice(app: AppHandle, state: Arc<Mutex<InputState>>)
```

State machine:
- `Idle`: mic_level < 0.02 → stay idle
- `Recording`: mic_level >= 0.02 → set `recording: true` flag on shared `InputState`; the existing cpal callback in `sensors.rs` pushes samples into a `recording_buffer: Vec<f32>` when that flag is set
- `Trailing`: mic_level < 0.02 for > 500ms → clear flag, drain buffer, encode WAV, emit event

Note: a single cpal stream is shared; sensors.rs is modified to push to `recording_buffer` when `recording == true`.

On finalize:
```rust
app.emit("voice-captured", VoiceCapturedPayload {
    audio_b64: base64_encode(wav_bytes),
    duration_ms: u64,
})
```

Minimum recording duration: 300ms (ignore noise blips).
Maximum recording duration: 30s (auto-finalize to avoid runaway recordings).

WAV encoding: 16kHz mono f32→i16, standard RIFF header. Whisper expects 16kHz mono.

### /transcribe endpoint

```rust
// server/src/routes/transcribe.rs
#[derive(Deserialize)]
pub struct TranscribeRequest {
    pub audio_b64: String,   // base64 WAV
}

#[derive(Serialize)]
pub struct TranscribeResponse {
    pub transcript: String,
}

pub async fn transcribe(
    State(state): State<AppState>,
    Json(req): Json<TranscribeRequest>,
) -> Result<Json<TranscribeResponse>, StatusCode>
```

Implementation:
1. Decode base64 → temp WAV file (in OS temp dir, deleted after)
2. Send to `{whisper_url}/v1/audio/transcriptions` as multipart form:
   - `file`: WAV bytes
   - `model`: `whisper-1` (standard OpenAI field, most servers accept it)
   - `language`: `es` (configurable via `WHISPER_LANG` env var, default `es`)
3. Return `{ transcript }` or 502 on failure

### state.rs update

```rust
pub struct AppState {
    pub ollama_url: String,
    pub mood_url: String,
    pub whisper_url: String,   // NEW
    pub piper_url: String,     // NEW (for Feature 4)
    pub avatars_dir: String,
    pub http: reqwest::Client,
}
```

`whisper_url` defaults to `WHISPER_URL` env var or `http://localhost:8080`.
`piper_url` defaults to `PIPER_URL` env var or `http://localhost:5000`.

### useVoice.ts hook

```typescript
export function useVoice(onTranscript: (text: string) => void): void
```

- Listens to `voice-captured` Tauri event
- POSTs audio to `{SERVER_URL}/transcribe`
- On success: calls `onTranscript(transcript)`
- On failure: silently ignores (no UI error — user just doesn't get a response)

---

## Feature 3: Intent Router + Gesture Commands

### Files

- Create: `packages/core/src/intent-router.ts`
- Modify: `packages/core/src/index.ts` — export intent types
- Modify: `apps/desktop/src/characters/registry.ts` — add commands field
- Modify: `apps/desktop/src/BuddyOverlay.tsx` — wire useVoice + intent router

### packages/core/src/intent-router.ts

```typescript
export interface VoiceCommand {
  triggers: string[]        // ["duerme", "a dormir", "échate a dormir"]
  action: AvatarAction      // 'sleep' | 'wakeUp' | 'walk' | 'dance' | 'react'
  responses?: string[]      // ["Buenas noches 😴", "Qué sueño..."] — one picked at random
}

export type AvatarAction = 'sleep' | 'wakeUp' | 'walk' | 'dance' | 'react'

export interface IntentResult {
  type: 'wake_word' | 'command' | 'none'
  text?: string             // stripped text for wake_word
  command?: VoiceCommand    // matched command for 'command'
}

export function detectIntent(
  transcript: string,
  wakeWord: string,
  commands: VoiceCommand[],
): IntentResult
```

Matching rules:
- **Wake word**: `transcript.toLowerCase().includes(wakeWord.toLowerCase())` → strip wake word and leading/trailing whitespace → `{ type: 'wake_word', text: stripped }`
- **Command**: for each command, check if `transcript.toLowerCase()` includes any trigger → `{ type: 'command', command }`
- Wake word check runs first; if match, skip command check
- **None**: `{ type: 'none' }`

### registry.ts update

Each `Character` gets an optional `commands` field:

```typescript
export interface Character {
  // ...existing fields...
  wakeWord?: string           // default: 'buddy'
  commands?: VoiceCommand[]
}
```

Example for the fox character:

```typescript
commands: [
  {
    triggers: ['duerme', 'a dormir', 'échate'],
    action: 'sleep',
    responses: ['Buenas noches... 😴', 'Qué sueño tengo...', 'Zzz...'],
  },
  {
    triggers: ['despierta', 'levántate', 'arriba'],
    action: 'wakeUp',
    responses: ['¡Ya estoy aquí!', '¿Qué pasó?', '¡Buenos días!'],
  },
  {
    triggers: ['camina', 'muévete', 'anda'],
    action: 'walk',
    responses: ['¡Vamos!', 'Me muevo...'],
  },
]
```

### BuddyOverlay.tsx wiring

```typescript
const { sendMessage } = useBuddy(avatar)
const wakeWord = character.wakeWord ?? 'buddy'

useVoice((transcript) => {
  const intent = detectIntent(transcript, wakeWord, character.commands ?? [])

  if (intent.type === 'wake_word' && intent.text) {
    sendMessage(intent.text)   // response sets bubbleText via useBuddy
  } else if (intent.type === 'command' && intent.command) {
    handleCommand(intent.command)
  }
  // 'none' → ignore
})

function handleCommand(cmd: VoiceCommand) {
  // trigger avatar state machine
  switch (cmd.action) {
    case 'sleep':    buddyControls.setSleep(); break
    case 'wakeUp':   buddyControls.wakeUp(); break
    case 'walk':     buddyControls.startWalking(); break
    case 'react':    buddyControls.stopReacting(); break
  }
  // useBuddy needs to expose setSleep() — add it alongside wakeUp/startWalking
  // show random response in bubble if defined
  if (cmd.responses?.length) {
    const phrase = cmd.responses[Math.floor(Math.random() * cmd.responses.length)]
    setBubbleText(phrase)
  }
}
```

`useBuddy` needs to expose a way to set `bubbleText` on response — modify `sendMessage` to call `onResponse(text)` callback, passed from BuddyOverlay.

---

## Feature 4: TTS (Piper)

### Files

- Create: `server/src/routes/tts.rs`
- Modify: `server/src/routes/mod.rs` — add /tts route
- Create: `apps/desktop/src/hooks/useTTS.ts`
- Modify: `apps/desktop/src/BuddyOverlay.tsx` — pass text through TTS on response

### /tts endpoint

```rust
#[derive(Deserialize)]
pub struct TtsRequest {
    pub text: String,
}

// Returns audio/wav bytes directly
pub async fn tts(
    State(state): State<AppState>,
    Json(req): Json<TtsRequest>,
) -> Result<impl IntoResponse, StatusCode>
```

Implementation:
1. POST to `{piper_url}/tts` with `{ "text": req.text }` (Piper HTTP API format)
2. Receive WAV bytes
3. Return with `Content-Type: audio/wav`

Falls back gracefully: if `piper_url` call fails, return 502. Frontend handles silence.

### useTTS.ts hook

```typescript
interface TTSConfig {
  enabled: boolean
}

export function useTTS(config: TTSConfig) {
  const speak = useCallback(async (text: string) => {
    if (!config.enabled) return
    const resp = await fetch(`${SERVER_URL}/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
    if (!resp.ok) return
    const blob = await resp.blob()
    const url = URL.createObjectURL(blob)
    const audio = new Audio(url)
    audio.onended = () => URL.revokeObjectURL(url)
    audio.play()
  }, [config.enabled])

  return { speak }
}
```

### BuddyOverlay integration

When a response arrives (from chat or gesture command), call both:
```typescript
setBubbleText(responseText)
speak(responseText)
```

They run in parallel — text appears immediately (typewriter), audio starts fetching (slight delay is OK).

### Settings

Add two toggles to `SettingsPanel.tsx`:
- **Mostrar texto** (default: on) — controls `setBubbleText`
- **Voz** (default: off until Piper configured) — controls `speak()`

Persisted in `localStorage` key `buddy-tts-config: { textEnabled, voiceEnabled }`.

---

## Feature 5: Ambient Awareness

### Files

- Modify: `apps/desktop/src-tauri/src/voice.rs` — add ambient classifier
- Modify: `apps/desktop/src-tauri/src/sensors.rs` — add `ambient_type` to SensorPayload
- Modify: `packages/core/src/sensor-bus.ts` — add `AmbientType` to SensorSnapshot
- Create: `packages/core/src/ambient-engine.ts`
- Modify: `apps/desktop/src/hooks/useSensors.ts` — map ambient_type
- Modify: `apps/desktop/src/BuddyOverlay.tsx` — wire useAmbient

### Ambient classification in Rust

Add to `InputState`:

```rust
ambient_type: AmbientType,   // Silence | Speech | Music
ambient_since: u64,          // timestamp when current type started
```

```rust
pub enum AmbientType { Silence, Speech, Music }
```

Classification logic (runs in the snapshot emitter every 5s):
- `mic_level < 0.005` for > 60s → `Silence`
- `mic_level >= 0.02` AND duration < 4s → `Speech`
- `mic_level >= 0.02` for > 4s continuously → `Music`

Add `ambient_type: String` and `ambient_duration_s: u64` to `SensorPayload`.

### packages/core/src/ambient-engine.ts

```typescript
export type AmbientType = 'silence' | 'speech' | 'music'

const SILENCE_SLEEP_MS = 5 * 60 * 1000       // 5 min silence → sleep
const AMBIENT_LLM_PROB = 0.15                 // 15% chance on ambient event
const AMBIENT_LLM_MEAN_MS = 30 * 60 * 1000   // ~30 min between checks

export class AmbientEngine {
  private lastCheck = 0
  private nextCheckAt: number

  constructor(private serverUrl: string) {
    this.nextCheckAt = Date.now() + gaussian(AMBIENT_LLM_MEAN_MS, 10 * 60 * 1000)
  }

  // Returns a response string if LLM was consulted, null otherwise
  async update(
    snapshot: SensorSnapshot,
    mood: Mood,
    onSleep: () => void,
  ): Promise<string | null> {
    const { ambientType, ambientDurationS } = snapshot

    // Silence → sleep
    if (ambientType === 'silence' && ambientDurationS * 1000 > SILENCE_SLEEP_MS) {
      onSleep()
      return null
    }

    // Random LLM ambient check
    if (Date.now() >= this.nextCheckAt) {
      this.nextCheckAt = Date.now() + gaussian(AMBIENT_LLM_MEAN_MS, 10 * 60 * 1000)
      if (Math.random() < AMBIENT_LLM_PROB) {
        return this.fetchAmbientReaction(snapshot, mood)
      }
    }

    return null
  }

  private async fetchAmbientReaction(snapshot: SensorSnapshot, mood: Mood): Promise<string | null> {
    // Short spontaneous reaction — different system prompt from mood engine
    const systemPrompt = `Eres ${mood.name}. Reacciona espontáneamente al ambiente con UNA frase corta (máx 8 palabras). Contexto: ${snapshot.ambientType} detectado, son las ${snapshot.time.hour}h.`
    try {
      const resp = await fetch(`${this.serverUrl}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `ambiente: ${snapshot.ambientType}`,
          avatarId: 'ambient',
          personality: systemPrompt,
          history: [],
        }),
      })
      if (!resp.ok) return null
      const { content } = await resp.json()
      return content
    } catch { return null }
  }
}
```

### BuddyOverlay wiring

```typescript
const ambientRef = useRef(new AmbientEngine(SERVER_URL))

// in the sensor snapshot useEffect:
useEffect(() => {
  if (!snapshot) return
  ambientRef.current.update(snapshot, mood, () => buddy.sm.setSleep())
    .then(reaction => {
      if (reaction) {
        setBubbleText(reaction)
        speak(reaction)
      }
    })
}, [snapshot])
```

---

## Configuration Summary

All configurable via env vars at launch:

| Env var | Default | Purpose |
|---------|---------|---------|
| `OLLAMA_URL` | `http://localhost:11434` | LLM for chat + mood |
| `MOOD_URL` | same as OLLAMA_URL | LLM for mood (can point to different server) |
| `WHISPER_URL` | `http://localhost:8080` | Whisper STT server |
| `PIPER_URL` | `http://localhost:5000` | Piper TTS server |
| `LLM_MODEL` | `llama3.2:3b` | Model name sent to LLM |
| `WHISPER_LANG` | `es` | Language hint for STT |

User-facing toggles (SettingsPanel):
- Mostrar texto en bubble: on/off
- Voz TTS: on/off

---

## Commit Plan

Each feature is a self-contained commit:

1. `feat: speech bubble component above avatar with typewriter animation`
2. `feat: VAD audio recorder in Rust + /transcribe server endpoint`
3. `feat: intent router — wake word and gesture commands with random responses`
4. `feat: TTS via Piper + /tts server endpoint + voice toggle in settings`
5. `feat: ambient awareness — silence sleep, music mood, random LLM reactions`
