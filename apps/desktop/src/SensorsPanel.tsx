import { useEffect, useState } from 'react'
import { listen } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'
import type { SensorSnapshot, Mood } from '@buddy/core'

interface Props {
  snapshot: SensorSnapshot | null
  mood: Mood
  micEnabled: boolean
  onToggleMic: (v: boolean) => void
  onClose: () => void
}

const MOOD_LABEL: Record<string, string> = {
  playful: 'Juguetón', curious: 'Curioso', calm: 'Tranquilo',
  tired: 'Cansado', focused: 'Concentrado', sleepy: 'Somnoliento',
}
const MOOD_COLOR: Record<string, string> = {
  playful: '#f472b6', curious: '#818cf8', calm: '#34d399',
  tired: '#9ca3af', focused: '#60a5fa', sleepy: '#475569',
}

function formatIdle(ms: number): string {
  if (ms < 60_000) return `hace ${Math.round(ms / 1000)}s`
  if (ms < 3_600_000) return `hace ${Math.round(ms / 60_000)} min`
  return `hace ${Math.round(ms / 3_600_000)}h`
}

function formatExpiry(expiresAt: number): string {
  const left = expiresAt - Date.now()
  if (left <= 0) return 'expiró'
  const min = Math.ceil(left / 60_000)
  return `${min} min`
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div onClick={() => onChange(!checked)} style={{
      width: 40, height: 22, borderRadius: 11, cursor: 'pointer', flexShrink: 0,
      background: checked ? '#6366f1' : '#374151',
      position: 'relative', transition: 'background 0.2s',
    }}>
      <div style={{
        position: 'absolute', top: 4, width: 14, height: 14, borderRadius: 7,
        background: '#fff', transition: 'left 0.18s',
        left: checked ? 22 : 4, boxShadow: '0 1px 3px rgba(0,0,0,0.35)',
      }} />
    </div>
  )
}

const card: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 10, padding: '10px 12px',
  display: 'flex', flexDirection: 'column', gap: 8,
}
const cardTitle: React.CSSProperties = {
  fontSize: 10, color: '#4b5563', fontWeight: 700,
  letterSpacing: 1.1, textTransform: 'uppercase',
}
const rowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
}

export function SensorsPanel({ snapshot, mood, micEnabled, onToggleMic, onClose }: Props) {
  const [liveLevel, setLiveLevel] = useState(0)
  const [liveActive, setLiveActive] = useState(false)
  const [devices, setDevices] = useState<string[]>([])
  const [selectedDevice, setSelectedDevice] = useState('')

  useEffect(() => {
    let unlisten: (() => void) | undefined
    listen<{ level: number; active: boolean }>('mic-level', ({ payload }) => {
      setLiveLevel(payload.level)
      setLiveActive(payload.active)
    }).then(fn => { unlisten = fn })
    return () => { unlisten?.() }
  }, [])

  useEffect(() => {
    invoke<string[]>('get_audio_devices').then(devs => { setDevices(devs) })
  }, [])

  useEffect(() => {
    if (snapshot?.mic.deviceName && !selectedDevice) {
      setSelectedDevice(snapshot.mic.deviceName)
    }
  }, [snapshot?.mic.deviceName])

  const handleDeviceChange = (name: string) => {
    setSelectedDevice(name)
    invoke('set_mic_device', { deviceName: name })
  }

  const micBarPct = micEnabled ? Math.min(100, Math.round(liveLevel * 100 * 6)) : 0
  const micBarColor = micBarPct > 60 ? '#f59e0b' : micBarPct > 20 ? '#34d399' : '#374151'

  const activityLevel = snapshot?.input.level ?? 'idle'
  const activityLabels: Record<string, string> = { idle: 'Inactivo', light: 'Actividad leve', heavy: 'Actividad intensa' }
  const activityColors: Record<string, string> = { idle: '#4b5563', light: '#34d399', heavy: '#f59e0b' }

  return (
    <div style={{
      width: '100%', height: '100%',
      background: 'linear-gradient(160deg, rgba(13,13,26,0.99) 0%, rgba(22,18,38,0.99) 100%)',
      borderRadius: 14, padding: '14px 18px', color: '#fff',
      fontFamily: 'system-ui', display: 'flex', flexDirection: 'column',
      boxSizing: 'border-box', overflow: 'hidden',
    }}>

      {/* Header */}
      <div style={{ ...rowStyle, marginBottom: 14 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#e5e7eb' }}>Sensores</span>
        <button onClick={onClose} style={{
          background: 'rgba(255,255,255,0.07)', border: 'none', color: '#9ca3af',
          cursor: 'pointer', width: 24, height: 24, borderRadius: 6, fontSize: 14,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>×</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingRight: 4, paddingBottom: 20 }}>

        {/* Microphone */}
        <div style={card}>
          <div style={cardTitle}>Micrófono — escucha tu voz</div>

          <div style={rowStyle}>
            <div>
              <div style={{ fontSize: 12, color: '#d1d5db' }}>Escuchar wake word</div>
              <div style={{ fontSize: 11, color: '#4b5563', marginTop: 1 }}>
                {micEnabled ? 'Activo — puede oírte' : 'Silenciado — no escucha'}
              </div>
            </div>
            <Toggle checked={micEnabled} onChange={onToggleMic} />
          </div>

          {/* Device picker */}
          {devices.length > 0 && (
            <div style={{ position: 'relative' }}>
              <select
                value={selectedDevice}
                onChange={e => handleDeviceChange(e.target.value)}
                style={{
                  width: '100%', appearance: 'none', WebkitAppearance: 'none',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.09)',
                  borderRadius: 7, padding: '6px 28px 6px 10px',
                  color: '#e5e7eb', fontSize: 11, cursor: 'pointer', outline: 'none',
                  opacity: micEnabled ? 1 : 0.4,
                }}
                disabled={!micEnabled}
              >
                {devices.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <div style={{
                position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)',
                pointerEvents: 'none', color: '#6b7280', fontSize: 10,
              }}>▾</div>
            </div>
          )}

          {/* Level bar */}
          <div>
            <div style={rowStyle}>
              <span style={{ fontSize: 11, color: liveActive && micEnabled ? '#34d399' : '#4b5563' }}>
                {micEnabled ? (liveActive ? '● Detectando voz' : '○ Silencio') : '— Silenciado'}
              </span>
              <span style={{ fontSize: 11, color: '#4b5563', fontVariantNumeric: 'tabular-nums' }}>
                {(liveLevel * 100).toFixed(0)}%
              </span>
            </div>
            <div style={{ height: 5, background: 'rgba(255,255,255,0.07)', borderRadius: 3, marginTop: 5, overflow: 'hidden' }}>
              <div style={{ width: `${micBarPct}%`, height: '100%', background: micBarColor, borderRadius: 3, transition: 'width 0.1s ease' }} />
            </div>
          </div>
        </div>

        {/* User activity */}
        <div style={card}>
          <div style={cardTitle}>Tu actividad — teclado y mouse</div>
          <div style={rowStyle}>
            <span style={{
              background: (activityColors[activityLevel] ?? '#4b5563') + '22',
              color: activityColors[activityLevel] ?? '#4b5563',
              borderRadius: 6, padding: '2px 10px', fontSize: 11, fontWeight: 700,
            }}>
              {activityLabels[activityLevel] ?? activityLevel}
            </span>
            <span style={{ fontSize: 11, color: '#4b5563' }}>
              {snapshot ? formatIdle(snapshot.input.idleDuration) : '—'}
            </span>
          </div>
          <div style={{ fontSize: 11, color: '#4b5563' }}>
            Actividad intensa → enfocado / juguetón · Inactividad prolongada → somnoliento / cansado
          </div>
        </div>

        {/* Mood */}
        <div style={card}>
          <div style={cardTitle}>Estado de ánimo actual</div>
          <div style={rowStyle}>
            <div>
              <span style={{
                background: (MOOD_COLOR[mood.name] ?? '#6b7280') + '22',
                color: MOOD_COLOR[mood.name] ?? '#6b7280',
                borderRadius: 6, padding: '2px 10px', fontSize: 12, fontWeight: 700,
              }}>
                {MOOD_LABEL[mood.name] ?? mood.name}
              </span>
            </div>
            <span style={{ fontSize: 11, color: '#4b5563' }}>
              se recalcula en {formatExpiry(mood.expiresAt)}
            </span>
          </div>
          <div style={{ fontSize: 11, color: '#4b5563' }}>
            Afecta la velocidad de caminado y las animaciones del avatar
          </div>
        </div>

        {/* Time context */}
        <div style={card}>
          <div style={cardTitle}>Contexto de hora</div>
          <div style={{ fontSize: 13, color: '#d1d5db' }}>
            {snapshot ? `${snapshot.time.hour}:00 hs` : '—'}
            {snapshot?.time.isNight ? ' · de noche' : ' · de día'}
            {snapshot?.time.isWeekend ? ' · fin de semana' : ''}
          </div>
          <div style={{ fontSize: 11, color: '#4b5563' }}>
            Influye en el comportamiento del avatar
          </div>
        </div>

        {!snapshot && (
          <p style={{ textAlign: 'center', color: '#4b5563', fontSize: 11, margin: 0 }}>
            Primer snapshot en ~5s…
          </p>
        )}

      </div>
    </div>
  )
}
