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
