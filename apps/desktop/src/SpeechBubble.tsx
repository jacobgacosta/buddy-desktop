import { useEffect, useRef, useState } from 'react'

interface Props {
  text: string
  onDone: () => void
}

export function SpeechBubble({ text, onDone }: Props) {
  const [displayed, setDisplayed] = useState('')
  const [fading, setFading] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onDoneRef = useRef(onDone)

  useEffect(() => {
    onDoneRef.current = onDone
  }, [onDone])

  useEffect(() => {
    setDisplayed('')
    setFading(false)
    if (timerRef.current) clearTimeout(timerRef.current)

    let i = 0
    const interval = setInterval(() => {
      i++
      setDisplayed(text.slice(0, i))
      if (i >= text.length) {
        clearInterval(interval)
        const holdMs = Math.min(6000, Math.max(2000, text.length * 40))
        timerRef.current = setTimeout(() => {
          setFading(true)
          timerRef.current = setTimeout(onDoneRef.current, 400)
        }, holdMs)
      }
    }, 30)

    return () => {
      clearInterval(interval)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [text])

  return (
    <div style={{
      position: 'relative',
      marginTop: 8,
      maxWidth: 220,
      background: 'rgba(14,14,26,0.95)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 14,
      padding: '8px 12px',
      color: '#e5e7eb',
      fontSize: 13,
      fontFamily: 'system-ui',
      lineHeight: 1.4,
      boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
      opacity: fading ? 0 : 1,
      transition: 'opacity 0.4s ease',
      pointerEvents: 'none',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
    }}>
      {/* arrow pointing up toward avatar */}
      <div style={{
        position: 'absolute',
        top: -7,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 0,
        height: 0,
        borderLeft: '7px solid transparent',
        borderRight: '7px solid transparent',
        borderBottom: '7px solid rgba(14,14,26,0.95)',
        pointerEvents: 'none',
      }} />
      {displayed}
    </div>
  )
}
