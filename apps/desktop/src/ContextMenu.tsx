import { useEffect } from 'react'

interface Props {
  x: number
  y: number
  isAnchored: boolean
  onToggleAnchor: () => void
  onOpenSettings: () => void
  onOpenPicker: () => void
  onClose: () => void
}

const item: React.CSSProperties = {
  width: '100%', background: 'none', border: 'none',
  color: '#e5e7eb', cursor: 'pointer', padding: '7px 14px',
  textAlign: 'left', fontSize: 13, fontFamily: 'system-ui',
}

export function ContextMenu({ x, y, isAnchored, onToggleAnchor, onOpenSettings, onOpenPicker, onClose }: Props) {
  useEffect(() => {
    const close = () => onClose()
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [onClose])

  return (
    <div
      onMouseDown={e => e.stopPropagation()}
      style={{
        position: 'absolute', left: x, top: y, zIndex: 100,
        background: 'rgba(15,15,25,0.97)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 8, padding: '4px 0', minWidth: 148,
        boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
        fontFamily: 'system-ui',
      }}
    >
      <button
        style={item}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
        onClick={() => { onOpenPicker(); onClose() }}
      >
        Cambiar personaje…
      </button>
      <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '3px 0' }} />
      <button
        style={item}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
        onClick={() => { onToggleAnchor(); onClose() }}
      >
        {isAnchored ? 'Desanclar' : 'Anclar'}
      </button>
      <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '3px 0' }} />
      <button
        style={item}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
        onClick={() => { onOpenSettings(); onClose() }}
      >
        Personalidad…
      </button>
    </div>
  )
}
