# Voice Interaction System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add voice input (VAD + Whisper STT), speech bubble display, TTS output (Piper), intent routing (wake word + gesture commands), and ambient audio awareness to Buddy.

**Architecture:** A VAD recorder in Rust captures audio when mic is active and emits a `voice-captured` Tauri event with base64 WAV. The frontend transcribes via `/transcribe`, routes the transcript through an intent router (wake word → chat, command → avatar action, else ignore), and displays the response in a speech bubble above the avatar while optionally speaking it via Piper TTS.

**Tech Stack:** Rust/cpal (audio capture), axum (server endpoints), Whisper HTTP-compatible API, Piper HTTP server, React/TypeScript (hooks + bubble component), vitest (unit tests).

---

## File Map

**New files:**
- `apps/desktop/src/SpeechBubble.tsx` — typewriter bubble above avatar
- `apps/desktop/src-tauri/src/voice.rs` — VAD recorder thread
- `server/src/routes/transcribe.rs` — POST /transcribe → Whisper
- `server/src/routes/tts.rs` — POST /tts → Piper
- `packages/core/src/intent-router.ts` — detectIntent() pure function
- `packages/core/src/__tests__/intent-router.test.ts`
- `packages/core/src/ambient-engine.ts` — AmbientEngine class
- `packages/core/src/__tests__/ambient-engine.test.ts`
- `apps/desktop/src/hooks/useVoice.ts` — voice-captured → /transcribe → onTranscript
- `apps/desktop/src/hooks/useTTS.ts` — speak() via /tts

**Modified files:**
- `apps/desktop/src/BuddyOverlay.tsx` — bubble slot, intent wiring, ambient wiring
- `apps/desktop/src/hooks/useBuddy.ts` — add setSleep(), onResponse callback
- `apps/desktop/src/SettingsPanel.tsx` — text/voice toggles
- `apps/desktop/src/characters/registry.ts` — add wakeWord + commands to characters
- `apps/desktop/src-tauri/src/sensors.rs` — add recording_buffer + ambient classification
- `apps/desktop/src-tauri/src/main.rs` — mod voice, launch_voice
- `apps/desktop/src-tauri/Cargo.toml` — add base64 dep
- `server/src/state.rs` — add whisper_url, piper_url
- `server/src/routes/mod.rs` — export transcribe, tts
- `server/Cargo.toml` — add reqwest multipart, tempfile, base64 deps
- `packages/core/src/sensor-bus.ts` — add AmbientType + ambientType/ambientDurationS to SensorSnapshot
- `packages/core/src/index.ts` — export VoiceCommand, AvatarAction, IntentResult, detectIntent, AmbientEngine, AmbientType
- `packages/types/src/index.ts` — add wakeWord?, commands? to CharacterManifest

---

## Task 1: SpeechBubble Component

**Files:**
- Create: `apps/desktop/src/SpeechBubble.tsx`

- [ ] **Step 1: Create SpeechBubble.tsx**

```tsx
// apps/desktop/src/SpeechBubble.tsx
import { useEffect, useRef, useState } from 'react'

interface Props {
  text: string
  onDone: () => void
}

export function SpeechBubble({ text, onDone }: Props) {
  const [displayed, setDisplayed] = useState('')
  const [fading, setFading] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setDisplayed('')
    setFading(false)
    if (timerRef.current) clearTimeout(timerRef.current)

    let i = 0
    const interval = setInterval(() => {
      i++
      setDisplayed(text.slice(0, i))
      if (i >= text.length) {
        clearInterval(interval)
        const holdMs = Math.min(6000, Math.max(2000, text.length * 40))
        timerRef.current = setTimeout(() => {
          setFading(true)
          timerRef.current = setTimeout(onDone, 400)
        }, holdMs)
      }
    }, 30)

    return () => {
      clearInterval(interval)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [text])

  return (
    <div style={{
      position: 'absolute',
      bottom: '100%',
      left: '50%',
      transform: 'translateX(-50%)',
      marginBottom: 8,
      maxWidth: 220,
      background: 'rgba(14,14,26,0.95)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 14,
      padding: '8px 12px',
      color: '#e5e7eb',
      fontSize: 13,
      fontFamily: 'system-ui',
      lineHeight: 1.4,
      boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
      zIndex: 30,
      opacity: fading ? 0 : 1,
      transition: 'opacity 0.4s ease',
      pointerEvents: 'none',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
    }}>
      {displayed}
      <div style={{
        position: 'absolute',
        bottom: -7,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 0,
        height: 0,
        borderLeft: '7px solid transparent',
        borderRight: '7px solid transparent',
        borderTop: '7px solid rgba(14,14,26,0.95)',
      }} />
    </div>
  )
}
```

- [ ] **Step 2: Run Buddy dev server and verify visually**

```powershell
cd apps/desktop
pnpm dev
```

Open chat bubble in Buddy, send a message. The existing chat still works — the SpeechBubble is not wired yet (next task).

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/SpeechBubble.tsx
git commit -m "feat: speech bubble component with typewriter animation"
```

---

## Task 2: BuddyOverlay — Bubble Slot + useBuddy setSleep

**Files:**
- Modify: `apps/desktop/src/hooks/useBuddy.ts`
- Modify: `apps/desktop/src/BuddyOverlay.tsx`

- [ ] **Step 1: Add setSleep and onResponse to useBuddy**

In `apps/desktop/src/hooks/useBuddy.ts`, make these two changes:

**a) Add `onResponse` parameter:**
```typescript
export function useBuddy(avatar: Avatar, initialHistory: Message[] = [], onResponse?: (text: string) => void) {
```

**b) Call onResponse when assistant message arrives** (inside the `try` block of `sendMessage`, after setting history):
```typescript
      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: resp.content,
        avatarId: avatar.id,
        timestamp: Date.now(),
      }
      setHistory(h => [...h, assistantMsg].slice(-MAX_HISTORY))
      onResponse?.(resp.content)   // ← ADD THIS LINE
      sm.current!.receiveResponse()
```

**c) Add setSleep to return value:**
```typescript
  const setSleep = useCallback(() => sm.current!.setSleep(), [])

  return { state, history, thinking, sendMessage, wakeUp, startWalking, stopWalking, stopReacting, setSleep }
```

- [ ] **Step 2: Add bubble state and slot to BuddyOverlay**

In `apps/desktop/src/BuddyOverlay.tsx`:

**a) Add import at top:**
```typescript
import { SpeechBubble } from './SpeechBubble'
```

**b) Add state near other useState calls:**
```typescript
const [bubbleText, setBubbleText] = useState<string | null>(null)
```

**c) Pass onResponse to useBuddy** — find the useBuddy call and update it:
```typescript
const { state, history, thinking, sendMessage, wakeUp, startWalking, stopWalking, stopReacting, setSleep } =
  useBuddy(avatar, loadHistory(), (text) => setBubbleText(text))
```

**d) Add bubble slot inside the character's parent div** — find the div containing the character renderer (it has `position: 'relative'`) and add the bubble above the character:
```typescript
      {/* Speech bubble — sits above the avatar, within the relative container */}
      {bubbleText && (
        <SpeechBubble text={bubbleText} onDone={() => setBubbleText(null)} />
      )}
```

Place this just before the `<CharacterRenderer .../>` line.

- [ ] **Step 3: Run and verify**

```powershell
pnpm dev
```

Open chat and send a message. The speech bubble should appear above the avatar with typewriter animation, then fade out. The chat panel still works normally.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/hooks/useBuddy.ts apps/desktop/src/BuddyOverlay.tsx
git commit -m "feat: wire speech bubble to chat responses in BuddyOverlay"
```

---

## Task 3: Server — state.rs + /transcribe + /tts Endpoints

**Files:**
- Modify: `server/Cargo.toml`
- Modify: `server/src/state.rs`
- Create: `server/src/routes/transcribe.rs`
- Create: `server/src/routes/tts.rs`
- Modify: `server/src/routes/mod.rs`
- Modify: `server/src/main.rs`

- [ ] **Step 1: Add dependencies to server/Cargo.toml**

```toml
[dependencies]
axum = { version = "0.7", features = ["multipart"] }
tokio = { version = "1", features = ["full"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
reqwest = { version = "0.12", features = ["json", "multipart"] }
tower-http = { version = "0.6", features = ["cors"] }
anyhow = "1"
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }
base64 = "0.22"
tempfile = "3"
```

Run `cargo build` from `server/` to fetch deps:
```powershell
cd server
cargo build
```
Expected: compiles without errors.

- [ ] **Step 2: Update state.rs**

```rust
// server/src/state.rs
#[derive(Clone)]
pub struct AppState {
    pub ollama_url: String,
    pub mood_url: String,
    pub whisper_url: String,
    pub piper_url: String,
    pub avatars_dir: String,
    pub http: reqwest::Client,
}

impl AppState {
    pub fn new() -> Self {
        let ollama_url = std::env::var("OLLAMA_URL")
            .unwrap_or_else(|_| "http://localhost:11434".into());
        let mood_url = std::env::var("MOOD_URL").unwrap_or_else(|_| ollama_url.clone());
        Self {
            ollama_url,
            mood_url,
            whisper_url: std::env::var("WHISPER_URL")
                .unwrap_or_else(|_| "http://localhost:8080".into()),
            piper_url: std::env::var("PIPER_URL")
                .unwrap_or_else(|_| "http://localhost:5000".into()),
            avatars_dir: std::env::var("AVATARS_DIR").unwrap_or_else(|_| "avatars".into()),
            http: reqwest::Client::new(),
        }
    }
}
```

- [ ] **Step 3: Create transcribe.rs**

```rust
// server/src/routes/transcribe.rs
use axum::{extract::State, Json, http::StatusCode};
use serde::{Deserialize, Serialize};
use base64::Engine as _;
use crate::state::AppState;

#[derive(Deserialize)]
pub struct TranscribeRequest {
    pub audio_b64: String,
}

#[derive(Serialize)]
pub struct TranscribeResponse {
    pub transcript: String,
}

pub async fn transcribe(
    State(state): State<AppState>,
    Json(req): Json<TranscribeRequest>,
) -> Result<Json<TranscribeResponse>, StatusCode> {
    let wav_bytes = base64::engine::general_purpose::STANDARD
        .decode(&req.audio_b64)
        .map_err(|_| StatusCode::BAD_REQUEST)?;

    let tmp = tempfile::NamedTempFile::with_suffix(".wav")
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    std::fs::write(tmp.path(), &wav_bytes)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let lang = std::env::var("WHISPER_LANG").unwrap_or_else(|_| "es".into());

    let file_part = reqwest::multipart::Part::bytes(wav_bytes)
        .file_name("audio.wav")
        .mime_str("audio/wav")
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let form = reqwest::multipart::Form::new()
        .text("model", "whisper-1")
        .text("language", lang)
        .part("file", file_part);

    let resp = state.http
        .post(format!("{}/v1/audio/transcriptions", state.whisper_url))
        .multipart(form)
        .send()
        .await
        .map_err(|_| StatusCode::BAD_GATEWAY)?;

    if !resp.status().is_success() {
        return Err(StatusCode::BAD_GATEWAY);
    }

    let body: serde_json::Value = resp.json().await
        .map_err(|_| StatusCode::BAD_GATEWAY)?;

    let transcript = body["text"]
        .as_str()
        .ok_or(StatusCode::BAD_GATEWAY)?
        .trim()
        .to_string();

    Ok(Json(TranscribeResponse { transcript }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn transcribe_response_serializes() {
        let r = TranscribeResponse { transcript: "hola buddy".into() };
        let j = serde_json::to_string(&r).unwrap();
        assert!(j.contains("hola buddy"));
    }
}
```

- [ ] **Step 4: Create tts.rs**

```rust
// server/src/routes/tts.rs
use axum::{extract::State, Json, http::StatusCode, response::Response};
use axum::http::header;
use serde::Deserialize;
use crate::state::AppState;

#[derive(Deserialize)]
pub struct TtsRequest {
    pub text: String,
}

pub async fn tts(
    State(state): State<AppState>,
    Json(req): Json<TtsRequest>,
) -> Result<Response<axum::body::Body>, StatusCode> {
    let resp = state.http
        .post(format!("{}/tts", state.piper_url))
        .json(&serde_json::json!({ "text": req.text }))
        .send()
        .await
        .map_err(|_| StatusCode::BAD_GATEWAY)?;

    if !resp.status().is_success() {
        return Err(StatusCode::BAD_GATEWAY);
    }

    let bytes = resp.bytes().await
        .map_err(|_| StatusCode::BAD_GATEWAY)?;

    Ok(Response::builder()
        .header(header::CONTENT_TYPE, "audio/wav")
        .body(axum::body::Body::from(bytes))
        .unwrap())
}
```

- [ ] **Step 5: Update routes/mod.rs**

```rust
pub mod health;
pub mod chat;
pub mod avatars;
pub mod mood;
pub mod transcribe;
pub mod tts;
```

- [ ] **Step 6: Wire routes in server/src/main.rs**

Find the `Router::new()` in main.rs and add the two new routes:

```rust
use routes::{health, chat, avatars, mood, transcribe, tts};

// inside the Router::new() chain:
    .route("/transcribe", post(transcribe::transcribe))
    .route("/tts", post(tts::tts))
```

- [ ] **Step 7: Run server tests**

```powershell
cd server
cargo test
```
Expected: all tests pass including the new serialization test.

- [ ] **Step 8: Commit**

```bash
git add server/Cargo.toml server/src/state.rs server/src/routes/transcribe.rs server/src/routes/tts.rs server/src/routes/mod.rs server/src/main.rs
git commit -m "feat: /transcribe (Whisper) and /tts (Piper) server endpoints"
```

---

## Task 4: Rust — Recording Buffer in sensors.rs + voice.rs VAD Recorder

**Files:**
- Modify: `apps/desktop/src-tauri/Cargo.toml`
- Modify: `apps/desktop/src-tauri/src/sensors.rs`
- Create: `apps/desktop/src-tauri/src/voice.rs`
- Modify: `apps/desktop/src-tauri/src/main.rs`

- [ ] **Step 1: Add base64 to desktop Cargo.toml**

```toml
[dependencies]
tauri = { version = "2", features = ["tray-icon"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
cpal = "0.15"
rdev = "0.5"
base64 = "0.22"
```

- [ ] **Step 2: Add recording buffer fields to InputState in sensors.rs**

Find `struct InputState` and add three fields:

```rust
#[derive(Default)]
struct InputState {
    key_timestamps: Vec<u64>,
    mouse_events: u32,
    last_input_at: Option<u64>,
    mic_active: bool,
    mic_level: f32,
    mic_device_name: String,
    // VAD recording — set by voice.rs, written by cpal callback
    pub recording: bool,
    pub recording_buffer: Vec<f32>,
    pub recording_sample_rate: u32,
}
```

In the `run_mic` cpal callback, push samples to the buffer when recording is active:

```rust
    let stream = device.build_input_stream(
        &config.into(),
        move |data: &[f32], _: &cpal::InputCallbackInfo| {
            let rms = (data.iter().map(|&s| s * s).sum::<f32>() / data.len() as f32).sqrt();
            {
                let mut st = state_cb.lock().unwrap();
                st.mic_level  = rms;
                st.mic_active = rms > 0.01;
                if st.recording {
                    st.recording_buffer.extend_from_slice(data);
                }
            }
            if last_emit.elapsed() >= Duration::from_millis(200) {
                last_emit = Instant::now();
                let _ = app_cb.emit("mic-level", MicLevelPayload { level: rms, active: rms > 0.01 });
            }
        },
        |err| eprintln!("[buddy-sensors] mic stream error: {err}"),
        None,
    )?;
```

Also store the sample rate when opening the stream. Before building the stream, capture the sample rate:

```rust
    let config = device.default_input_config()?;
    let sample_rate = config.sample_rate().0;
    let dev_name = device.name().unwrap_or_else(|_| "Unknown".into());
    {
        let mut s = state.lock().unwrap();
        s.mic_device_name = dev_name;
        s.recording_sample_rate = sample_rate;
    }
```

Make `InputState` fields `pub` by changing `struct InputState` visibility — or add `pub(crate)`. Since voice.rs is in the same crate, use `pub(crate)`:

```rust
struct InputState {
    key_timestamps: Vec<u64>,
    mouse_events: u32,
    last_input_at: Option<u64>,
    pub(crate) mic_active: bool,
    pub(crate) mic_level: f32,
    pub(crate) mic_device_name: String,
    pub(crate) recording: bool,
    pub(crate) recording_buffer: Vec<f32>,
    pub(crate) recording_sample_rate: u32,
}
```

Update `launch_sensors` signature to return both `Arc<Mutex<MicConfig>>` AND `Arc<Mutex<InputState>>`:

```rust
pub fn launch_sensors(app: AppHandle) -> (Arc<Mutex<MicConfig>>, Arc<Mutex<InputState>>) {
    // ... existing code ...
    (mic_config, state)   // ← return state too
}
```

- [ ] **Step 3: Create voice.rs**

```rust
// apps/desktop/src-tauri/src/voice.rs
use std::sync::{Arc, Mutex};
use std::time::Duration;
use base64::Engine as _;
use serde::Serialize;
use tauri::{AppHandle, Emitter};

// InputState is defined in sensors.rs — use super to access it
use super::sensors::InputState;

#[derive(Serialize, Clone)]
pub struct VoiceCapturedPayload {
    pub audio_b64: String,
    pub duration_ms: u64,
}

enum VadState { Idle, Recording { started_ms: u64 }, Trailing { started_ms: u64, recording_started: u64 } }

pub fn launch_voice(app: AppHandle, state: Arc<Mutex<InputState>>) {
    std::thread::spawn(move || {
        let mut vad = VadState::Idle;
        loop {
            std::thread::sleep(Duration::from_millis(50));
            let (level, now_ms) = {
                let s = state.lock().unwrap();
                (s.mic_level, crate::sensors::now_ms())
            };

            vad = match vad {
                VadState::Idle => {
                    if level >= 0.02 {
                        // Start recording
                        {
                            let mut s = state.lock().unwrap();
                            s.recording = true;
                            s.recording_buffer.clear();
                        }
                        VadState::Recording { started_ms: now_ms }
                    } else { VadState::Idle }
                }
                VadState::Recording { started_ms } => {
                    let elapsed = now_ms.saturating_sub(started_ms);
                    if level < 0.02 {
                        VadState::Trailing { started_ms: now_ms, recording_started: started_ms }
                    } else if elapsed > 30_000 {
                        // Max duration — finalize now
                        finalize(&state, &app, started_ms, now_ms);
                        VadState::Idle
                    } else {
                        VadState::Recording { started_ms }
                    }
                }
                VadState::Trailing { started_ms, recording_started } => {
                    let silence_ms = now_ms.saturating_sub(started_ms);
                    let total_ms = now_ms.saturating_sub(recording_started);
                    if level >= 0.02 {
                        // Sound resumed — back to recording
                        VadState::Recording { started_ms: recording_started }
                    } else if silence_ms >= 500 {
                        // Silence confirmed — finalize if long enough
                        if total_ms >= 300 {
                            finalize(&state, &app, recording_started, now_ms);
                        } else {
                            // Too short — discard
                            let mut s = state.lock().unwrap();
                            s.recording = false;
                            s.recording_buffer.clear();
                        }
                        VadState::Idle
                    } else {
                        VadState::Trailing { started_ms, recording_started }
                    }
                }
            };
        }
    });
}

fn finalize(state: &Arc<Mutex<InputState>>, app: &AppHandle, started_ms: u64, ended_ms: u64) {
    let (pcm, sample_rate) = {
        let mut s = state.lock().unwrap();
        s.recording = false;
        let buf = std::mem::take(&mut s.recording_buffer);
        (buf, s.recording_sample_rate)
    };

    let wav = encode_wav(&pcm, sample_rate);
    let audio_b64 = base64::engine::general_purpose::STANDARD.encode(&wav);
    let _ = app.emit("voice-captured", VoiceCapturedPayload {
        audio_b64,
        duration_ms: ended_ms.saturating_sub(started_ms),
    });
}

fn encode_wav(samples: &[f32], sample_rate: u32) -> Vec<u8> {
    // Convert f32 → i16, write RIFF WAV header
    let pcm_i16: Vec<i16> = samples.iter().map(|&s| (s * 32767.0).clamp(-32768.0, 32767.0) as i16).collect();
    let data_bytes = pcm_i16.len() * 2;
    let mut buf = Vec::with_capacity(44 + data_bytes);

    // RIFF header
    buf.extend_from_slice(b"RIFF");
    buf.extend_from_slice(&((36 + data_bytes) as u32).to_le_bytes());
    buf.extend_from_slice(b"WAVE");
    // fmt chunk
    buf.extend_from_slice(b"fmt ");
    buf.extend_from_slice(&16u32.to_le_bytes());   // chunk size
    buf.extend_from_slice(&1u16.to_le_bytes());    // PCM
    buf.extend_from_slice(&1u16.to_le_bytes());    // mono
    buf.extend_from_slice(&sample_rate.to_le_bytes());
    buf.extend_from_slice(&(sample_rate * 2).to_le_bytes()); // byte rate
    buf.extend_from_slice(&2u16.to_le_bytes());    // block align
    buf.extend_from_slice(&16u16.to_le_bytes());   // bits per sample
    // data chunk
    buf.extend_from_slice(b"data");
    buf.extend_from_slice(&(data_bytes as u32).to_le_bytes());
    for s in &pcm_i16 {
        buf.extend_from_slice(&s.to_le_bytes());
    }
    buf
}
```

- [ ] **Step 4: Make InputState and now_ms pub(crate) in sensors.rs**

In sensors.rs, add `pub(crate)` to `InputState` and `now_ms`:
```rust
pub(crate) struct InputState { ... }
pub(crate) fn now_ms() -> u64 { ... }
```

- [ ] **Step 5: Update main.rs to launch voice**

```rust
mod voice;

// In setup, after launch_sensors:
let (mic_config, sensor_state) = sensors::launch_sensors(app.handle().clone());
app.manage(mic_config);
voice::launch_voice(app.handle().clone(), sensor_state);
```

- [ ] **Step 6: Compile and check**

```powershell
cd apps/desktop
pnpm dev
```
Expected: compiles without errors. Speak near mic — no crash.

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/src-tauri/Cargo.toml apps/desktop/src-tauri/src/sensors.rs apps/desktop/src-tauri/src/voice.rs apps/desktop/src-tauri/src/main.rs
git commit -m "feat: VAD audio recorder in Rust emits voice-captured Tauri event"
```

---

## Task 5: intent-router in @buddy/core

**Files:**
- Create: `packages/core/src/intent-router.ts`
- Create: `packages/core/src/__tests__/intent-router.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// packages/core/src/__tests__/intent-router.test.ts
import { describe, it, expect } from 'vitest'
import { detectIntent } from '../intent-router'
import type { VoiceCommand } from '../intent-router'

const commands: VoiceCommand[] = [
  { triggers: ['duerme', 'a dormir'], action: 'sleep', responses: ['Zzz...'] },
  { triggers: ['despierta', 'levántate'], action: 'wakeUp', responses: ['¡Aquí!'] },
  { triggers: ['camina'], action: 'walk' },
]

describe('detectIntent — wake word', () => {
  it('detects wake word at start', () => {
    const r = detectIntent('buddy qué hora es', 'buddy', commands)
    expect(r.type).toBe('wake_word')
    expect(r.text).toBe('qué hora es')
  })
  it('detects wake word case-insensitive', () => {
    const r = detectIntent('BUDDY ayúdame', 'buddy', commands)
    expect(r.type).toBe('wake_word')
    expect(r.text).toBe('ayúdame')
  })
  it('strips wake word from middle', () => {
    const r = detectIntent('oye buddy cuántos años tienes', 'buddy', commands)
    expect(r.type).toBe('wake_word')
    expect(r.text?.trim()).toBe('oye  cuántos años tienes'.trim())
  })
})

describe('detectIntent — command', () => {
  it('matches sleep trigger', () => {
    const r = detectIntent('duerme un rato', 'buddy', commands)
    expect(r.type).toBe('command')
    expect(r.command?.action).toBe('sleep')
  })
  it('matches wakeUp trigger', () => {
    const r = detectIntent('levántate', 'buddy', commands)
    expect(r.type).toBe('command')
    expect(r.command?.action).toBe('wakeUp')
  })
  it('command with no responses', () => {
    const r = detectIntent('camina un poco', 'buddy', commands)
    expect(r.type).toBe('command')
    expect(r.command?.responses).toBeUndefined()
  })
})

describe('detectIntent — none', () => {
  it('returns none for unrelated speech', () => {
    const r = detectIntent('qué buen día hace hoy', 'buddy', commands)
    expect(r.type).toBe('none')
  })
  it('wake word takes priority over command', () => {
    const r = detectIntent('buddy duerme', 'buddy', commands)
    expect(r.type).toBe('wake_word')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```powershell
cd packages/core
pnpm test --run
```
Expected: FAIL — `detectIntent` not found.

- [ ] **Step 3: Create intent-router.ts**

```typescript
// packages/core/src/intent-router.ts
export type AvatarAction = 'sleep' | 'wakeUp' | 'walk' | 'dance' | 'react'

export interface VoiceCommand {
  triggers: string[]
  action: AvatarAction
  responses?: string[]
}

export interface IntentResult {
  type: 'wake_word' | 'command' | 'none'
  text?: string
  command?: VoiceCommand
}

export function detectIntent(
  transcript: string,
  wakeWord: string,
  commands: VoiceCommand[],
): IntentResult {
  const lower = transcript.toLowerCase()
  const lowerWake = wakeWord.toLowerCase()

  if (lower.includes(lowerWake)) {
    const text = transcript.replace(new RegExp(wakeWord, 'gi'), '').trim()
    return { type: 'wake_word', text }
  }

  for (const cmd of commands) {
    if (cmd.triggers.some(t => lower.includes(t.toLowerCase()))) {
      return { type: 'command', command: cmd }
    }
  }

  return { type: 'none' }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```powershell
cd packages/core
pnpm test --run
```
Expected: all intent-router tests PASS.

- [ ] **Step 5: Export from index.ts**

```typescript
// packages/core/src/index.ts — add these lines:
export type { VoiceCommand, AvatarAction, IntentResult } from './intent-router'
export { detectIntent } from './intent-router'
```

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/intent-router.ts packages/core/src/__tests__/intent-router.test.ts packages/core/src/index.ts
git commit -m "feat: detectIntent intent router with wake word and gesture command matching"
```

---

## Task 6: CharacterManifest + Registry Voice Commands

**Files:**
- Modify: `packages/types/src/index.ts`
- Modify: `apps/desktop/src/characters/registry.ts`

- [ ] **Step 1: Add VoiceCommand fields to CharacterManifest**

In `packages/types/src/index.ts`, add the import and two optional fields to `CharacterManifest`:

```typescript
import type { VoiceCommand } from '@buddy/core'

export interface CharacterManifest {
  id: string
  name: string
  type: 'sprite' | 'lottie' | 'rive' | 'canvas'
  species?: 'cat' | 'fox'
  personality: string
  palette: [string, string]
  wakeWord?: string           // default 'buddy'
  commands?: VoiceCommand[]   // gesture commands

  // sprite only
  sheet?: string
  frameWidth?: number
  frameHeight?: number
  fps?: number
  states?: Partial<Record<AvatarState, { row: number; frames: number }>>

  // lottie only
  clips?: Partial<Record<AvatarState, string>>

  // rive only
  riveFile?: string
  riveAnims?: Partial<Record<AvatarState, string>>
  availableAnims?: string[]
}
```

- [ ] **Step 2: Add commands to registry characters**

In `apps/desktop/src/characters/registry.ts`, add import and commands to each character:

```typescript
import type { VoiceCommand } from '@buddy/core'

const sharedCommands: VoiceCommand[] = [
  {
    triggers: ['duerme', 'a dormir', 'échate'],
    action: 'sleep',
    responses: ['Buenas noches... 😴', 'Qué sueño tengo...', 'Zzz...'],
  },
  {
    triggers: ['despierta', 'levántate', 'arriba', 'ya levántate'],
    action: 'wakeUp',
    responses: ['¡Ya estoy aquí!', '¿Qué pasó?', '¡Buenos días!'],
  },
  {
    triggers: ['camina', 'muévete', 'anda'],
    action: 'walk',
    responses: ['¡Vamos!', 'Me muevo...', 'Buenas piernas tengo.'],
  },
]

export const CHARACTERS: CharacterManifest[] = [
  {
    id: 'ai-orb',
    // ...existing fields...
    wakeWord: 'buddy',
    commands: sharedCommands,
  },
  {
    id: 'joy',
    // ...existing fields...
    wakeWord: 'buddy',
    commands: sharedCommands,
  },
  {
    id: 'aurora',
    // ...existing fields...
    wakeWord: 'buddy',
    commands: sharedCommands,
  },
]
```

- [ ] **Step 3: Compile check**

```powershell
cd apps/desktop
pnpm tsc --noEmit
```
Expected: no type errors.

- [ ] **Step 4: Commit**

```bash
git add packages/types/src/index.ts apps/desktop/src/characters/registry.ts
git commit -m "feat: voice commands and wake word per character in registry"
```

---

## Task 7: useVoice + useTTS Hooks + BuddyOverlay Wiring

**Files:**
- Create: `apps/desktop/src/hooks/useVoice.ts`
- Create: `apps/desktop/src/hooks/useTTS.ts`
- Modify: `apps/desktop/src/BuddyOverlay.tsx`

- [ ] **Step 1: Create useVoice.ts**

```typescript
// apps/desktop/src/hooks/useVoice.ts
import { useEffect } from 'react'
import { listen } from '@tauri-apps/api/event'

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:7788'

interface VoiceCapturedPayload {
  audio_b64: string
  duration_ms: number
}

export function useVoice(onTranscript: (text: string) => void): void {
  useEffect(() => {
    let unlisten: (() => void) | undefined

    listen<VoiceCapturedPayload>('voice-captured', async ({ payload }) => {
      try {
        const resp = await fetch(`${SERVER_URL}/transcribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ audio_b64: payload.audio_b64 }),
        })
        if (!resp.ok) return
        const { transcript } = await resp.json() as { transcript: string }
        if (transcript.trim()) onTranscript(transcript.trim())
      } catch { /* silent — STT failure doesn't surface to user */ }
    }).then(fn => { unlisten = fn })

    return () => { unlisten?.() }
  }, [onTranscript])
}
```

- [ ] **Step 2: Create useTTS.ts**

```typescript
// apps/desktop/src/hooks/useTTS.ts
import { useCallback } from 'react'

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:7788'

export function useTTS(enabled: boolean) {
  const speak = useCallback(async (text: string) => {
    if (!enabled) return
    try {
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
    } catch { /* silent */ }
  }, [enabled])

  return { speak }
}
```

- [ ] **Step 3: Wire useVoice + useTTS into BuddyOverlay**

In `apps/desktop/src/BuddyOverlay.tsx`:

**a) Add imports:**
```typescript
import { useVoice } from './hooks/useVoice'
import { useTTS } from './hooks/useTTS'
import { detectIntent } from '@buddy/core'
import type { VoiceCommand } from '@buddy/core'
```

**b) Add TTS config state** (near other useState):
```typescript
const [ttsEnabled, setTtsEnabled] = useState(() => {
  try { return JSON.parse(localStorage.getItem('buddy-tts-voice') ?? 'false') } catch { return false }
})
const [textEnabled, setTextEnabled] = useState(() => {
  try { return JSON.parse(localStorage.getItem('buddy-tts-text') ?? 'true') } catch { return true }
})
```

**c) Init TTS hook:**
```typescript
const { speak } = useTTS(ttsEnabled)
```

**d) Add handleCommand function** (before the return):
```typescript
const handleCommand = useCallback((cmd: VoiceCommand) => {
  switch (cmd.action) {
    case 'sleep':    setSleep(); break
    case 'wakeUp':   wakeUp(); break
    case 'walk':     startWalking(); break
    case 'react':    stopReacting(); break
  }
  if (cmd.responses?.length) {
    const phrase = cmd.responses[Math.floor(Math.random() * cmd.responses.length)]
    if (textEnabled) setBubbleText(phrase)
    speak(phrase)
  }
}, [setSleep, wakeUp, startWalking, stopReacting, textEnabled, speak, setBubbleText])
```

**e) Add useVoice hook call:**
```typescript
useVoice(useCallback((transcript: string) => {
  const wakeWord = character.wakeWord ?? 'buddy'
  const intent = detectIntent(transcript, wakeWord, character.commands ?? [])
  if (intent.type === 'wake_word' && intent.text) {
    sendMessage(intent.text)
  } else if (intent.type === 'command' && intent.command) {
    handleCommand(intent.command)
  }
}, [character, sendMessage, handleCommand]))
```

**f) Update onResponse in useBuddy call** to also call speak:
```typescript
const { state, history, thinking, sendMessage, wakeUp, startWalking, stopWalking, stopReacting, setSleep } =
  useBuddy(avatar, loadHistory(), (text) => {
    if (textEnabled) setBubbleText(text)
    speak(text)
  })
```

- [ ] **Step 4: Run Buddy and test**

```powershell
pnpm dev
```

If you have a Whisper server running at `localhost:8080`, say "buddy qué hora es" — the bubble should appear with the LLM response. Without Whisper, voice input silently does nothing; text chat still works.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/hooks/useVoice.ts apps/desktop/src/hooks/useTTS.ts apps/desktop/src/BuddyOverlay.tsx
git commit -m "feat: voice input pipeline and TTS output wired in BuddyOverlay"
```

---

## Task 8: SettingsPanel — Text and Voice Toggles

**Files:**
- Modify: `apps/desktop/src/SettingsPanel.tsx`
- Modify: `apps/desktop/src/BuddyOverlay.tsx`

- [ ] **Step 1: Update SettingsPanel props and UI**

```typescript
// apps/desktop/src/SettingsPanel.tsx
interface Props {
  avatarName: string
  avatarPersonality: string
  textEnabled: boolean
  voiceEnabled: boolean
  onSave: (name: string, personality: string) => void
  onToggleText: (v: boolean) => void
  onToggleVoice: (v: boolean) => void
  onClose: () => void
}

export function SettingsPanel({ avatarName, avatarPersonality, textEnabled, voiceEnabled, onSave, onToggleText, onToggleVoice, onClose }: Props) {
  const [name, setName] = useState(avatarName)
  const [personality, setPersonality] = useState(avatarPersonality)
```

Add these two toggles inside the scrollable section, after the personality textarea:

```tsx
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
          <span style={{ color: '#9ca3af', fontSize: 10, fontWeight: 600, letterSpacing: 0.8, textTransform: 'uppercase' }}>Respuestas</span>
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
            <span style={{ color: '#d1d5db', fontSize: 12 }}>Mostrar texto</span>
            <input type="checkbox" checked={textEnabled} onChange={e => onToggleText(e.target.checked)}
              style={{ accentColor: '#4338ca', width: 16, height: 16, cursor: 'pointer' }} />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
            <span style={{ color: '#d1d5db', fontSize: 12 }}>Voz (Piper)</span>
            <input type="checkbox" checked={voiceEnabled} onChange={e => onToggleVoice(e.target.checked)}
              style={{ accentColor: '#4338ca', width: 16, height: 16, cursor: 'pointer' }} />
          </label>
        </div>
```

- [ ] **Step 2: Wire toggles in BuddyOverlay**

Find the `<SettingsPanel` usage in BuddyOverlay and add the new props:

```tsx
<SettingsPanel
  avatarName={avatar.name}
  avatarPersonality={avatar.personality}
  textEnabled={textEnabled}
  voiceEnabled={ttsEnabled}
  onSave={(name, personality) => { /* existing */ }}
  onToggleText={(v) => { setTextEnabled(v); localStorage.setItem('buddy-tts-text', String(v)) }}
  onToggleVoice={(v) => { setTtsEnabled(v); localStorage.setItem('buddy-tts-voice', String(v)) }}
  onClose={() => setSettingsOpen(false)}
/>
```

- [ ] **Step 3: Run and verify toggles**

```powershell
pnpm dev
```

Right-click avatar → Personalidad → verify checkboxes appear and persist after restart.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/SettingsPanel.tsx apps/desktop/src/BuddyOverlay.tsx
git commit -m "feat: text bubble and voice TTS toggles in settings panel"
```

---

## Task 9: Ambient Classification in Rust + sensor-bus

**Files:**
- Modify: `apps/desktop/src-tauri/src/sensors.rs`
- Modify: `packages/core/src/sensor-bus.ts`
- Modify: `apps/desktop/src/hooks/useSensors.ts`

- [ ] **Step 1: Add ambient fields to InputState and SensorPayload in sensors.rs**

Add to `InputState`:
```rust
ambient_active_since: Option<u64>,   // timestamp when mic went above threshold and stayed
ambient_silent_since: Option<u64>,   // timestamp when mic went below threshold
```

Add to `SensorPayload`:
```rust
pub ambient_type: String,      // "silence" | "speech" | "music"
pub ambient_duration_s: u64,
```

In the snapshot emitter, compute ambient before building the payload:

```rust
        // Ambient classification
        let (ambient_type, ambient_duration_s) = {
            let active_since = s.ambient_active_since;
            let silent_since = s.ambient_silent_since;
            let level = s.mic_level;

            if level < 0.005 {
                // Update silent since if not already set
                let since = silent_since.unwrap_or(now);
                s.ambient_silent_since = Some(since);
                s.ambient_active_since = None;
                let dur = now.saturating_sub(since) / 1000;
                ("silence".to_string(), dur)
            } else {
                // Sound present — update active since
                let since = active_since.unwrap_or(now);
                s.ambient_active_since = Some(since);
                s.ambient_silent_since = None;
                let dur = now.saturating_sub(since) / 1000;
                if dur >= 4 {
                    ("music".to_string(), dur)
                } else {
                    ("speech".to_string(), dur)
                }
            }
        };
```

Add `ambient_type` and `ambient_duration_s` to the `SensorPayload { ... }` constructor.

- [ ] **Step 2: Update sensor-bus.ts**

```typescript
// packages/core/src/sensor-bus.ts
export type InputLevel = 'idle' | 'light' | 'heavy'
export type AmbientType = 'silence' | 'speech' | 'music'

export interface SensorSnapshot {
  timestamp: number
  mic: {
    active: boolean
    level: number
    deviceName: string
  }
  input: {
    keyRate: number
    mouseDistance: number
    level: InputLevel
    idleDuration: number
  }
  time: {
    hour: number
    isNight: boolean
    isWeekend: boolean
  }
  ambientType: AmbientType       // NEW
  ambientDurationS: number       // NEW — seconds in current ambient state
}

export function classifyInput(keyRate: number, idleDuration: number): InputLevel {
  if (idleDuration > 120_000) return 'idle'
  if (keyRate > 60) return 'heavy'
  return 'light'
}
```

- [ ] **Step 3: Update useSensors.ts**

In `apps/desktop/src/hooks/useSensors.ts`, add the new fields to `RawPayload` and mapping:

```typescript
interface RawPayload {
  timestamp: number
  mic_active: boolean
  mic_level: number
  mic_device_name: string
  key_rate: number
  mouse_distance: number
  input_level: 'idle' | 'light' | 'heavy'
  idle_duration_ms: number
  hour: number
  is_night: boolean
  is_weekend: boolean
  ambient_type: string           // NEW
  ambient_duration_s: number     // NEW
}
```

In the `setSnapshot` call, add:
```typescript
        ambientType: (p.ambient_type as AmbientType) ?? 'silence',
        ambientDurationS: p.ambient_duration_s ?? 0,
```

Also import `AmbientType`:
```typescript
import type { SensorSnapshot, AmbientType } from '@buddy/core'
```

- [ ] **Step 4: Export AmbientType from @buddy/core**

```typescript
// packages/core/src/index.ts — add:
export type { AmbientType } from './sensor-bus'
```

- [ ] **Step 5: Compile check**

```powershell
cd apps/desktop
pnpm tsc --noEmit
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src-tauri/src/sensors.rs packages/core/src/sensor-bus.ts apps/desktop/src/hooks/useSensors.ts packages/core/src/index.ts
git commit -m "feat: ambient audio classification (silence/speech/music) in sensor pipeline"
```

---

## Task 10: AmbientEngine + BuddyOverlay Ambient Wiring

**Files:**
- Create: `packages/core/src/ambient-engine.ts`
- Create: `packages/core/src/__tests__/ambient-engine.test.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `apps/desktop/src/BuddyOverlay.tsx`

- [ ] **Step 1: Write failing tests**

```typescript
// packages/core/src/__tests__/ambient-engine.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AmbientEngine } from '../ambient-engine'
import type { SensorSnapshot } from '../sensor-bus'
import type { Mood } from '../mood-engine'

const mood: Mood = {
  name: 'calm', energy: 'low', restlessness: 'still',
  zOrder: 'normal', expiresAt: Date.now() + 60_000,
}

const snap = (ambientType: 'silence' | 'speech' | 'music', durationS = 0): SensorSnapshot => ({
  timestamp: Date.now(),
  mic: { active: false, level: 0, deviceName: '' },
  input: { keyRate: 0, mouseDistance: 0, level: 'idle', idleDuration: 0 },
  time: { hour: 10, isNight: false, isWeekend: false },
  ambientType,
  ambientDurationS: durationS,
})

describe('AmbientEngine', () => {
  it('calls onSleep after 5 min of silence', async () => {
    const engine = new AmbientEngine('http://localhost:7788')
    const onSleep = vi.fn()
    await engine.update(snap('silence', 301), mood, onSleep)
    expect(onSleep).toHaveBeenCalledOnce()
  })

  it('does not sleep for short silence', async () => {
    const engine = new AmbientEngine('http://localhost:7788')
    const onSleep = vi.fn()
    await engine.update(snap('silence', 10), mood, onSleep)
    expect(onSleep).not.toHaveBeenCalled()
  })

  it('does not sleep for music', async () => {
    const engine = new AmbientEngine('http://localhost:7788')
    const onSleep = vi.fn()
    await engine.update(snap('music', 600), mood, onSleep)
    expect(onSleep).not.toHaveBeenCalled()
  })

  it('nextCheckAt advances after each update when timer fires', async () => {
    const engine = new AmbientEngine('http://localhost:7788')
    // Force the timer to fire immediately by manipulating internal state
    ;(engine as any).nextCheckAt = Date.now() - 1
    vi.spyOn(global.Math, 'random').mockReturnValue(0)  // below AMBIENT_LLM_PROB threshold → no LLM call
    const prev = (engine as any).nextCheckAt
    await engine.update(snap('music', 10), mood, vi.fn())
    expect((engine as any).nextCheckAt).toBeGreaterThan(prev)
    vi.restoreAllMocks()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```powershell
cd packages/core
pnpm test --run
```
Expected: FAIL — AmbientEngine not found.

- [ ] **Step 3: Create ambient-engine.ts**

```typescript
// packages/core/src/ambient-engine.ts
import { gaussian } from './math-utils'
import type { SensorSnapshot, AmbientType } from './sensor-bus'
import type { Mood } from './mood-engine'

const SILENCE_SLEEP_S = 300        // 5 minutes
const AMBIENT_LLM_PROB = 0.15
const AMBIENT_LLM_MEAN_MS = 30 * 60 * 1000
const AMBIENT_LLM_STD_MS  = 10 * 60 * 1000

export class AmbientEngine {
  private nextCheckAt: number

  constructor(private serverUrl: string) {
    this.nextCheckAt = Date.now() + gaussian(AMBIENT_LLM_MEAN_MS, AMBIENT_LLM_STD_MS)
  }

  async update(
    snapshot: SensorSnapshot,
    mood: Mood,
    onSleep: () => void,
  ): Promise<string | null> {
    if (snapshot.ambientType === 'silence' && snapshot.ambientDurationS > SILENCE_SLEEP_S) {
      onSleep()
      return null
    }

    if (Date.now() >= this.nextCheckAt) {
      this.nextCheckAt = Date.now() + gaussian(AMBIENT_LLM_MEAN_MS, AMBIENT_LLM_STD_MS)
      if (Math.random() < AMBIENT_LLM_PROB) {
        return this.fetchAmbientReaction(snapshot, mood)
      }
    }

    return null
  }

  private async fetchAmbientReaction(snapshot: SensorSnapshot, mood: Mood): Promise<string | null> {
    const systemPrompt = `Eres un companion de escritorio con mood "${mood.name}". Reacciona espontáneamente al ambiente con UNA frase corta en español (máx 8 palabras). Ambiente: ${snapshot.ambientType} por ${snapshot.ambientDurationS}s. Son las ${snapshot.time.hour}h.`
    try {
      const resp = await fetch(`${this.serverUrl}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `ambiente detectado: ${snapshot.ambientType}`,
          avatarId: 'ambient',
          personality: systemPrompt,
          history: [],
        }),
      })
      if (!resp.ok) return null
      const { content } = await resp.json() as { content: string }
      return content ?? null
    } catch { return null }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```powershell
cd packages/core
pnpm test --run
```
Expected: all ambient-engine tests PASS.

- [ ] **Step 5: Export from index.ts**

```typescript
// packages/core/src/index.ts — add:
export { AmbientEngine } from './ambient-engine'
```

- [ ] **Step 6: Wire AmbientEngine in BuddyOverlay**

In `apps/desktop/src/BuddyOverlay.tsx`:

**a) Add import:**
```typescript
import { AmbientEngine } from '@buddy/core'
```

**b) Add ref near other refs:**
```typescript
const ambientRef = useRef<AmbientEngine | null>(null)
if (ambientRef.current === null) {
  ambientRef.current = new AmbientEngine(SERVER_URL)
}
```

**c) Add useEffect that runs on each snapshot** — add alongside the existing snapshot effects:
```typescript
useEffect(() => {
  if (!snapshot) return
  ambientRef.current!.update(snapshot, mood, () => setSleep())
    .then(reaction => {
      if (!reaction) return
      if (textEnabled) setBubbleText(reaction)
      speak(reaction)
    })
}, [snapshot, mood])
```

- [ ] **Step 7: Run full test suite**

```powershell
cd packages/core
pnpm test --run
```
Expected: all tests pass.

- [ ] **Step 8: Run Buddy and observe**

```powershell
cd apps/desktop
pnpm dev
```

Go silent for 5 minutes — avatar should go to sleep state. Play music near mic for 4+ seconds — `ambientType` in SensorsPanel should show `music`. No LLM calls happen unless the random timer fires (~30min average).

- [ ] **Step 9: Commit**

```bash
git add packages/core/src/ambient-engine.ts packages/core/src/__tests__/ambient-engine.test.ts packages/core/src/index.ts apps/desktop/src/BuddyOverlay.tsx
git commit -m "feat: ambient awareness — silence sleep, music detection, random LLM reactions"
```
