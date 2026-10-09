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

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history])

  const handleSend = () => {
    if (thinking) return
    const text = input.trim()
    if (!text) return
    onSend(text)
    setInput('')
  }

  return (
    <div style={{
      position: 'fixed', bottom: 220, right: 20,
      width: 280, background: 'rgba(20,20,30,0.95)',
      borderRadius: 16, padding: 12, color: '#fff',
      fontFamily: 'system-ui', fontSize: 13,
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    }}>
      <button
        onClick={onClose}
        style={{ float: 'right', background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 16 }}
      >×</button>
      <div style={{ height: 160, overflowY: 'auto', marginBottom: 8 }}>
        {history.map(m => (
          <div key={m.id} style={{
            textAlign: m.role === 'user' ? 'right' : 'left',
            marginBottom: 6,
          }}>
            <span style={{
              background: m.role === 'user' ? '#4338ca' : '#1f2937',
              borderRadius: 8, padding: '4px 8px', display: 'inline-block',
            }}>
              {m.content}
            </span>
          </div>
        ))}
        {thinking && (
          <div style={{ color: '#6b7280', fontStyle: 'italic' }}>pensando...</div>
        )}
        <div ref={endRef} />
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="Escríbele a Buddy..."
          disabled={thinking}
          style={{
            flex: 1, background: '#1f2937', border: 'none', borderRadius: 8,
            padding: '6px 10px', color: '#fff', fontSize: 13, outline: 'none',
            opacity: thinking ? 0.5 : 1,
          }}
        />
        <button
          onClick={handleSend}
          disabled={thinking}
          style={{
            background: '#4338ca', border: 'none', borderRadius: 8,
            padding: '6px 10px', color: '#fff', cursor: thinking ? 'default' : 'pointer',
            opacity: thinking ? 0.5 : 1,
          }}
        >▶</button>
      </div>
    </div>
  )
}
