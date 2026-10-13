import type React from 'react'
import type { AvatarState } from '@buddy/types'

interface Props {
  state: AvatarState
  size: number
  palette: [string, string]
  onStateComplete?: () => void
}

const CSS = `
@keyframes fx-breathe {
  0%,100%{ transform:scaleX(1) scaleY(1) translateY(0); }
  45%    { transform:scaleX(0.98) scaleY(1.04) translateY(-2px); }
}
@keyframes fx-walk {
  0%   { transform:translateY(0) scaleX(1) scaleY(1); }
  20%  { transform:translateY(-4px) scaleX(0.97) scaleY(1.04); }
  45%  { transform:translateY(-9px) scaleX(0.93) scaleY(1.09); }
  70%  { transform:translateY(-4px) scaleX(0.97) scaleY(1.04); }
  85%  { transform:translateY(0) scaleX(1.07) scaleY(0.92); }
  100% { transform:translateY(0) scaleX(1) scaleY(1); }
}
@keyframes fx-happy {
  0%   { transform:translateY(0)     scaleX(1)    scaleY(1);   }
  8%   { transform:translateY(0)     scaleX(1.1)  scaleY(0.87); }
  22%  { transform:translateY(-18px) scaleX(0.87) scaleY(1.2); }
  42%  { transform:translateY(-26px) scaleX(0.84) scaleY(1.26) rotate(9deg); }
  60%  { transform:translateY(-14px) scaleX(0.88) scaleY(1.18) rotate(-5deg); }
  78%  { transform:translateY(0)     scaleX(1.13) scaleY(0.85); }
  88%  { transform:translateY(-5px)  scaleX(0.95) scaleY(1.05); }
  100% { transform:translateY(0)     scaleX(1)    scaleY(1);   }
}
@keyframes fx-sleep {
  0%,100%{ transform:rotate(0deg) translateY(0) scale(1); }
  50%    { transform:rotate(-5deg) translateY(3px) scale(0.97); }
}
@keyframes fx-think {
  0%,100%{ transform:rotate(-9deg) translateX(-1px); }
  50%    { transform:rotate(9deg) translateX(1px); }
}
@keyframes fx-talk {
  0%,100%{ transform:translateY(0) rotate(0deg); }
  25%    { transform:translateY(-2px) rotate(-3deg); }
  75%    { transform:translateY(-2px) rotate(2deg); }
}
@keyframes fx-jaw {
  0%,100%{ transform:scaleY(1) translateY(0); }
  50%    { transform:scaleY(3.2) translateY(3px); }
}
@keyframes fx-tail {
  0%,100%{ transform:rotate(-4deg); }
  50%    { transform:rotate(14deg); }
}
@keyframes fx-zzz {
  0%   { opacity:0; transform:translate(0,0) scale(0.4) rotate(-8deg); }
  20%  { opacity:1; }
  100% { opacity:0; transform:translate(16px,-26px) scale(1.1) rotate(8deg); }
}
@keyframes fx-zzz2 {
  0%,38%{ opacity:0; transform:translate(0,0) scale(0.4) rotate(8deg); }
  60%   { opacity:1; }
  100%  { opacity:0; transform:translate(20px,-24px) scale(1.2) rotate(-8deg); }
}
@keyframes fx-dot {
  0%,100%{ transform:scale(1); opacity:0.9; }
  50%    { transform:scale(1.35); opacity:0.35; }
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

export function FoxyCharacter({ state, size, palette, onStateComplete }: Props) {
  ensureCSS()

  const c0  = palette[0]              // orange
  const c1  = palette[1]              // cream
  const W   = '#fff8f0'               // warm white
  const D   = '#3d1505'               // dark brown
  const PNK = '#c0492a'               // dark rust for inner ear

  const rootAnim = {
    idle:        'fx-breathe 2.4s ease-in-out infinite',
    walk:        'fx-walk 0.52s ease-in-out infinite',
    talk:        'fx-talk 0.38s ease-in-out infinite',
    think:       'fx-breathe 2.2s ease-in-out infinite',
    react_happy: 'fx-happy 0.95s ease-in-out 1 forwards',
    sleep:       'fx-sleep 3.2s ease-in-out infinite',
  }[state]

  const headAnim = state === 'think' ? 'fx-think 1.5s ease-in-out infinite' : undefined
  const jawAnim  = state === 'talk'  ? 'fx-jaw   0.3s ease-in-out infinite' : undefined
  const tailAnim = 'fx-tail 1.8s ease-in-out infinite'

  const eyes = () => {
    if (state === 'sleep') return (
      <>
        <path d="M 43 48 Q 50 54 57 48" stroke={D} strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <path d="M 63 48 Q 70 54 77 48" stroke={D} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      </>
    )
    if (state === 'react_happy') return (
      <>
        <path d="M 43 51 Q 50 43 57 51" stroke={D} strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <path d="M 63 51 Q 70 43 77 51" stroke={D} strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <ellipse cx="43" cy="56" rx="6" ry="3.5" fill="#f9a8d4" opacity="0.5" />
        <ellipse cx="77" cy="56" rx="6" ry="3.5" fill="#f9a8d4" opacity="0.5" />
      </>
    )
    return (
      <>
        <ellipse cx="50" cy="48" rx="8.5" ry="9.5" fill={W} />
        <ellipse cx="70" cy="48" rx="8.5" ry="9.5" fill={W} />
        {/* amber iris */}
        <ellipse cx="50.5" cy="49" rx="5.5" ry="7"  fill="#92400e" />
        <ellipse cx="70.5" cy="49" rx="5.5" ry="7"  fill="#92400e" />
        <ellipse cx="51"   cy="50" rx="3.5" ry="5"  fill={D} />
        <ellipse cx="71"   cy="50" rx="3.5" ry="5"  fill={D} />
        <circle  cx="53.5" cy="46.5" r="2.2" fill="white" />
        <circle  cx="73.5" cy="46.5" r="2.2" fill="white" />
        <circle  cx="50.5" cy="53"   r="1"   fill="white" opacity="0.5" />
        <circle  cx="70.5" cy="53"   r="1"   fill="white" opacity="0.5" />
      </>
    )
  }

  return (
    <svg width={size} height={size} viewBox="0 0 120 120" style={{ overflow: 'visible' }}
      onAnimationEnd={state === 'react_happy' && onStateComplete
        ? (e) => { if ((e as unknown as AnimationEvent).animationName === 'fx-happy') onStateComplete() }
        : undefined}
    >
      <defs>
        <radialGradient id="fx-hg" cx="40%" cy="36%" r="68%">
          <stop offset="0%"   stopColor={c1} />
          <stop offset="100%" stopColor={c0} />
        </radialGradient>
        <radialGradient id="fx-bg" cx="42%" cy="32%" r="65%">
          <stop offset="0%"   stopColor={c1} />
          <stop offset="100%" stopColor={c0} />
        </radialGradient>
        <radialGradient id="fx-tg" cx="30%" cy="30%" r="70%">
          <stop offset="0%"   stopColor={c1} />
          <stop offset="80%"  stopColor={c0} />
        </radialGradient>
      </defs>

      <g style={{ ...S, transformOrigin: '60px 64px', animation: rootAnim }}>

        {/* big bushy tail */}
        <g style={{ ...S, transformOrigin: '72px 92px', animation: tailAnim }}>
          <path
            d="M 72,92 C 100,84 118,60 110,40 C 104,24 86,22 85,38 C 84,50 95,56 92,66 C 90,75 81,75 78,84"
            fill="none" stroke={c0} strokeWidth="14" strokeLinecap="round"
          />
          {/* white tail tip */}
          <circle cx="95" cy="37" r="13" fill={W} />
          <circle cx="95" cy="37" r="8"  fill={c1} opacity="0.6" />
        </g>

        {/* body */}
        <ellipse cx="60" cy="94" rx="26" ry="21" fill="url(#fx-bg)" />
        {/* white chest */}
        <ellipse cx="60" cy="91" rx="16" ry="14" fill={W} opacity="0.85" />

        {/* head */}
        <g style={{ ...S, transformOrigin: '60px 51px', animation: headAnim }}>

          {/* tall pointed fox ears */}
          <path d="M 30,34 Q 20,8  42,6  Q 58,8  56,36 Z" fill={c0} />
          <path d="M 64,36 Q 62,8  78,6  Q 100,8 90,34 Z" fill={c0} />
          {/* inner ears (rust/pink) */}
          <path d="M 32,33 Q 23,11 42,9  Q 55,11 54,34 Z" fill={PNK} opacity="0.7" />
          <path d="M 66,34 Q 65,11 78,9  Q 97,11 88,33 Z" fill={PNK} opacity="0.7" />

          {/* head */}
          <circle cx="60" cy="51" r="29" fill="url(#fx-hg)" />

          {/* muzzle */}
          <ellipse cx="60" cy="61" rx="16" ry="11.5" fill={c1} opacity="0.85" />
          <ellipse cx="60" cy="61" rx="12" ry="8.5"  fill={W}  opacity="0.6"  />

          {eyes()}

          {/* nose */}
          <ellipse cx="60" cy="55" rx="5"   ry="4"   fill={D} />
          <circle  cx="58.5" cy="54" r="1.5" fill="#7c3010" />

          {/* mouth */}
          <g style={{ ...S, transformOrigin: '60px 67px', animation: jawAnim }}>
            <path d="M 54 67 Q 60 72 66 67" stroke={D} strokeWidth="2" fill="none" strokeLinecap="round" />
          </g>

          {/* think bubbles */}
          {state === 'think' && (
            <>
              <circle cx="78" cy="29" r="5"  fill={W} opacity="0.9" style={{ ...S, animation: 'fx-dot 1s ease-in-out infinite' }} />
              <circle cx="88" cy="20" r="6.5" fill={W} opacity="0.9" style={{ ...S, animation: 'fx-dot 1s ease-in-out infinite 0.3s' }} />
              <circle cx="100" cy="9" r="9"  fill={W} opacity="0.9" style={{ ...S, animation: 'fx-dot 1s ease-in-out infinite 0.6s' }} />
            </>
          )}
        </g>

        {/* zzz */}
        {state === 'sleep' && (
          <>
            <text x="76" y="36" fontSize="11" fill={c1} fontWeight="bold" fontFamily="system-ui,sans-serif"
              style={{ animation: 'fx-zzz 2.4s ease-in-out infinite' }}>Z</text>
            <text x="83" y="23" fontSize="16" fill={c1} fontWeight="bold" fontFamily="system-ui,sans-serif"
              style={{ animation: 'fx-zzz2 2.4s ease-in-out infinite' }}>Z</text>
          </>
        )}

      </g>
    </svg>
  )
}
