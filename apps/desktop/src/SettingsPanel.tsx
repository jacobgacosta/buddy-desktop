import { useState } from 'react'

interface Props {
  avatarName: string
  avatarPersonality: string
  textEnabled: boolean
  voiceEnabled: boolean
  ttsVolume: number
  onSave: (name: string, personality: string) => void
  onToggleText: (v: boolean) => void
  onToggleVoice: (v: boolean) => void
  onVolumeChange: (v: number) => void
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

export function SettingsPanel({
  avatarName, avatarPersonality, textEnabled, voiceEnabled, ttsVolume,
  onSave, onToggleText, onToggleVoice, onVolumeChange, onClose,
}: Props) {
  const [name, setName] = useState(avatarName)
  const [personality, setPersonality] = useState(avatarPersonality)

  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.09)', borderRadius: 8,
    padding: '8px 10px', color: '#e5e7eb', fontSize: 13,
    outline: 'none', boxSizing: 'border-box',
  }

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
        <span style={{ fontSize: 13, fontWeight: 700, color: '#e5e7eb' }}>Personalidad</span>
        <button onClick={onClose} style={{
          background: 'rgba(255,255,255,0.07)', border: 'none', color: '#9ca3af',
          cursor: 'pointer', width: 24, height: 24, borderRadius: 6, fontSize: 14,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>×</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20, paddingRight: 4, paddingBottom: 20 }}>

        {/* Identity */}
        <section>
          <div style={sectionTitle}>Identidad</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <div style={{ ...fieldLbl, marginBottom: 5 }}>Nombre</div>
              <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <div style={{ ...fieldLbl, marginBottom: 5 }}>Personalidad</div>
              <textarea
                value={personality}
                onChange={e => setPersonality(e.target.value)}
                rows={4}
                style={{
                  ...inputStyle,
                  resize: 'none', fontFamily: 'system-ui', lineHeight: 1.55,
                }}
              />
            </div>
          </div>
        </section>

        {/* Voice */}
        <section>
          <div style={sectionTitle}>Respuestas del avatar</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            <div style={row}>
              <span style={fieldLbl}>Hablar en voz alta</span>
              <Toggle checked={voiceEnabled} onChange={onToggleVoice} />
            </div>

            <div style={row}>
              <span style={fieldLbl}>Mostrar texto</span>
              <Toggle checked={textEnabled} onChange={onToggleText} />
            </div>

            <div>
              <div style={{ ...row, marginBottom: 8 }}>
                <span style={fieldLbl}>Volumen de voz</span>
                <span style={{
                  fontSize: 12, color: voiceEnabled ? '#6366f1' : '#4b5563',
                  fontVariantNumeric: 'tabular-nums', fontWeight: 600,
                }}>
                  {Math.round(ttsVolume * 100)}%
                </span>
              </div>
              <input
                type="range" min={0} max={100}
                value={Math.round(ttsVolume * 100)}
                onChange={e => onVolumeChange(Number(e.target.value) / 100)}
                disabled={!voiceEnabled}
                style={{
                  width: '100%', accentColor: '#6366f1', cursor: voiceEnabled ? 'pointer' : 'default',
                  opacity: voiceEnabled ? 1 : 0.3, height: 4,
                }}
              />
            </div>

          </div>
        </section>


      </div>

      {/* Footer */}
      <div style={{ display: 'flex', gap: 8, paddingTop: 14 }}>
        <button
          onClick={onClose}
          style={{
            flex: 1, background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.09)',
            borderRadius: 8, padding: '9px 0', color: '#9ca3af', cursor: 'pointer', fontSize: 13,
          }}
        >Cancelar</button>
        <button
          onClick={() => { onSave(name.trim() || avatarName, personality.trim() || avatarPersonality); onClose() }}
          style={{
            flex: 2, background: '#4f46e5', border: 'none',
            borderRadius: 8, padding: '9px 0', color: '#fff',
            cursor: 'pointer', fontSize: 13, fontWeight: 600,
          }}
        >Guardar</button>
      </div>

    </div>
  )
}
