import { useEffect, useRef } from 'react'
import { listen } from '@tauri-apps/api/event'

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:7788'

const HALLUCINATIONS = [
  'gracias por ver', 'suscríbete', 'like', 'subtitulado', 'subtítulos',
  'amara.org', 'transcripción', 'fin del video', 'no olvides',
]

function isHallucination(text: string): boolean {
  const lower = text.toLowerCase()
  // Whisper silence hallucinations are often very short or match known patterns
  if (HALLUCINATIONS.some(h => lower.includes(h))) return true
  // Pure punctuation or single char
  if (text.replace(/[.,!?¿¡\s]/g, '').length < 2) return true
  return false
}

interface VoiceCapturedPayload {
  audio_b64: string
  duration_ms: number
}

export function useVoice(onTranscript: (text: string) => void, enabled = true): void {
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled

  useEffect(() => {
    let unlisten: (() => void) | undefined

    listen<VoiceCapturedPayload>('voice-captured', async ({ payload }) => {
      if (!enabledRef.current) return
      try {
        const resp = await fetch(`${SERVER_URL}/transcribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ audio_b64: payload.audio_b64 }),
        })
        if (!resp.ok) return
        const { transcript } = await resp.json() as { transcript: string }
        const t = transcript.trim()
        if (t && !isHallucination(t)) onTranscript(t)
      } catch { /* silent */ }
    }).then(fn => { unlisten = fn })

    return () => { unlisten?.() }
  }, [onTranscript])
}
