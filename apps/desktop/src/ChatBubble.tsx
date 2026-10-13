import { useState, useRef, useEffect } from 'react'
import type { Message } from '@buddy/types'

interface Props {
  history: Message[]
  thinking: boolean
  onSend: (text: string) => void
  onClose: () => void
  avatarName: string
  avatarPersonality: string
  onSaveConfig: (name: string, personality: string) => void
}

const dark = '#1f2937'
const btnBase: React.CSSProperties = {
  background: 'none', border: 'none', color: '#9ca3af',
  cursor: 'pointer', lineHeight: 1, padding: '2px 4px',
}

export function ChatBubble({ history, thinking, onSend, onClose, avatarName, avatarPersonality, onSaveConfig }: Props) {
  const [input, setInput] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [nameInput, setNameInput] = useState(avatarName)
  const [personalityInput, setPersonalityInput] = useState(avatarPersonality)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history])

  useEffect(() => {
    if (!showSettings) {
      setNameInput(avatarName)
      setPersonalityInput(avatarPersonality)
    }
  }, [avatarName, avatarPersonality, showSettings])

  const handleSend = () => {
    if (thinking) return
    const text = input.trim()
    if (!text) return
    onSend(text)
    setInput('')
  }

  const container: React.CSSProperties = {
    width: '100%', height: '100%',
    background: 'rgba(20,20,30,0.95)',
    borderRadius: 16, padding: 12, color: '#fff',
    fontFamily: 'system-ui', fontSize: 13,
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    display: 'flex', flexDirection: 'column',
    boxSizing: 'border-box',
  }

  if (showSettings) {
    return (
      <div style={container}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>Personalidad</span>
          <button onClick={() => setShowSettings(false)} style={{ ...btnBase, fontSize: 16 }}>×</button>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ color: '#d1d5db', fontSize: 11 }}>Nombre</span>
            <input
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              style={{ background: dark, border: 'none', borderRadius: 8, padding: '6px 10px', color: '#fff', fontSize: 13, outline: 'none' }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
            <span style={{ color: '#d1d5db', fontSize: 11 }}>Personalidad</span>
            <textarea
              value={personalityInput}
              onChange={e => setPersonalityInput(e.target.value)}
              style={{ background: dark, border: 'none', borderRadius: 8, padding: '6px 10px', color: '#fff', fontSize: 12, outline: 'none', resize: 'none', flex: 1, minHeight: 80, fontFamily: 'system-ui' }}
            />
          </label>
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <button
            onClick={() => setShowSettings(false)}
            style={{ flex: 1, background: dark, border: 'none', borderRadius: 8, padding: '6px 10px', color: '#9ca3af', cursor: 'pointer', fontSize: 13 }}
          >Cancelar</button>
          <button
            onClick={() => { onSaveConfig(nameInput.trim() || avatarName, personalityInput.trim() || avatarPersonality); setShowSettings(false) }}
            style={{ flex: 1, background: '#4338ca', border: 'none', borderRadius: 8, padding: '6px 10px', color: '#fff', cursor: 'pointer', fontSize: 13 }}
          >Guardar</button>
        </div>
      </div>
    )
  }

  return (
    <div style={container}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4, marginBottom: 4 }}>
        <button onClick={() => setShowSettings(true)} style={{ ...btnBase, fontSize: 14 }} title="Personalidad">⚙</button>
        <button onClick={onClose} style={{ ...btnBase, fontSize: 16 }}>×</button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', marginBottom: 8 }}>
        {history.map(m => (
          <div key={m.id} style={{ textAlign: m.role === 'user' ? 'right' : 'left', marginBottom: 6 }}>
            <span style={{ background: m.role === 'user' ? '#4338ca' : dark, borderRadius: 8, padding: '4px 8px', display: 'inline-block' }}>
              {m.content}
            </span>
          </div>
        ))}
        {thinking && <div style={{ color: '#6b7280', fontStyle: 'italic' }}>pensando...</div>}
        <div ref={endRef} />
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="Escríbele a Buddy..."
          disabled={thinking}
          style={{ flex: 1, background: dark, border: 'none', borderRadius: 8, padding: '6px 10px', color: '#fff', fontSize: 13, outline: 'none', opacity: thinking ? 0.5 : 1 }}
        />
        <button
          onClick={handleSend}
          disabled={thinking}
          style={{ background: '#4338ca', border: 'none', borderRadius: 8, padding: '6px 10px', color: '#fff', cursor: thinking ? 'default' : 'pointer', opacity: thinking ? 0.5 : 1 }}
        >▶</button>
      </div>
    </div>
  )
}
