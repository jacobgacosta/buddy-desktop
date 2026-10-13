import { useState, useRef, useEffect } from 'react'
import type { Message } from '@buddy/types'

interface Props {
  history: Message[]
  thinking: boolean
  onSend: (text: string) => void
  onClose: () => void
}

export function ChatBubble({ history, thinking, onSend, onClose }: Props) {
  const [input, setInput] = useState('')
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history, thinking])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSend = () => {
    if (thinking) return
    const text = input.trim()
    if (!text) return
    onSend(text)
    setInput('')
  }

  return (
    <div style={{
      width: '100%', height: '100%',
      background: 'linear-gradient(160deg, rgba(14,14,26,0.97) 0%, rgba(20,16,36,0.97) 100%)',
      borderRadius: 14,
      border: '1px solid rgba(255,255,255,0.08)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      display: 'flex', flexDirection: 'column',
      fontFamily: 'system-ui',
      boxSizing: 'border-box',
      overflow: 'hidden',
    }}>
      {/* header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 12px 8px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, letterSpacing: 0.4 }}>CHAT</span>
        <button onClick={onClose} style={{
          background: 'rgba(255,255,255,0.07)', border: 'none',
          color: '#9ca3af', cursor: 'pointer', fontSize: 13,
          width: 20, height: 20, borderRadius: 5,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>×</button>
      </div>

      {/* messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 10px 4px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {history.length === 0 && (
          <div style={{ color: '#4b5563', fontSize: 12, textAlign: 'center', marginTop: 20 }}>
            Escríbeme algo 👋
          </div>
        )}
        {history.map(m => (
          <div key={m.id} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <span style={{
              background: m.role === 'user' ? '#4338ca' : 'rgba(255,255,255,0.07)',
              color: '#e5e7eb',
              borderRadius: m.role === 'user' ? '10px 10px 2px 10px' : '10px 10px 10px 2px',
              padding: '6px 10px',
              fontSize: 12,
              maxWidth: '85%',
              lineHeight: 1.4,
            }}>
              {m.content}
            </span>
          </div>
        ))}
        {thinking && (
          <div style={{ display: 'flex', gap: 3, padding: '4px 6px' }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                width: 5, height: 5, borderRadius: '50%',
                background: '#4b5563',
                animation: `pulse 1s ease-in-out ${i * 0.2}s infinite`,
              }} />
            ))}
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* input */}
      <div style={{ padding: '8px 10px', borderTop: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Escribe aquí..."
            disabled={thinking}
            style={{
              flex: 1, background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8, padding: '6px 10px',
              color: '#e5e7eb', fontSize: 12, outline: 'none',
              opacity: thinking ? 0.5 : 1,
              fontFamily: 'system-ui',
            }}
          />
          <button
            onClick={handleSend}
            disabled={thinking}
            style={{
              background: '#4338ca', border: 'none', borderRadius: 8,
              padding: '6px 10px', color: '#fff',
              cursor: thinking ? 'default' : 'pointer',
              opacity: thinking ? 0.5 : 1, fontSize: 13,
              flexShrink: 0,
            }}
          >▶</button>
        </div>
      </div>
    </div>
  )
}
