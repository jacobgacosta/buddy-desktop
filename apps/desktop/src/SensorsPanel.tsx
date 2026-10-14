import type { SensorSnapshot, Mood } from '@buddy/core'

interface Props {
  snapshot: SensorSnapshot | null
  mood: Mood
  onClose: () => void
}

const dark = '#1f2937'
const card: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  borderRadius: 10,
  padding: '8px 10px',
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
}
const label: React.CSSProperties = { fontSize: 10, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8 }
const value: React.CSSProperties = { fontSize: 12, color: '#e5e7eb' }

const LEVEL_COLOR: Record<string, string> = {
  idle: '#6b7280', light: '#34d399', heavy: '#f59e0b',
}
const MOOD_COLOR: Record<string, string> = {
  playful: '#f472b6', curious: '#818cf8', calm: '#34d399',
  tired: '#9ca3af', focused: '#60a5fa', sleepy: '#475569',
}

function VolumeBar({ level }: { level: number }) {
  const pct = Math.min(100, Math.round(level * 100 * 6))  // amplify — mic RMS is usually tiny
  const color = pct > 60 ? '#f59e0b' : pct > 20 ? '#34d399' : '#4b5563'
  return (
    <div style={{ height: 6, background: '#1f2937', borderRadius: 3, overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.3s ease' }} />
    </div>
  )
}

function formatIdle(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}min`
  return `${Math.round(ms / 3_600_000)}h`
}

function formatExpiry(expiresAt: number): string {
  const left = expiresAt - Date.now()
  if (left <= 0) return 'expirado'
  const min = Math.ceil(left / 60_000)
  return `${min}min`
}

export function SensorsPanel({ snapshot, mood, onClose }: Props) {
  return (
    <div style={{
      width: '100%', height: '100%',
      background: 'rgba(20,20,30,0.95)',
      borderRadius: 16, padding: 12, color: '#fff',
      fontFamily: 'system-ui', fontSize: 13,
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      display: 'flex', flexDirection: 'column', gap: 8,
      boxSizing: 'border-box', overflowY: 'auto',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>Sensores</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '2px 4px' }}>×</button>
      </div>

      {/* Mic */}
      <div style={card}>
        <span style={label}>🎤 Micrófono</span>
        <span style={{ ...value, fontSize: 11, color: '#9ca3af', wordBreak: 'break-word' }}>
          {snapshot?.mic.deviceName || 'Esperando primer snapshot…'}
        </span>
        <VolumeBar level={snapshot?.mic.level ?? 0} />
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, color: snapshot?.mic.active ? '#34d399' : '#6b7280' }}>
            {snapshot?.mic.active ? '● Activo' : '○ Silencio'}
          </span>
          <span style={{ fontSize: 11, color: '#6b7280' }}>
            RMS {((snapshot?.mic.level ?? 0) * 100).toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Input */}
      <div style={card}>
        <span style={label}>⌨️ Input</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            background: LEVEL_COLOR[snapshot?.input.level ?? 'idle'] + '22',
            color: LEVEL_COLOR[snapshot?.input.level ?? 'idle'],
            borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600,
          }}>
            {snapshot?.input.level ?? '—'}
          </span>
          <span style={{ fontSize: 11, color: '#6b7280' }}>
            {Math.round(snapshot?.input.keyRate ?? 0)} teclas/min
          </span>
        </div>
        <span style={{ fontSize: 11, color: '#6b7280' }}>
          Idle hace {snapshot ? formatIdle(snapshot.input.idleDuration) : '—'}
        </span>
      </div>

      {/* Mood */}
      <div style={card}>
        <span style={label}>🧠 Mood actual</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            background: (MOOD_COLOR[mood.name] ?? '#6b7280') + '22',
            color: MOOD_COLOR[mood.name] ?? '#6b7280',
            borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600,
          }}>
            {mood.name}
          </span>
          <span style={{ fontSize: 11, color: '#9ca3af' }}>{mood.energy}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, color: '#6b7280' }}>restless: {mood.restlessness}</span>
          <span style={{ fontSize: 11, color: '#6b7280' }}>z: {mood.zOrder}</span>
        </div>
        <span style={{ fontSize: 11, color: '#6b7280' }}>
          Expira en {formatExpiry(mood.expiresAt)}
        </span>
      </div>

      {/* Time */}
      <div style={card}>
        <span style={label}>🕐 Contexto temporal</span>
        <span style={value}>
          {snapshot ? `${snapshot.time.hour}:00h` : '—'}
          {snapshot?.time.isNight ? ' · noche' : ''}
          {snapshot?.time.isWeekend ? ' · fin de semana' : ''}
        </span>
      </div>

      {snapshot === null && (
        <div style={{ textAlign: 'center', color: '#6b7280', fontSize: 11, paddingTop: 4 }}>
          Primer snapshot en ~5s
        </div>
      )}
    </div>
  )
}
