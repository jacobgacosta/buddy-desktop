import { useRef, useEffect } from 'react'
import type { AvatarState } from '@buddy/types'

interface Props {
  state: AvatarState
  size: number
}

type RGBA = [number, number, number, number]

interface StateConfig {
  speedMult: number
  sparkCount: number
  coreBrightness: number
  palette: [number, number, number][]
}

const STATE_CONFIG: Record<AvatarState, StateConfig> = {
  idle: {
    speedMult: 1,
    sparkCount: 14,
    coreBrightness: 0.08,
    palette: [[0,242,254],[123,95,255],[255,0,122],[79,172,254]],
  },
  walk: {
    speedMult: 1.8,
    sparkCount: 22,
    coreBrightness: 0.12,
    palette: [[0,255,180],[0,200,255],[100,255,100],[79,172,254]],
  },
  talk: {
    speedMult: 2.4,
    sparkCount: 30,
    coreBrightness: 0.18,
    palette: [[255,255,255],[0,242,254],[200,220,255],[123,95,255]],
  },
  think: {
    speedMult: 0.6,
    sparkCount: 8,
    coreBrightness: 0.06,
    palette: [[150,80,255],[100,60,200],[180,100,255],[80,40,180]],
  },
  react_happy: {
    speedMult: 3.5,
    sparkCount: 40,
    coreBrightness: 0.28,
    palette: [[255,220,0],[255,100,0],[255,0,150],[100,255,100]],
  },
  sleep: {
    speedMult: 0.25,
    sparkCount: 4,
    coreBrightness: 0.03,
    palette: [[40,60,120],[20,40,100],[60,80,160],[30,50,130]],
  },
}

export function AuroraCharacter({ state, size }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef<AvatarState>(state)
  stateRef.current = state

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const S = size * dpr
    canvas.width = S
    canvas.height = S
    const cx = S / 2, cy = S / 2

    let raf: number
    let t = 0
    const TARGET_FPS = 30
    const FRAME_MS = 1000 / TARGET_FPS
    let lastFrame = 0

    const rings = [
      { r: 0.44, thick: 0.10, speed: 0.28, dir: 1 as 1|-1, phase: 0 },
      { r: 0.36, thick: 0.06, speed: 0.55, dir: -1 as 1|-1, phase: Math.PI * 0.6 },
      { r: 0.27, thick: 0.045, speed: 1.1, dir: 1 as 1|-1, phase: Math.PI * 1.3 },
      { r: 0.32, thick: 0.022, speed: 1.8, dir: -1 as 1|-1, phase: Math.PI * 0.2 },
    ]

    interface Spark {
      angle: number; r: number; size: number; alpha: number
      speed: number; life: number; maxLife: number
      cr: number; cg: number; cb: number
    }
    const sparks: Spark[] = []

    const spawnSpark = (cfg: StateConfig) => {
      const [cr, cg, cb] = cfg.palette[Math.floor(Math.random() * cfg.palette.length)]
      sparks.push({
        angle: Math.random() * Math.PI * 2,
        r: S / 2 * (0.2 + Math.random() * 0.3),
        size: (0.5 + Math.random() * 2) * dpr,
        alpha: 0,
        speed: (Math.random() > 0.5 ? 1 : -1) * (0.5 + Math.random() * 1.0),
        life: 0,
        maxLife: 60 + Math.random() * 100,
        cr, cg, cb,
      })
    }

    const cfg0 = STATE_CONFIG[stateRef.current]
    for (let i = 0; i < cfg0.sparkCount; i++) spawnSpark(cfg0)

    // Live interpolated config — lerps toward target each frame instead of snapping
    const live = {
      speedMult: cfg0.speedMult,
      sparkCount: cfg0.sparkCount,
      coreBrightness: cfg0.coreBrightness,
      palette: cfg0.palette.map(c => [c[0], c[1], c[2]] as [number, number, number]),
    }

    const lerpRgba = (a: RGBA, b: RGBA, t: number) => {
      return `rgba(${(a[0]+(b[0]-a[0])*t)|0},${(a[1]+(b[1]-a[1])*t)|0},${(a[2]+(b[2]-a[2])*t)|0},${(a[3]+(b[3]-a[3])*t).toFixed(3)})`
    }

    const buildStops = (palette: [number,number,number][]): { pos: number; color: RGBA }[] => {
      const [c0, c1, c2, c3] = palette
      return [
        { pos: 0.00, color: [...c0, 0] as RGBA },
        { pos: 0.25, color: [...c0, 0.6] as RGBA },
        { pos: 0.55, color: [...c1, 0.8] as RGBA },
        { pos: 0.80, color: [...c2 ?? c1, 0.5] as RGBA },
        { pos: 1.00, color: [...c3 ?? c0, 0] as RGBA },
      ]
    }

    const drawRing = (ring: typeof rings[0], time: number, cfg: StateConfig) => {
      const radius = (S / 2) * ring.r
      const halfThick = (S / 2) * ring.thick
      const arcLen = Math.PI * (1.1 + 0.4 * Math.sin(time * 0.3 + ring.phase))
      const startAngle = time * ring.speed * ring.dir * cfg.speedMult + ring.phase
      const stops = buildStops(cfg.palette)
      const [mr, mg, mb] = cfg.palette[1]

      ctx.save()
      ctx.translate(cx, cy)

      // fake glow: 3 wide passes at decreasing opacity (no shadowBlur — breaks transparent windows)
      for (let pass = 0; pass < 3; pass++) {
        const widthMult = [3.5, 2.2, 1.4][pass]
        const alphaMult = [0.15, 0.25, 0.35][pass]
        for (let i = 0; i < 8; i++) {
          const frac = (i + 0.5) / 8
          const angle = startAngle + frac * arcLen
          let baseColor: RGBA = stops[0].color
          for (let s = 0; s < stops.length - 1; s++) {
            if (frac >= stops[s].pos && frac <= stops[s+1].pos) {
              const t2 = (frac - stops[s].pos) / (stops[s+1].pos - stops[s].pos)
              baseColor = stops[s].color.map((v, i) => v + (stops[s+1].color[i] - v) * t2) as RGBA
              break
            }
          }
          ctx.beginPath()
          ctx.arc(0, 0, radius, angle, angle + arcLen / 8 + 0.01)
          ctx.strokeStyle = `rgba(${baseColor[0]|0},${baseColor[1]|0},${baseColor[2]|0},${(baseColor[3] * alphaMult).toFixed(3)})`
          ctx.lineWidth = halfThick * widthMult * dpr
          ctx.lineCap = 'round'
          ctx.stroke()
        }
      }

      for (let i = 0; i < 40; i++) {
        const frac = i / 40
        const angle = startAngle + frac * arcLen
        let color = 'rgba(0,0,0,0)'
        for (let s = 0; s < stops.length - 1; s++) {
          if (frac >= stops[s].pos && frac <= stops[s+1].pos) {
            color = lerpRgba(stops[s].color, stops[s+1].color, (frac - stops[s].pos) / (stops[s+1].pos - stops[s].pos))
            break
          }
        }
        const breathe = 1 + 0.12 * Math.sin(time * 1.5 * cfg.speedMult + ring.phase + frac * 4)
        ctx.beginPath()
        ctx.arc(0, 0, radius, angle, angle + arcLen / 40 + 0.002)
        ctx.strokeStyle = color
        ctx.lineWidth = halfThick * 0.7 * breathe * dpr
        ctx.lineCap = 'round'
        ctx.stroke()
      }
      ctx.restore()
    }

    const drawCore = (time: number, cfg: StateConfig) => {
      const pulse = 1 + 0.08 * Math.sin(time * 2.1 * cfg.speedMult)
      const coreR = S * 0.11 * pulse
      const [cr, cg, cb] = cfg.palette[0]
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR)
      grad.addColorStop(0, `rgba(${cr},${cg},${cb},${cfg.coreBrightness * 1.5})`)
      grad.addColorStop(0.5, `rgba(${cr},${cg},${cb},${cfg.coreBrightness * 0.5})`)
      grad.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.beginPath()
      ctx.arc(cx, cy, coreR, 0, Math.PI * 2)
      ctx.fillStyle = grad
      ctx.fill()
    }

    const drawSparks = (cfg: StateConfig) => {
      while (sparks.length < cfg.sparkCount) spawnSpark(cfg)

      for (let i = sparks.length - 1; i >= 0; i--) {
        const sp = sparks[i]
        sp.life++
        sp.angle += sp.speed * 0.016 * cfg.speedMult
        const lf = sp.life / sp.maxLife
        sp.alpha = lf < 0.2 ? lf / 0.2 : lf > 0.7 ? 1 - (lf - 0.7) / 0.3 : 1

        const px = cx + Math.cos(sp.angle) * sp.r
        const py = cy + Math.sin(sp.angle) * sp.r

        ctx.beginPath()
        ctx.arc(px, py, sp.size * 2.5, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${sp.cr},${sp.cg},${sp.cb},${sp.alpha * 0.2})`
        ctx.fill()

        ctx.beginPath()
        ctx.arc(px, py, sp.size, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${sp.cr},${sp.cg},${sp.cb},${sp.alpha * 0.85})`
        ctx.fill()

        if (sp.life >= sp.maxLife) {
          sparks.splice(i, 1)
          spawnSpark(cfg)
        }
      }

      // trim excess sparks if state changed to a quieter one
      while (sparks.length > cfg.sparkCount + 5) sparks.splice(0, 1)
    }

    const render = (now: number) => {
      if (now - lastFrame < FRAME_MS) { raf = requestAnimationFrame(render); return }
      lastFrame = now
      t += 0.033

      // Lerp live config toward target — smooth ~700ms transition between states
      const target = STATE_CONFIG[stateRef.current]
      const L = 0.06
      live.speedMult      += (target.speedMult      - live.speedMult)      * L
      live.coreBrightness += (target.coreBrightness - live.coreBrightness) * L
      live.sparkCount     += (target.sparkCount     - live.sparkCount)     * L
      for (let i = 0; i < live.palette.length; i++) {
        const tc = target.palette[i]
        const lc = live.palette[i]
        lc[0] += (tc[0] - lc[0]) * L
        lc[1] += (tc[1] - lc[1]) * L
        lc[2] += (tc[2] - lc[2]) * L
      }
      const cfg = { ...live, sparkCount: Math.round(live.sparkCount) }

      ctx.clearRect(0, 0, S, S)
      drawCore(t, cfg)
      for (const ring of rings) drawRing(ring, t, cfg)
      drawSparks(cfg)

      raf = requestAnimationFrame(render)
    }

    raf = requestAnimationFrame(render)
    return () => cancelAnimationFrame(raf)
  }, [size])

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: size, height: size,
        display: 'block',
        background: 'transparent',
        borderRadius: '50%',
        willChange: 'transform',
      }}
    />
  )
}
