interface Props {
  x: number
  y: number
  isAnchored: boolean
  onToggleAnchor: () => void
  onOpenSettings: () => void
  onOpenPicker: () => void
  onOpenSensors: () => void
  onClose: () => void
}

const itemStyle: React.CSSProperties = {
  width: '100%', background: 'none', border: 'none',
  color: '#e5e7eb', cursor: 'pointer', padding: '7px 14px',
  textAlign: 'left', fontSize: 12, fontFamily: 'system-ui',
}

export function ContextMenu({ x, y, isAnchored, onToggleAnchor, onOpenSettings, onOpenPicker, onOpenSensors, onClose }: Props) {
  return (
    <>
      {/* backdrop — click anywhere outside menu to close */}
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 998 }}
        onMouseDown={onClose}
      />
      <div
        onMouseDown={e => e.stopPropagation()}
        style={{
          position: 'absolute', left: x, top: y, zIndex: 999,
          background: 'rgba(12,12,22,0.97)',
          border: '1px solid rgba(255,255,255,0.09)',
          borderRadius: 10, padding: '4px 0', minWidth: 170,
          boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
          fontFamily: 'system-ui',
        }}
      >
        <button
          style={itemStyle}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          onClick={() => { onOpenPicker(); onClose() }}
        >
          Cambiar personaje…
        </button>
        <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '3px 0' }} />
        <button
          style={itemStyle}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          onClick={() => { onToggleAnchor(); onClose() }}
        >
          {isAnchored ? 'Desanclar' : 'Anclar'}
        </button>
        <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '3px 0' }} />
        <button
          style={itemStyle}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          onClick={() => { onOpenSettings(); onClose() }}
        >
          Personalidad…
        </button>
        <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '3px 0' }} />
        <button
          style={{ ...itemStyle, color: '#9ca3af' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          onClick={() => { onOpenSensors(); onClose() }}
        >
          Sensores…
        </button>
      </div>
    </>
  )
}
