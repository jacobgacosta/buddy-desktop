import { useState } from 'react'
import { CharacterRenderer } from '@buddy/renderer'
import type { AvatarState, CharacterManifest } from '@buddy/types'
import { STATE_LABELS, ALL_STATES, loadAnimConfig, saveAnimConfig } from './characters/animConfig'

interface Props {
  characters: CharacterManifest[]
  currentId: string
  onSelect: (character: CharacterManifest) => void
  onAnimChange?: () => void
  onClose: () => void
}

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r},${g},${b}`
}

export function CharacterPicker({ characters, currentId, onSelect, onAnimChange, onClose }: Props) {
  const [selectedId, setSelectedId] = useState(currentId)
  const selected = characters.find(c => c.id === selectedId) ?? characters[0]
  const [animConfig, setAnimConfig] = useState<Record<AvatarState, string>>(
    () => loadAnimConfig(selected)
  )

  const handleSelectChar = (char: CharacterManifest) => {
    setSelectedId(char.id)
    setAnimConfig(loadAnimConfig(char))
    onSelect(char)
  }

  const handleAnimChange = (state: AvatarState, anim: string) => {
    const next = { ...animConfig, [state]: anim }
    setAnimConfig(next)
    saveAnimConfig(selected.id, next)
    onAnimChange?.()
  }

  return (
    <div style={{
      width: '100%', height: '100%',
      background: 'linear-gradient(160deg, rgba(15,15,28,0.98) 0%, rgba(25,18,40,0.98) 100%)',
      borderRadius: 14,
      display: 'flex', flexDirection: 'column',
      fontFamily: 'system-ui',
      boxSizing: 'border-box',
      overflow: 'hidden',
    }}>
      {/* header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '9px 12px 8px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, letterSpacing: 0.4 }}>PERSONAJE</span>
        <button onClick={onClose} style={{
          background: 'rgba(255,255,255,0.07)', border: 'none', color: '#9ca3af',
          cursor: 'pointer', fontSize: 13, width: 20, height: 20, borderRadius: 5,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>×</button>
      </div>

      {/* character cards */}
      <div style={{
        display: 'flex', gap: 8, padding: '6px 10px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        flexShrink: 0,
      }}>
        {characters.map(char => {
          const isActive = char.id === selectedId
          const accent = char.palette[0]
          return (
            <button
              key={char.id}
              onClick={() => handleSelectChar(char)}
              style={{
                flex: 1,
                background: isActive ? `rgba(${hexToRgb(accent)},0.15)` : 'rgba(255,255,255,0.03)',
                border: `1.5px solid ${isActive ? accent : 'rgba(255,255,255,0.07)'}`,
                borderRadius: 10, padding: '4px 4px 3px',
                cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                boxShadow: isActive ? `0 0 10px rgba(${hexToRgb(accent)},0.2)` : 'none',
              }}
            >
              <div style={{ width: 52, height: 52, pointerEvents: 'none' }}>
                <CharacterRenderer character={char} state="idle" size={52} />
              </div>
              <span style={{ fontSize: 9, fontWeight: 600, color: isActive ? accent : '#6b7280' }}>
                {char.name}
              </span>
            </button>
          )
        })}
      </div>

      {/* animation states — compact, no scroll */}
      {selected.type === 'rive' && selected.availableAnims && (
        <div style={{ flex: 1, padding: '8px 10px 6px', display: 'flex', flexDirection: 'column', gap: 5 }}>
          {ALL_STATES.map(state => (
            <div key={state} style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
              <span style={{ fontSize: 10, color: '#6b7280', width: 62, flexShrink: 0, fontWeight: 500 }}>
                {STATE_LABELS[state]}
              </span>
              <select
                value={animConfig[state] ?? ''}
                onChange={e => handleAnimChange(state, e.target.value)}
                style={{
                  flex: 1, fontSize: 10, padding: '2px 5px',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 5, color: '#e5e7eb', cursor: 'pointer',
                  outline: 'none', height: 22,
                }}
              >
                {selected.availableAnims!.map(a => (
                  <option key={a} value={a} style={{ background: '#1a1a2e' }}>{a}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
