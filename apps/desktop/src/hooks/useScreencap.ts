import { useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'

export function useScreencap(
  enabled: boolean,
  intervalSecs: number,
  monitor: string,
  avatarId: string,
  serverUrl: string,
) {
  useEffect(() => {
    if (!enabled || intervalSecs < 10) return

    const capture = async () => {
      try {
        const b64 = await invoke<string>('capture_screen', { monitor })
        await fetch(`${serverUrl}/context/screenshot`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ base64_image: b64, avatar_id: avatarId }),
        })
      } catch (e) {
        console.warn('[screencap]', e)
      }
    }

    const id = window.setInterval(capture, intervalSecs * 1000)
    return () => clearInterval(id)
  }, [enabled, intervalSecs, monitor, avatarId, serverUrl])
}
