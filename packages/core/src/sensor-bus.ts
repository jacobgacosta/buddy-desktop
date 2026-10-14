export type InputLevel = 'idle' | 'light' | 'heavy'
export type AmbientType = 'silence' | 'speech' | 'music'

export interface SensorSnapshot {
  timestamp: number
  mic: {
    active: boolean
    level: number
    deviceName: string
  }
  input: {
    keyRate: number
    mouseDistance: number
    level: InputLevel
    idleDuration: number
  }
  time: {
    hour: number
    isNight: boolean
    isWeekend: boolean
  }
  ambientType: AmbientType
  ambientDurationS: number
}

export function classifyInput(keyRate: number, idleDuration: number): InputLevel {
  if (idleDuration > 120_000) return 'idle'
  if (keyRate > 60) return 'heavy'
  return 'light'
}
