import { useEffect } from 'react'

interface Props {
  x: number
  y: number
  isAnchored: boolean
  onToggleAnchor: () => void
  onOpenSettings: () => void
  onOpenPicker: () => void
  onOpenSensors: () => void
  onOpenContext: () => void
  onClose: () => void
}

const itemStyle: React.CSSProperties = {
  width: '100%', background: 'none', border: 'none',
  color: '#e5e7eb', cursor: 'pointer', padding: '7px 14px',
  textAlign: 'left', fontSize: 12, fontFamily: 'system-ui',
}

const Sep = () => <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '3px 0' }} />

export function ContextMenu({ x, y, isAnchored, onToggleAnchor, onOpenSettings, onOpenPicker, onOpenSensors, onOpenContext, onClose }: Props) {
  useEffect(() => {
    const handler = () => onClose()
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const Item = ({ label, onClick }: { label: string; onClick: () => void }) => (
    <button
      style={itemStyle}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'none')}
      onClick={onClick}
    >{label}</button>
  )

  return (
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
      <Item label="Cambiar personaje…" onClick={() => { onOpenPicker(); onClose() }} />
      <Sep />
      <Item label={isAnchored ? 'Desanclar' : 'Anclar'} onClick={() => { onToggleAnchor(); onClose() }} />
      <Sep />
      <Item label="Personalidad…" onClick={() => { onOpenSettings(); onClose() }} />
      <Sep />
      <Item label="Sensores…" onClick={() => { onOpenSensors(); onClose() }} />
      <Sep />
      <Item label="Contexto…" onClick={() => { onOpenContext(); onClose() }} />
    </div>
  )
}
