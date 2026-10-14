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
