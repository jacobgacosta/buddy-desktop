# Buddy

Windows desktop companion — a floating AI avatar that lives on top of your screen, walks around autonomously, listens to your voice, reacts to your keyboard/mouse activity, and chats using a local LLM.

Built with **Tauri 2 + React + TypeScript** frontend, **Rust/Axum** backend, optional **ElevenLabs** or **Piper** TTS, and **Whisper** STT.

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Rust (GNU toolchain) | 1.95 | Pinned via `rust-toolchain.toml` — **do not upgrade** (see Gotchas) |
| Node.js | 20+ | |
| pnpm | 9+ | `npm i -g pnpm` |
| Docker Desktop | any | Only needed when `ELEVENLABS_API_KEY` is **not** set |
| LM Studio or Ollama | any | Local LLM endpoint |

> If `ELEVENLABS_API_KEY` is configured in `server/.env`, Docker is not required — Whisper and Piper containers are skipped.

---

## First-time setup

```powershell
# 1. Clone
git clone <repo-url>
cd buddy

# 2. JS dependencies
pnpm install

# 3. Configure environment
Copy-Item server\.env.example server\.env
# Edit server\.env — set at minimum ANTHROPIC_API_KEY and OLLAMA_URL

# 4. Launch  (builds everything on first run, ~5–8 min)
.\start.ps1
```

---

## Running

### Production (one-click)

```powershell
.\start.ps1
```

The script:
1. Starts `local-stt-server` Docker container (Whisper, port 8080) — skipped if ElevenLabs is configured
2. Starts `buddy-piper` Docker container (Piper TTS, port 5200) — skipped if ElevenLabs is configured
3. Builds and launches `buddy-server` (Rust/Axum, port 7788)
4. Builds and launches `buddy-desktop.exe` (Tauri)

First run downloads ~6 GB (Whisper `large-v3` model). Subsequent runs are near-instant.

### Development (hot reload)

```powershell
# Terminal 1 — backend
cd server
cargo run

# Terminal 2 — app
cd apps/desktop
pnpm tauri dev
```

> **Note:** `tauri dev` compiles in debug mode. The GNU toolchain can hit `STATUS_STACK_BUFFER_OVERRUN` in debug. If it crashes, build and run the release binary instead (`pnpm build:exe` then run `start.ps1`).

---

## Configuration

Copy `server/.env.example` to `server/.env`:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | Yes | — | Claude API — used for screencap vision analysis |
| `OLLAMA_URL` | Yes | `http://localhost:11434` | LLM endpoint (LM Studio or Ollama) |
| `LLM_MODEL` | No | `llama3.2:3b` | Model name for chat |
| `ELEVENLABS_API_KEY` | No | — | TTS primary (requires paid plan for library voices) |
| `ELEVENLABS_VOICE_ID` | No | `JBFqnCBsd6RMkjVDRZzb` | ElevenLabs voice ID |
| `WHISPER_URL` | No | `http://localhost:8080` | Whisper STT container |
| `WHISPER_LANG` | No | `es` | Transcription language |
| `WHISPER_PROMPT` | No | `buddy` | Hint to improve wake-word recognition |
| `PIPER_URL` | No | `http://localhost:5200` | Piper TTS fallback |
| `PORT` | No | `7788` | Server port |

---

## Architecture

```
buddy/
├── apps/desktop/          # Tauri v2 + React 19 + TypeScript
│   ├── src/               # React frontend (BuddyOverlay, panels, hooks)
│   └── src-tauri/         # Rust backend (window, tray, sensors, VAD, screen capture)
├── server/                # Rust/Axum HTTP server (port 7788)
│   └── src/routes/        # chat, tts, transcribe, mood, context, avatars
├── packages/
│   ├── core/              # Shared logic: LLM client, mood/behavior engine, intent router
│   ├── types/             # Shared TypeScript types
│   └── renderer/          # Character renderers (Rive, Canvas)
├── piper-server/          # Docker image for Piper TTS fallback
└── start.ps1              # Production launcher
```

Full technical reference: [docs/buddy-reference.md](docs/buddy-reference.md)

---

## Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+Space` | Show window and open chat |
| `Ctrl+Shift+I` | Open DevTools |

---

## Known issues / Gotchas

- **Rust toolchain pinned to 1.95-x86_64-pc-windows-gnu** — Rust 1.99 has a `STATUS_STACK_BUFFER_OVERRUN` ICE in the GNU/Windows dependency tree. Do not upgrade without testing.
- **Close LM Studio before `cargo build --release`** — GNU LLVM runs out of RAM if a large model (qwen3-8b etc.) is loaded during compilation. The release profile uses `opt-level=1, codegen-units=8` to reduce optimizer pressure.
- **Windows-only** — click-through (`SetWindowLongPtr`) and screen capture (`BitBlt`) use Win32 APIs not available on other platforms.
- **Never use `shadowBlur` on the avatar canvas** — it corrupts the DWM compositor on transparent Tauri windows (solid black window). Use multi-pass fake glow instead.
- **ElevenLabs requires a paid plan** to use library voices via API. Your own cloned voices work on the Free tier.
