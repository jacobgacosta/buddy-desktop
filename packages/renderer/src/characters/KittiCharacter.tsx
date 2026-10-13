import type React from 'react'
import type { AvatarState } from '@buddy/types'

interface Props {
  state: AvatarState
  size: number
  palette: [string, string]
  onStateComplete?: () => void
}

const CSS = `
@keyframes kc-breathe {
  0%,100%{ transform:scaleX(1) scaleY(1) translateY(0); }
  45%    { transform:scaleX(0.98) scaleY(1.04) translateY(-2px); }
}
@keyframes kc-walk {
  0%   { transform:translateY(0) scaleX(1) scaleY(1); }
  20%  { transform:translateY(-4px) scaleX(0.97) scaleY(1.04); }
  45%  { transform:translateY(-9px) scaleX(0.93) scaleY(1.09); }
  70%  { transform:translateY(-4px) scaleX(0.97) scaleY(1.04); }
  85%  { transform:translateY(0) scaleX(1.07) scaleY(0.92); }
  100% { transform:translateY(0) scaleX(1) scaleY(1); }
}
@keyframes kc-happy {
  0%   { transform:translateY(0)     scaleX(1)    scaleY(1);   }
  8%   { transform:translateY(0)     scaleX(1.1)  scaleY(0.87); }
  22%  { transform:translateY(-18px) scaleX(0.87) scaleY(1.2); }
  42%  { transform:translateY(-26px) scaleX(0.84) scaleY(1.26) rotate(9deg); }
  60%  { transform:translateY(-14px) scaleX(0.88) scaleY(1.18) rotate(-5deg); }
  78%  { transform:translateY(0)     scaleX(1.13) scaleY(0.85); }
  88%  { transform:translateY(-5px)  scaleX(0.95) scaleY(1.05); }
  100% { transform:translateY(0)     scaleX(1)    scaleY(1);   }
}
@keyframes kc-sleep {
  0%,100%{ transform:rotate(0deg) translateY(0) scale(1); }
  50%    { transform:rotate(-5deg) translateY(3px) scale(0.97); }
}
@keyframes kc-think {
  0%,100%{ transform:rotate(-9deg) translateX(-1px); }
  50%    { transform:rotate(9deg) translateX(1px); }
}
@keyframes kc-talk {
  0%,100%{ transform:translateY(0) rotate(0deg); }
  25%    { transform:translateY(-2px) rotate(-3deg); }
  75%    { transform:translateY(-2px) rotate(2deg); }
}
@keyframes kc-jaw {
  0%,100%{ transform:scaleY(1) translateY(0); }
  50%    { transform:scaleY(3.2) translateY(3px); }
}
@keyframes kc-zzz {
  0%   { opacity:0; transform:translate(0,0) scale(0.4) rotate(-8deg); }
  20%  { opacity:1; }
  100% { opacity:0; transform:translate(16px,-26px) scale(1.1) rotate(8deg); }
}
@keyframes kc-zzz2 {
  0%,38%{ opacity:0; transform:translate(0,0) scale(0.4) rotate(8deg); }
  60%   { opacity:1; }
  100%  { opacity:0; transform:translate(20px,-24px) scale(1.2) rotate(-8deg); }
}
@keyframes kc-dot {
  0%,100%{ transform:scale(1); opacity:0.9; }
  50%    { transform:scale(1.35); opacity:0.35; }
}
@keyframes kc-tail {
  0%,100%{ transform:rotate(0deg); }
  50%    { transform:rotate(14deg); }
}
`

let injected = false
function ensureCSS() {
  if (injected || typeof document === 'undefined') return
  injected = true
  const s = document.createElement('style')
  s.textContent = CSS
  document.head.appendChild(s)
}

const S = { transformBox: 'fill-box', transformOrigin: 'center' } as React.CSSProperties

export function KittiCharacter({ state, size, palette, onStateComplete }: Props) {
  ensureCSS()

  const c0 = palette[0]
  const c1 = palette[1]
  const D  = '#1e1030'

  const rootAnim = {
    idle:        'kc-breathe 2.4s ease-in-out infinite',
    walk:        'kc-walk 0.52s ease-in-out infinite',
    talk:        'kc-talk 0.38s ease-in-out infinite',
    think:       'kc-breathe 2.2s ease-in-out infinite',
    react_happy: 'kc-happy 0.95s ease-in-out 1 forwards',
    sleep:       'kc-sleep 3.2s ease-in-out infinite',
  }[state]

  const headAnim  = state === 'think' ? 'kc-think 1.5s ease-in-out infinite' : undefined
  const jawAnim   = state === 'talk'  ? 'kc-jaw   0.3s ease-in-out infinite' : undefined
  const tailAnim  = (state === 'idle' || state === 'walk')
    ? 'kc-tail 1.6s ease-in-out infinite' : undefined

  const eyes = () => {
    if (state === 'sleep') return (
      <>
        <path d="M 43 50 Q 50 56 57 50" stroke={D} strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <path d="M 63 50 Q 70 56 77 50" stroke={D} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      </>
    )
    if (state === 'react_happy') return (
      <>
        <path d="M 43 52 Q 50 44 57 52" stroke={D} strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <path d="M 63 52 Q 70 44 77 52" stroke={D} strokeWidth="2.5" fill="none" strokeLinecap="round" />
        {/* blush */}
        <ellipse cx="43" cy="57" rx="6" ry="3.5" fill="#f9a8d4" opacity="0.55" />
        <ellipse cx="77" cy="57" rx="6" ry="3.5" fill="#f9a8d4" opacity="0.55" />
      </>
    )
    return (
      <>
        <ellipse cx="50" cy="50" rx="9" ry="10" fill="white" />
        <ellipse cx="70" cy="50" rx="9" ry="10" fill="white" />
        <ellipse cx="50.5" cy="51" rx="5.5" ry="7"  fill="#4c1d95" />
        <ellipse cx="70.5" cy="51" rx="5.5" ry="7"  fill="#4c1d95" />
        <ellipse cx="51"   cy="52" rx="3.5" ry="5"  fill={D} />
        <ellipse cx="71"   cy="52" rx="3.5" ry="5"  fill={D} />
        <circle  cx="53.5" cy="48.5" r="2.2" fill="white" />
        <circle  cx="73.5" cy="48.5" r="2.2" fill="white" />
        <circle  cx="50.5" cy="55"   r="1"   fill="white" opacity="0.5" />
        <circle  cx="70.5" cy="55"   r="1"   fill="white" opacity="0.5" />
      </>
    )
  }

  return (
    <svg width={size} height={size} viewBox="0 0 120 120" style={{ overflow: 'visible' }}
      onAnimationEnd={state === 'react_happy' && onStateComplete
        ? (e) => { if ((e as unknown as AnimationEvent).animationName === 'kc-happy') onStateComplete() }
        : undefined}
    >
      <defs>
        <radialGradient id="kc-hg" cx="40%" cy="36%" r="68%">
          <stop offset="0%"   stopColor={c1} />
          <stop offset="100%" stopColor={c0} />
        </radialGradient>
        <radialGradient id="kc-bg" cx="42%" cy="32%" r="65%">
          <stop offset="0%"   stopColor={c1} />
          <stop offset="100%" stopColor={c0} />
        </radialGradient>
        <radialGradient id="kc-eg" cx="30%" cy="25%" r="70%">
          <stop offset="0%"   stopColor="#ffffff" />
          <stop offset="100%" stopColor="#ede9fe" />
        </radialGradient>
      </defs>

      <g style={{ ...S, transformOrigin: '60px 64px', animation: rootAnim }}>

        {/* tail */}
        <g style={{ ...S, transformOrigin: '76px 90px', animation: tailAnim }}>
          <path
            d="M 76,90 C 98,82 112,60 104,42 C 99,28 84,28 83,43 C 82,53 93,58 90,67 C 88,75 80,75 77,83"
            fill="none" stroke={c0} strokeWidth="11" strokeLinecap="round"
          />
          <circle cx="90" cy="42" r="10" fill={c1} />
          <circle cx="90" cy="42" r="6"  fill={c0} opacity="0.3" />
        </g>

        {/* body */}
        <ellipse cx="60" cy="94" rx="25" ry="20" fill="url(#kc-bg)" />
        <ellipse cx="60" cy="92" rx="15" ry="12" fill={c1} opacity="0.45" />

        {/* head group */}
        <g style={{ ...S, transformOrigin: '60px 53px', animation: headAnim }}>

          {/* ears with bezier curves */}
          <path d="M 32,37 Q 27,13 44,9  Q 56,11 54,37 Z" fill={c0} />
          <path d="M 66,37 Q 64,11 76,9  Q 93,13 88,37 Z" fill={c0} />
          <path d="M 34,36 Q 30,17 44,13 Q 53,14 52,36 Z" fill={c1} opacity="0.75" />
          <path d="M 68,36 Q 67,14 76,13 Q 90,17 86,36 Z" fill={c1} opacity="0.75" />

          {/* head */}
          <circle cx="60" cy="53" r="30" fill="url(#kc-hg)" />

          {eyes()}

          {/* nose */}
          <ellipse cx="60" cy="61" rx="4.5" ry="3.5" fill="#f9a8d4" />
          <ellipse cx="60" cy="60" rx="2"   ry="1.5" fill="#e879a0" />

          {/* whiskers */}
          <line x1="26" y1="61" x2="52" y2="62" stroke="white" strokeWidth="1.3" opacity="0.55" strokeLinecap="round" />
          <line x1="26" y1="65" x2="52" y2="64" stroke="white" strokeWidth="1.3" opacity="0.55" strokeLinecap="round" />
          <line x1="26" y1="69" x2="51" y2="67" stroke="white" strokeWidth="1.3" opacity="0.55" strokeLinecap="round" />
          <line x1="68" y1="62" x2="94" y2="61" stroke="white" strokeWidth="1.3" opacity="0.55" strokeLinecap="round" />
          <line x1="68" y1="64" x2="94" y2="65" stroke="white" strokeWidth="1.3" opacity="0.55" strokeLinecap="round" />
          <line x1="69" y1="67" x2="94" y2="69" stroke="white" strokeWidth="1.3" opacity="0.55" strokeLinecap="round" />

          {/* mouth */}
          <g style={{ ...S, transformOrigin: '60px 67px', animation: jawAnim }}>
            <path d="M 55 67 Q 60 72 65 67" stroke={D} strokeWidth="2" fill="none" strokeLinecap="round" />
          </g>

          {/* think bubbles */}
          {state === 'think' && (
            <>
              <circle cx="78" cy="31" r="5"   fill="white" opacity="0.9" style={{ ...S, animation: 'kc-dot 1s ease-in-out infinite' }} />
              <circle cx="88" cy="22" r="6.5" fill="white" opacity="0.9" style={{ ...S, animation: 'kc-dot 1s ease-in-out infinite 0.3s' }} />
              <circle cx="100" cy="11" r="9"  fill="white" opacity="0.9" style={{ ...S, animation: 'kc-dot 1s ease-in-out infinite 0.6s' }} />
            </>
          )}
        </g>

        {/* zzz */}
        {state === 'sleep' && (
          <>
            <text x="76" y="38" fontSize="11" fill={c1} fontWeight="bold" fontFamily="system-ui,sans-serif"
              style={{ animation: 'kc-zzz 2.4s ease-in-out infinite' }}>Z</text>
            <text x="83" y="25" fontSize="16" fill={c1} fontWeight="bold" fontFamily="system-ui,sans-serif"
              style={{ animation: 'kc-zzz2 2.4s ease-in-out infinite' }}>Z</text>
          </>
        )}

      </g>
    </svg>
  )
}
