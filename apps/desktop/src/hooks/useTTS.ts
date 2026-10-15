import { useCallback, useRef } from 'react'

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:7788'

export function useTTS(enabled: boolean) {
  const ctxRef = useRef<AudioContext | null>(null)

  const speak = useCallback(async (text: string) => {
    if (!enabled) return
    try {
      const resp = await fetch(`${SERVER_URL}/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (!resp.ok) return

      const arrayBuffer = await resp.arrayBuffer()

      if (!ctxRef.current || ctxRef.current.state === 'closed') {
        ctxRef.current = new AudioContext()
      }
      const ctx = ctxRef.current
      if (ctx.state === 'suspended') await ctx.resume()

      const decoded = await ctx.decodeAudioData(arrayBuffer)
      const source = ctx.createBufferSource()
      source.buffer = decoded
      source.connect(ctx.destination)
      source.start()
    } catch (err) {
      console.error('[TTS]', err)
    }
  }, [enabled])

  return { speak }
}
