import { useState, useEffect, useRef } from 'react'
import { MoodEngine, fallbackMood } from '@buddy/core'
import type { Mood, SensorSnapshot } from '@buddy/core'

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:7788'

export function useMood(snapshot: SensorSnapshot | null): Mood {
  const engineRef = useRef<MoodEngine | null>(null)
  if (!engineRef.current) engineRef.current = new MoodEngine(SERVER_URL)

  const [mood, setMood] = useState<Mood>(() => fallbackMood(new Date().getHours()))

  useEffect(() => {
    if (!snapshot) return
    engineRef.current!.update(snapshot).then(setMood)
  }, [snapshot])

  return mood
}
