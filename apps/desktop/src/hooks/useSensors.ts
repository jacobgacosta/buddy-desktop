import { useEffect, useState } from 'react'
import { listen } from '@tauri-apps/api/event'
import type { SensorSnapshot } from '@buddy/core'

interface RawPayload {
  timestamp: number
  mic_active: boolean
  mic_level: number
  key_rate: number
  mouse_distance: number
  input_level: 'idle' | 'light' | 'heavy'
  idle_duration_ms: number
  hour: number
  is_night: boolean
  is_weekend: boolean
}

export function useSensors(): SensorSnapshot | null {
  const [snapshot, setSnapshot] = useState<SensorSnapshot | null>(null)

  useEffect(() => {
    let unlisten: (() => void) | undefined
    listen<RawPayload>('sensor-snapshot', ({ payload: p }) => {
      setSnapshot({
        timestamp: p.timestamp,
        mic:   { active: p.mic_active, level: p.mic_level },
        input: { keyRate: p.key_rate, mouseDistance: p.mouse_distance, level: p.input_level, idleDuration: p.idle_duration_ms },
        time:  { hour: p.hour, isNight: p.is_night, isWeekend: p.is_weekend },
      })
    }).then(fn => { unlisten = fn })
    return () => { unlisten?.() }
  }, [])

  return snapshot
}
