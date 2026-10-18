import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'

interface ContextConfig {
  memory_enabled: boolean
  memory_max_entries: number
  memory_path: string
  screenshot_enabled: boolean
  screenshot_interval_secs: number
  screenshot_save_to_disk: boolean
  screenshot_save_path: string
  screenshot_monitor: string
  memory_inject_count: number
}

interface ScreenInfo {
  index: number
  width: number
  height: number
  x: number
  y: number
  is_primary: boolean
}

interface Props {
  serverUrl: string
  onClose: () => void
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div
      onClick={() => onChange(!checked)}
      style={{
        width: 40, height: 22, borderRadius: 11, cursor: 'pointer', flexShrink: 0,
        background: checked ? '#6366f1' : '#374151',
        position: 'relative', transition: 'background 0.2s',
      }}
    >
      <div style={{
        position: 'absolute', top: 4, width: 14, height: 14, borderRadius: 7,
        background: '#fff', transition: 'left 0.18s',
        left: checked ? 22 : 4,
        boxShadow: '0 1px 3px rgba(0,0,0,0.35)',
      }} />
    </div>
  )
}

const sectionTitle: React.CSSProperties = {
  fontSize: 10, color: '#4b5563', fontWeight: 700, letterSpacing: 1.2,
  textTransform: 'uppercase', marginBottom: 10,
}
const fieldLbl: React.CSSProperties = { fontSize: 12, color: '#9ca3af' }
const row: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between' }

const INTERVALS = [
  { label: '30 segundos', value: 30 },
  { label: '1 minuto',    value: 60 },
  { label: '2 minutos',   value: 120 },
  { label: '5 minutos',   value: 300 },
]

const DEFAULT_CFG: ContextConfig = {
  memory_enabled: true,
  memory_max_entries: 100,
  memory_path: './buddy-memory.json',
  screenshot_enabled: false,
  screenshot_interval_secs: 60,
  screenshot_save_to_disk: false,
  screenshot_save_path: './screenshots',
  screenshot_monitor: 'buddy',
  memory_inject_count: 5,
}

export function ContextPanel({ serverUrl, onClose }: Props) {
  const [cfg, setCfg] = useState<ContextConfig>(DEFAULT_CFG)
  const [screens, setScreens] = useState<ScreenInfo[]>([])
  const [saving, setSaving] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    fetch(`${serverUrl}/context/config`)
      .then(r => r.json())
      .then(setCfg)
      .catch(() => {})
    invoke<ScreenInfo[]>('get_screens')
      .then(setScreens)
      .catch(() => {})
  }, [serverUrl])

  const set = <K extends keyof ContextConfig>(k: K, v: ContextConfig[K]) =>
    setCfg(prev => ({ ...prev, [k]: v }))

  const handleSave = async () => {
    setSaving(true)
    setStatus(null)
    try {
      const res = await fetch(`${serverUrl}/context/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cfg),
      })
      setStatus(res.ok ? '✓ Guardado' : 'Error al guardar')
    } catch {
      setStatus('Error de conexión')
    } finally {
      setSaving(false)
      setTimeout(() => setStatus(null), 2000)
    }
  }

  const handleClearMemory = async () => {
    setClearing(true)
    try {
      await fetch(`${serverUrl}/context/memories`, { method: 'DELETE' })
      setStatus('✓ Memoria limpiada')
    } catch {
      setStatus('Error al limpiar')
    } finally {
      setClearing(false)
      setTimeout(() => setStatus(null), 2000)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.09)', borderRadius: 8,
    padding: '7px 10px', color: '#e5e7eb', fontSize: 12,
    outline: 'none', boxSizing: 'border-box',
  }
  const selectStyle: React.CSSProperties = { ...inputStyle, cursor: 'pointer' }
  const numStyle: React.CSSProperties = { ...inputStyle, width: 80, textAlign: 'right' }

  return (
    <div style={{
      width: '100%', height: '100%',
      background: 'linear-gradient(160deg, rgba(13,13,26,0.99) 0%, rgba(22,18,38,0.99) 100%)',
      borderRadius: 14, padding: '14px 18px', color: '#fff',
      fontFamily: 'system-ui', display: 'flex', flexDirection: 'column',
      boxSizing: 'border-box', overflow: 'hidden',
    }}>

      {/* Header */}
      <div style={{ ...row, marginBottom: 18 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#e5e7eb' }}>Contexto & Memoria</span>
        <button onClick={onClose} style={{
          background: 'rgba(255,255,255,0.07)', border: 'none', color: '#9ca3af',
          cursor: 'pointer', width: 24, height: 24, borderRadius: 6, fontSize: 14,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>×</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20, paddingRight: 4, paddingBottom: 20 }}>

        {/* Memoria */}
        <section>
          <div style={sectionTitle}>Memoria</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            <div style={row}>
              <span style={fieldLbl}>Activar memoria</span>
              <Toggle checked={cfg.memory_enabled} onChange={v => set('memory_enabled', v)} />
            </div>

            <div style={{ ...row, opacity: cfg.memory_enabled ? 1 : 0.35 }}>
              <span style={fieldLbl}>Entradas a inyectar</span>
              <input
                type="number" min={1} max={20} value={cfg.memory_inject_count}
                onChange={e => set('memory_inject_count', Number(e.target.value))}
                disabled={!cfg.memory_enabled}
                style={numStyle}
              />
            </div>

            <div style={{ ...row, opacity: cfg.memory_enabled ? 1 : 0.35 }}>
              <span style={fieldLbl}>Máximo en base de datos</span>
              <input
                type="number" min={10} max={1000} value={cfg.memory_max_entries}
                onChange={e => set('memory_max_entries', Number(e.target.value))}
                disabled={!cfg.memory_enabled}
                style={numStyle}
              />
            </div>

            <div style={{ opacity: cfg.memory_enabled ? 1 : 0.35 }}>
              <div style={{ ...fieldLbl, marginBottom: 5 }}>Ruta del archivo .json</div>
              <input
                value={cfg.memory_path}
                onChange={e => set('memory_path', e.target.value)}
                disabled={!cfg.memory_enabled}
                style={inputStyle}
              />
            </div>

            <button
              onClick={handleClearMemory}
              disabled={clearing || !cfg.memory_enabled}
              style={{
                background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)',
                borderRadius: 8, padding: '7px 0', color: '#f87171', cursor: 'pointer',
                fontSize: 12, opacity: cfg.memory_enabled ? 1 : 0.35,
              }}
            >
              {clearing ? 'Limpiando…' : 'Limpiar toda la memoria'}
            </button>
          </div>
        </section>

        {/* Captura de pantalla */}
        <section>
          <div style={sectionTitle}>Captura de pantalla</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            <div style={row}>
              <span style={fieldLbl}>Activar captura</span>
              <Toggle checked={cfg.screenshot_enabled} onChange={v => set('screenshot_enabled', v)} />
            </div>

            <div style={{ ...row, opacity: cfg.screenshot_enabled ? 1 : 0.35 }}>
              <span style={fieldLbl}>Intervalo</span>
              <select
                value={cfg.screenshot_interval_secs}
                onChange={e => set('screenshot_interval_secs', Number(e.target.value))}
                disabled={!cfg.screenshot_enabled}
                style={{ ...selectStyle, width: 130 }}
              >
                {INTERVALS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <div style={{ ...row, opacity: cfg.screenshot_enabled ? 1 : 0.35 }}>
              <span style={fieldLbl}>Monitor</span>
              <select
                value={cfg.screenshot_monitor}
                onChange={e => set('screenshot_monitor', e.target.value)}
                disabled={!cfg.screenshot_enabled}
                style={{ ...selectStyle, width: 130 }}
              >
                <option value="buddy">Seguir a Buddy</option>
                {screens.map(s => (
                  <option key={s.index} value={String(s.index)}>
                    {s.is_primary ? 'Principal' : `Pantalla ${s.index + 1}`} ({s.width}×{s.height})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ ...row, opacity: cfg.screenshot_enabled ? 1 : 0.35 }}>
              <span style={fieldLbl}>Guardar en disco</span>
              <Toggle
                checked={cfg.screenshot_save_to_disk}
                onChange={v => set('screenshot_save_to_disk', v)}
              />
            </div>

            {cfg.screenshot_save_to_disk && cfg.screenshot_enabled && (
              <div>
                <div style={{ ...fieldLbl, marginBottom: 5 }}>Carpeta de guardado</div>
                <input
                  value={cfg.screenshot_save_path}
                  onChange={e => set('screenshot_save_path', e.target.value)}
                  style={inputStyle}
                />
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', gap: 8, paddingTop: 14 }}>
        {status && (
          <span style={{ fontSize: 12, color: status.startsWith('✓') ? '#34d399' : '#f87171', alignSelf: 'center' }}>
            {status}
          </span>
        )}
        <div style={{ flex: 1 }} />
        <button
          onClick={onClose}
          style={{
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)',
            borderRadius: 8, padding: '9px 16px', color: '#9ca3af', cursor: 'pointer', fontSize: 13,
          }}
        >Cancelar</button>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            background: '#4f46e5', border: 'none',
            borderRadius: 8, padding: '9px 20px', color: '#fff',
            cursor: 'pointer', fontSize: 13, fontWeight: 600,
          }}
        >{saving ? 'Guardando…' : 'Guardar'}</button>
      </div>
    </div>
  )
}
