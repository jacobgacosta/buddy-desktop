import { smoothstep } from '@buddy/core'

export interface Position { x: number; y: number }

export interface PhysicsState {
  pos: Position
  vel: Position
  target: Position | null
  isFidget: boolean
  startPos: Position | null  // saved when target is set, used for easing
}

export function createPhysics(initial: Position): PhysicsState {
  return { pos: initial, vel: { x: 0, y: 0 }, target: null, isFidget: false, startPos: null }
}

const ARRIVE_DIST = 2

export function tickPhysics(
  state: PhysicsState,
  dt: number,
  speed: number,
): PhysicsState {
  const safeDt = Math.min(dt, 0.05)
  const { pos, target, startPos } = state
  if (!target) return { ...state, vel: { x: 0, y: 0 } }

  const dx = target.x - pos.x
  const dy = target.y - pos.y
  const dist = Math.sqrt(dx * dx + dy * dy)

  if (dist < ARRIVE_DIST) {
    return { ...state, pos: target, vel: { x: 0, y: 0 }, target: null, startPos: null }
  }

  const totalDist = startPos
    ? Math.sqrt((target.x - startPos.x) ** 2 + (target.y - startPos.y) ** 2)
    : dist
  const progress = totalDist > 0 ? Math.max(0, Math.min(1, 1 - dist / totalDist)) : 0
  const speedMult = 0.25 + 0.75 * Math.sin(smoothstep(progress) * Math.PI)
  const effectiveSpeed = speed * speedMult

  return {
    ...state,
    pos: {
      x: pos.x + (dx / dist) * effectiveSpeed * safeDt,
      y: pos.y + (dy / dist) * effectiveSpeed * safeDt,
    },
    vel: { x: (dx / dist) * effectiveSpeed, y: (dy / dist) * effectiveSpeed },
  }
}

export function setWalkTarget(state: PhysicsState, target: Position): PhysicsState {
  return { ...state, target, startPos: state.pos }
}

export function randomNearbyTarget(current: Position, radius = 350): Position {
  const angle = Math.random() * 2 * Math.PI
  const dist = 80 + Math.random() * radius
  return {
    x: current.x + Math.cos(angle) * dist,
    y: current.y + Math.sin(angle) * dist,
  }
}
