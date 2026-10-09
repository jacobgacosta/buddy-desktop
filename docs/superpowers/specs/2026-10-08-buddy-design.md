# Buddy — Diseño del Sistema

**Fecha:** 2026-10-08  
**Estado:** Aprobado

---

## Resumen

Buddy es un compañero digital animado que flota libremente sobre la pantalla en todas las plataformas (Windows, macOS, Linux, Android, iOS, Browser Extension). Es simultáneamente asistente de productividad, compañero con personalidad, y consciente del contexto de lo que el usuario está haciendo. Los personajes son seleccionables desde un catálogo extensible.

---

## 1. Arquitectura General

### Monorepo (pnpm workspaces)

```
buddy/
├── packages/
│   ├── core/        # LLM client, TTS/STT, avatar state machine, WebSocket sync
│   ├── renderer/    # Rive player + componentes React reutilizables
│   └── types/       # tipos TypeScript compartidos (Avatar, Message, SyncEvent...)
├── apps/
│   ├── desktop/     # Tauri 2 (Win/Mac/Linux) — ventana flotante transparente
│   ├── mobile/      # React Native (Android burbuja / iOS PiP)
│   └── extension/   # Chrome/Firefox Manifest V3 — shadow DOM
└── server/          # Rust (Axum) — sidecar lanzado por Tauri, puerto 7788
    ├── src/routes/  # /chat /tts /stt /avatars /sync
    └── src/llm/     # Ollama client + OpenAI/Claude/Gemini clients
```

### Principio de separación

- **Shell** (Tauri / RN / Extension): sabe _dónde_ está Buddy en pantalla y cómo dibujarlo.
- **`@buddy/core`**: sabe _qué piensa_ y _qué dice_. Lógica compartida entre todas las plataformas.
- **Servidor Axum**: guarda historial, proxifica APIs externas, mantiene API keys seguras.

Estos tres niveles nunca se mezclan directamente.

### Topología en runtime

```
Desktop:
  Tauri (UI flotante) ──lanza──▶ Axum sidecar :7788
                                      │
                      ┌───────────────┼───────────────┐
                      ▼               ▼               ▼
                Ollama (local)  OpenAI/Claude    ElevenLabs

Misma red WiFi:
  Mobile (RN)    ──────────────────▶ :7788
  Extension      ──────────────────▶ localhost:7788
```

API keys (OpenAI, ElevenLabs, etc.) viven **únicamente** en el servidor. Nunca en mobile ni en la extension.

---

## 2. Sistema de Avatares

### Modelo de datos

```typescript
interface Avatar {
  id: string              // "fox", "robot-k", "sage"
  name: string
  riveFile: string        // "fox.riv"
  stateMachine: string    // nombre de la state machine en Rive
  personality: string     // system prompt del personaje
  voice: {
    system: string        // voz TTS nativa
    elevenlabs?: string   // voice ID premium ElevenLabs
  }
  palette: string[]       // colores UI del personaje
  size: "small" | "medium" | "large"
}
```

### Animaciones Rive (state machine por personaje)

| Estado | Descripción |
|--------|-------------|
| `idle` | Respira, parpadea, movimientos sutiles |
| `walk` | Camina por la pantalla |
| `talk` | Lip-sync sincronizado con audio |
| `think` | Esperando respuesta del LLM |
| `react_happy` | Reacción positiva |
| `sleep` | Inactividad prolongada (+5 min) |

### Catálogo extensible

Cada personaje = un archivo `.riv` + un `avatar.json` en `server/avatars/`. Se pueden agregar nuevos personajes sin recompilar la app — el endpoint `GET /avatars` sirve el catálogo dinámicamente.

**Personajes iniciales:** Foxy (zorro), K-3 (robot), Sage (mago).

---

## 3. Overlay por Plataforma

### Desktop — Tauri 2 (Win / Mac / Linux)

Configuración de ventana:
```json
{ "transparent": true, "decorations": false, "always_on_top": true, "skip_taskbar": true, "resizable": false }
```

- **Mouse passthrough**: `window.set_ignore_cursor_events(true)` cuando el cursor está fuera del sprite; `false` cuando está sobre él. Hit-test pixel-perfect via alpha del canvas.
- **Física de movimiento**: loop en `@buddy/core` calcula (x, y), detecta bordes del monitor, aplica gravedad suave. Buddy puede sentarse en la barra de tareas y caminar de esquina a esquina.

### Mobile — React Native

**Android**: permiso `SYSTEM_ALERT_WINDOW` + `WindowManager` view via servicio en background. Buddy sobrevive cambios de app.

**iOS**: Apple no permite overlays arbitrarios. Experiencia degradada: Picture-in-Picture (canvas de video sintético) + Live Activity en Dynamic Island. Buddy funciona pero con menos libertad de movimiento.

### Browser Extension — Chrome / Firefox MV3

- Content script inyecta `<div id="buddy-root">` con Shadow DOM en cada pestaña (CSS aislado de la página).
- Canvas Rive corre dentro del Shadow DOM.
- Service worker maneja llamadas a `localhost:7788`.
- Context-awareness: lee `document.title`, URL actual, y texto seleccionado para enviarlo como contexto al LLM.

---

## 4. Cerebro (LLM + Voz + Contexto)

### Pipeline LLM híbrido

```
[Mensaje usuario] + [Contexto pantalla opcional] + [Personality prompt del avatar]
  └──▶ Axum /chat
          ├── Ollama local (prioridad — sin internet, gratis)
          └── fallback: OpenAI / Claude / Gemini (cloud)
```

La respuesta llega como **stream** — Buddy empieza a hablar mientras el LLM termina de generar.

### TTS (voz saliente)

- **Sistema** (gratis, offline): Web Speech API / OS TTS nativo.
- **Premium** (ElevenLabs): proxificado via Axum `/tts`. La API key nunca sale del servidor.
- **Lip-sync**: el audio se analiza para extraer visemas → anima la boca del avatar en Rive en tiempo real.

### STT (voz entrante)

- **Web Speech API**: offline, baja latencia.
- **Whisper** (via Axum `/stt`): mayor precisión, especialmente en español.
- Modos: push-to-talk o activación por voz. Configurable en settings.

### Contexto de pantalla (opt-in)

| Plataforma | Mecanismo |
|-----------|-----------|
| Desktop | Screenshot cada 30s (configurable) via Tauri plugin → enviado a LLM como contexto visual |
| Extension | Lee `document.title`, URL y texto seleccionado |
| Android | App activa via `AccessibilityService` |
| iOS | No disponible (restricciones Apple) |

El screen context es **opt-in**. Buddy pide permiso explícito la primera vez.

---

## 5. Sync Multi-Device

### Estado sincronizado

- Avatar activo seleccionado
- Historial de conversación (últimas 100 mensajes por avatar)
- Estado de humor del personaje
- Preferencias (voz, tema, permisos)

### Mecanismo

- **Transporte**: WebSocket a `ws://localhost:7788/sync`.
- **Persistencia**: SQLite dentro del sidecar Axum.
- **Hub**: el desktop es el hub. Mobile y extension se conectan por WiFi local. No hay servidor en la nube propio.

### Handoff entre dispositivos

Al detectar inactividad en desktop (+2 min) o manualmente:

1. Buddy en desktop: animación "wave" → estado `sleep`.
2. Evento WebSocket: `{ type: "handoff", from: "desktop", to: "mobile", state: {...} }`.
3. Buddy en mobile: notificación "Aquí estoy 🦊", conversación continúa sin perder contexto.

El handoff automático vs manual es configurable en settings.

---

## 6. Autenticación y usuarios

MVP: **sin cuentas de usuario**. Buddy es single-user y local-first. No hay login, no hay backend en la nube. El sidecar Axum corre en localhost y no está expuesto a internet.

Para acceso desde mobile en red local, el sidecar acepta conexiones del mismo WiFi sin autenticación (confianza de red local). Si en el futuro se requiere acceso remoto, se añade un token de sesión simple.

---

## 7. Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Desktop shell | Tauri 2 (Rust + WebView) |
| Mobile shell | React Native 0.75+ |
| Browser extension | Chrome/Firefox MV3 |
| Animaciones | Rive (`.riv` + state machines) |
| UI compartida | React + TypeScript (`@buddy/renderer`) |
| Lógica compartida | TypeScript (`@buddy/core`) |
| Servidor / sidecar | Rust + Axum |
| LLM local | Ollama |
| LLM cloud | OpenAI / Claude / Gemini (configurable) |
| TTS premium | ElevenLabs (via servidor) |
| STT premium | Whisper (via servidor) |
| Persistencia | SQLite (sidecar) + SharedPreferences / SecureStorage (cliente) |
| Sync | WebSocket (Axum → todos los clientes) |

---

## 8. Decisiones clave

| Decisión | Alternativa descartada | Razón |
|----------|----------------------|-------|
| Tauri en vez de Electron | Electron | Más ligero en RAM/CPU — vive 24/7 en background |
| Rust para el servidor | Kotlin/Koupper | Mismo lenguaje que el shell desktop, tipos compartidos vía serde |
| Axum como sidecar local | Servidor cloud propio | Sin costo de hosting, funciona offline, mobile usa WiFi local |
| Rive para animaciones | Lottie / Spine 2D | State machines nativas, reacciona a audio, soporte React/RN/web |
| React Native para mobile | Flutter | Comparte más código con el shell Tauri (TypeScript/React) |
| Ollama-first para LLM | Cloud-first | Gratis, offline, privado; cloud como fallback de calidad |
