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

// Custom styled select — hides native chrome, shows dark styled version
function StyledSelect({ value, options, onChange }: {
  value: string
  options: string[]
  onChange: (v: string) => void
}) {
  return (
    <div style={{ position: 'relative', flex: 1 }}>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          width: '100%', appearance: 'none', WebkitAppearance: 'none',
          background: 'rgba(255,255,255,0.07)',
          border: '1px solid rgba(255,255,255,0.10)',
          borderRadius: 7, padding: '5px 26px 5px 9px',
          color: '#d1d5db', fontSize: 11, cursor: 'pointer',
          outline: 'none', fontFamily: 'system-ui',
        }}
      >
        {options.map(a => (
          <option key={a} value={a}>{a}</option>
        ))}
      </select>
      <span style={{
        position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
        pointerEvents: 'none', color: '#6b7280', fontSize: 10, lineHeight: 1,
      }}>▾</span>
    </div>
  )
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

  const accent = selected.palette[0]

  return (
    <div style={{
      width: '100%', height: '100%',
      background: 'linear-gradient(160deg, rgba(13,13,26,0.99) 0%, rgba(22,18,38,0.99) 100%)',
      borderRadius: 14, fontFamily: 'system-ui', color: '#fff',
      display: 'flex', flexDirection: 'column', boxSizing: 'border-box', overflow: 'hidden',
    }}>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 16px 10px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#e5e7eb' }}>Personaje</span>
        <button onClick={onClose} style={{
          background: 'rgba(255,255,255,0.07)', border: 'none', color: '#9ca3af',
          cursor: 'pointer', width: 24, height: 24, borderRadius: 6, fontSize: 14,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>×</button>
      </div>

      {/* Character cards row */}
      <div style={{
        display: 'flex', gap: 8, padding: '10px 12px 8px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        flexShrink: 0,
      }}>
        {characters.map(char => {
          const isActive = char.id === selectedId
          const rgb = hexToRgb(char.palette[0])
          return (
            <button
              key={char.id}
              onClick={() => handleSelectChar(char)}
              style={{
                flex: 1, minWidth: 0,
                background: isActive ? `rgba(${rgb},0.15)` : 'rgba(255,255,255,0.03)',
                border: `1.5px solid ${isActive ? char.palette[0] : 'rgba(255,255,255,0.07)'}`,
                borderRadius: 12, padding: '8px 4px 6px',
                cursor: 'pointer', display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: 4,
                boxShadow: isActive ? `0 0 14px rgba(${rgb},0.22)` : 'none',
                transition: 'border-color 0.15s, background 0.15s',
              }}
            >
              <div style={{ width: 64, height: 64, pointerEvents: 'none' }}>
                <CharacterRenderer character={char} state="idle" size={64} />
              </div>
              <span style={{
                fontSize: 10, fontWeight: 700,
                color: isActive ? char.palette[0] : '#6b7280',
              }}>
                {char.name}
              </span>
            </button>
          )
        })}
      </div>

      {/* Animations — no scroll, all rows visible */}
      {selected.type === 'rive' && selected.availableAnims ? (
        <div style={{ flex: 1, padding: '12px 16px 12px', display: 'flex', flexDirection: 'column' }}>

          <div style={{
            fontSize: 10, color: '#4b5563', fontWeight: 700, letterSpacing: 1.1,
            textTransform: 'uppercase', marginBottom: 10,
          }}>
            Animaciones — <span style={{ color: accent }}>{selected.name}</span>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', paddingRight: 4 }}>
            {ALL_STATES.map(state => (
              <div key={state} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                  fontSize: 11, color: '#6b7280',
                  width: 72, flexShrink: 0, fontWeight: 500,
                }}>
                  {STATE_LABELS[state]}
                </span>
                <StyledSelect
                  value={animConfig[state] ?? ''}
                  options={selected.availableAnims!}
                  onChange={v => handleAnimChange(state, v)}
                />
              </div>
            ))}
          </div>

          <button
            onClick={() => {
              try { localStorage.removeItem(`buddy-anims-${selected.id}`) } catch {}
              setAnimConfig(loadAnimConfig(selected))
              onAnimChange?.()
            }}
            style={{
              marginTop: 10, alignSelf: 'flex-end',
              fontSize: 10, padding: '5px 12px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 6, color: '#6b7280', cursor: 'pointer',
            }}
          >
            Reset animaciones
          </button>

        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 12, color: '#4b5563' }}>Sin animaciones configurables</span>
        </div>
      )}

    </div>
  )
}
