import { useState } from 'react'

interface Props {
  avatarName: string
  avatarPersonality: string
  onSave: (name: string, personality: string) => void
  onClose: () => void
}

const dark = '#1f2937'

export function SettingsPanel({ avatarName, avatarPersonality, onSave, onClose }: Props) {
  const [name, setName] = useState(avatarName)
  const [personality, setPersonality] = useState(avatarPersonality)

  return (
    <div style={{
      width: '100%', height: '100%',
      background: 'rgba(20,20,30,0.95)',
      borderRadius: 16, padding: 12, color: '#fff',
      fontFamily: 'system-ui', fontSize: 13,
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      display: 'flex', flexDirection: 'column',
      boxSizing: 'border-box',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>Personalidad</span>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '2px 4px' }}
        >×</button>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ color: '#d1d5db', fontSize: 11 }}>Nombre</span>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            style={{ background: dark, border: 'none', borderRadius: 8, padding: '6px 10px', color: '#fff', fontSize: 13, outline: 'none' }}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
          <span style={{ color: '#d1d5db', fontSize: 11 }}>Personalidad</span>
          <textarea
            value={personality}
            onChange={e => setPersonality(e.target.value)}
            style={{ background: dark, border: 'none', borderRadius: 8, padding: '6px 10px', color: '#fff', fontSize: 12, outline: 'none', resize: 'none', flex: 1, minHeight: 80, fontFamily: 'system-ui' }}
          />
        </label>
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <button
          onClick={onClose}
          style={{ flex: 1, background: dark, border: 'none', borderRadius: 8, padding: '6px 10px', color: '#9ca3af', cursor: 'pointer', fontSize: 13 }}
        >Cancelar</button>
        <button
          onClick={() => { onSave(name.trim() || avatarName, personality.trim() || avatarPersonality); onClose() }}
          style={{ flex: 1, background: '#4338ca', border: 'none', borderRadius: 8, padding: '6px 10px', color: '#fff', cursor: 'pointer', fontSize: 13 }}
        >Guardar</button>
      </div>
    </div>
  )
}
