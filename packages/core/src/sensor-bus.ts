export type InputLevel = 'idle' | 'light' | 'heavy'

export interface SensorSnapshot {
  timestamp: number
  mic: {
    active: boolean
    level: number       // 0-1 RMS volume
    deviceName: string
  }
  input: {
    keyRate: number     // keypresses/min in last 60s
    mouseDistance: number
    level: InputLevel
    idleDuration: number // ms since last input
  }
  time: {
    hour: number
    isNight: boolean    // 22h-6h
    isWeekend: boolean
  }
}

export function classifyInput(keyRate: number, idleDuration: number): InputLevel {
  if (idleDuration > 120_000) return 'idle'
  if (keyRate > 60) return 'heavy'
  return 'light'
}
