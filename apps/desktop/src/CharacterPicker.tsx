import type { CharacterManifest } from '@buddy/types'

interface Props {
  characters: CharacterManifest[]
  currentId: string
  onSelect: (character: CharacterManifest) => void
  onClose: () => void
}

export function CharacterPicker({ characters, currentId, onSelect, onClose }: Props) {
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
        <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>
          Elige personaje
        </span>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '2px 4px' }}
        >×</button>
      </div>

      <div style={{
        flex: 1, overflowY: 'auto',
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
      }}>
        {characters.map(char => {
          const isActive = char.id === currentId
          return (
            <button
              key={char.id}
              onClick={() => { onSelect(char); onClose() }}
              style={{
                background: isActive ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)',
                border: `2px solid ${isActive ? char.palette[0] : 'transparent'}`,
                borderRadius: 10,
                padding: '10px 6px',
                cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                color: '#fff', fontFamily: 'system-ui', fontSize: 12,
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.07)' }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
            >
              <div style={{
                width: 48, height: 48,
                borderRadius: 8,
                background: `linear-gradient(135deg, ${char.palette[0]}, ${char.palette[1]})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 28,
              }}>
                {char.type === 'sprite' ? '🦊' : '🐱'}
              </div>
              <span style={{ color: isActive ? char.palette[0] : '#d1d5db' }}>{char.name}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
