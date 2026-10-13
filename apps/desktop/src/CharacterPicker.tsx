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
      borderRadius: 16,
      display: 'flex', flexDirection: 'column',
      fontFamily: 'system-ui',
      boxSizing: 'border-box',
      overflow: 'hidden',
    }}>
      {/* header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 14px 10px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        flexShrink: 0,
      }}>
        <span style={{ color: '#fff', fontSize: 12, fontWeight: 600 }}>Companion</span>
        <button onClick={onClose} style={{
          background: 'rgba(255,255,255,0.08)', border: 'none', color: '#9ca3af',
          cursor: 'pointer', fontSize: 14, width: 22, height: 22, borderRadius: 5,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>×</button>
      </div>

      {/* character row */}
      <div style={{
        display: 'flex', gap: 8, padding: '10px 12px',
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
                background: isActive
                  ? `rgba(${hexToRgb(accent)},0.15)`
                  : 'rgba(255,255,255,0.03)',
                border: `1.5px solid ${isActive ? accent : 'rgba(255,255,255,0.07)'}`,
                borderRadius: 10, padding: '6px 4px',
                cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                boxShadow: isActive ? `0 0 12px rgba(${hexToRgb(accent)},0.25)` : 'none',
              }}
            >
              <div style={{ width: 64, height: 64, pointerEvents: 'none' }}>
                <CharacterRenderer character={char} state="idle" size={64} />
              </div>
              <span style={{ fontSize: 10, fontWeight: 600, color: isActive ? accent : '#9ca3af' }}>
                {char.name}
              </span>
            </button>
          )
        })}
      </div>

      {/* animation config — only for rive characters */}
      {selected.type === 'rive' && selected.availableAnims && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px 10px' }}>
          <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8 }}>
            Animaciones
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {ALL_STATES.map(state => (
              <div key={state} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, color: '#9ca3af', width: 70, flexShrink: 0 }}>
                  {STATE_LABELS[state]}
                </span>
                <select
                  value={animConfig[state] ?? ''}
                  onChange={e => handleAnimChange(state, e.target.value)}
                  style={{
                    flex: 1, fontSize: 11, padding: '3px 6px',
                    background: 'rgba(255,255,255,0.07)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 6, color: '#e5e7eb', cursor: 'pointer',
                    outline: 'none',
                  }}
                >
                  {selected.availableAnims!.map(a => (
                    <option key={a} value={a} style={{ background: '#1a1a2e' }}>{a}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
