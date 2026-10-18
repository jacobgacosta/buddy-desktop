# Buddy — Claude Code context

Desktop companion avatar with voice, sensors, and AI personality. Windows-only (Tauri v2).

## Architecture

```
buddy/
├── apps/desktop/          # Tauri v2 + React + TypeScript (the app)
│   ├── src/               # React frontend
│   │   ├── BuddyOverlay.tsx      # root component, physics loop, panel logic
│   │   ├── ChatBubble.tsx        # chat panel
│   │   ├── ContextMenu.tsx       # right-click menu
│   │   ├── SettingsPanel.tsx     # personality / voice settings
│   │   ├── SensorsPanel.tsx      # sensors + mic mute
│   │   ├── CharacterPicker.tsx   # character + animation config
│   │   ├── SpeechBubble.tsx      # TTS text overlay (typewriter)
│   │   ├── physics.ts            # walk/fidget physics (RAF loop)
│   │   ├── characters/registry.ts  # character manifest list
│   │   └── hooks/
│   │       ├── useBuddy.ts    # LLM conversation state
│   │       ├── useTTS.ts      # WebAudio Piper TTS player
│   │       ├── useVoice.ts    # voice-captured event → Whisper transcription
│   │       ├── useSensors.ts  # polls Tauri for SensorSnapshot
│   │       └── useMood.ts     # derives Mood from SensorSnapshot
│   └── src-tauri/         # Rust backend
│       ├── tauri.conf.json        # window: 260×220, transparent, no decorations
│       └── src/
│           ├── main.rs, lib.rs    # Tauri commands
│           ├── sensors.rs         # keyboard/mouse/time snapshot
│           ├── voice.rs           # VAD: Idle→Recording→Trailing, emits 'voice-captured'
│           └── mic.rs             # mic device management, emits 'mic-level'
├── server/                # Rust HTTP server (Axum) on port 7788
│   └── src/routes/
│       ├── chat.rs        # POST /chat → Claude API
│       ├── tts.rs         # POST /tts → Piper (Docker port 5200)
│       ├── transcribe.rs  # POST /transcribe → Whisper (Docker port 8080)
│       ├── mood.rs        # GET /mood
│       └── avatars.rs     # GET /avatars
├── packages/
│   ├── core/              # mood-engine, behavior-engine, intent-router, ambient-engine, llm-client
│   ├── types/             # shared TypeScript types (Avatar, Message, AvatarState, VoiceCommand…)
│   └── renderer/          # CharacterRenderer React component (Rive + Lottie)
├── piper-server/          # Dockerfile for Piper TTS (Spanish voice)
└── start.ps1              # Production launcher: Docker → server → desktop
```

## Running

```powershell
# Dev (hot reload)
cd apps/desktop
pnpm tauri dev

# Production (full stack)
.\start.ps1        # starts Whisper+Piper Docker, Rust server, then desktop exe

# Build exe only (no installer)
cd apps/desktop && pnpm build:exe
```

## Window sizing system

The Tauri window is resized dynamically via `invoke('set_window_size', {w, h})`.

| State             | W   | H   |
|-------------------|-----|-----|
| Compact (idle)    | 260 | 220 |
| Speech bubble     | 260 | 310 |
| Chat / menu       | 260 | 480 |
| Config panels     | 360 | 640 |

- Avatar sprite: 200×200, `top:0 left:30` within the window
- Chat panel top: `PANEL_TOP=152` (overlaps avatar bottom)
- Config panel top: `FULL_PANEL_TOP=200` (just below avatar)
- Panel z-index 20, avatar z-index 10 → chat overlaps avatar bottom

## Panel system

Only one panel open at a time. `switchTo(openFn)`:
- If something is already open → `closeAll()` + 300ms delay → open next
- If nothing open → open immediately

Panels: chat, settings (personality), picker (character), sensors (mic + activity).

## Physics & behavior

- RAF loop in `BuddyOverlay.tsx`, physics state in `physics.ts`
- Avatar walks autonomously every ~8s (gaussian), fidgets when mood enables it
- `isFidget` flag prevents the return-to-home branch from triggering during real walks
- `scheduleNextWalk()` always sets `isFidget: false` on the new physics state

## Voice pipeline

1. Rust VAD (`voice.rs`) emits `voice-captured` event with WAV base64
2. `useVoice` hook sends to `POST /transcribe` (Whisper)
3. `detectIntent` in `@buddy/core` checks for wake word + commands
4. Wake word → `sendMessage()` → LLM; commands → `handleCommand()`

Mic can be toggled in Sensores panel. `useVoice(callback, micEnabled)` — skips transcription when disabled.

## TTS

- `useTTS(enabled, volume)` — WebAudio `GainNode` for volume, `AudioContext` for playback
- Fetches WAV from `POST /tts` (Piper Docker at 5200, proxied via server at 7788)

## Characters

Defined in `src/characters/registry.ts`. Currently: `ai-orb`, `joy`, `kabi`, `aurora`.
Each has: id, name, wakeWord, personality, palette, type ('rive'|'lottie'), animFile, availableAnims.
Animation overrides stored in `localStorage` under `buddy-anims-{id}`.

## Environment variables (server)

| Var           | Default              | Purpose              |
|---------------|----------------------|----------------------|
| ANTHROPIC_API_KEY    | (required)            | Claude API                      |
| ELEVENLABS_API_KEY   | (optional)            | TTS primario — eleven_v4        |
| ELEVENLABS_VOICE_ID  | (optional)            | Voice ID de ElevenLabs          |
| WHISPER_URL          | http://localhost:8080 | faster-whisper-server (STT)     |
| PIPER_URL            | http://localhost:5200 | Piper TTS (fallback si no EL)   |
| WHISPER_LANG         | es                    | transcription language          |

## Key localStorage keys (frontend)

- `buddy-pos` — last window position
- `buddy-character-v2` — selected character id
- `buddy-avatar-config` — {name, personality}
- `buddy-history` — last 30 chat messages
- `buddy-tts-voice`, `buddy-tts-text`, `buddy-tts-volume` — TTS settings
- `buddy-mic-enabled` — mic toggle
- `buddy-anims-{id}` — animation overrides per character
