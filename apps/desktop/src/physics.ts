export interface Position { x: number; y: number }
export interface PhysicsState {
  pos: Position
  vel: Position
  target: Position | null
}

export function createPhysics(initial: Position): PhysicsState {
  return { pos: initial, vel: { x: 0, y: 0 }, target: null }
}

const WALK_SPEED = 80   // px/s
const GRAVITY = 200     // px/s²
const MAX_VEL_Y = 600   // px/s terminal velocity
const ARRIVE_DIST = 2   // px

export function tickPhysics(
  state: PhysicsState,
  screenW: number,
  screenH: number,
  spriteSize: number,
  dt: number
): PhysicsState {
  const safeDt = Math.min(dt, 0.05)
  const { pos, vel, target } = state

  if (target) {
    const dx = target.x - pos.x
    const dy = target.y - pos.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < ARRIVE_DIST) {
      return { pos: target, vel: { x: 0, y: 0 }, target: null }
    }
    return {
      pos: {
        x: pos.x + (dx / dist) * WALK_SPEED * safeDt,
        y: pos.y + (dy / dist) * WALK_SPEED * safeDt,
      },
      vel: { x: (dx / dist) * WALK_SPEED, y: (dy / dist) * WALK_SPEED },
      target,
    }
  }

  const newVelY = Math.min(vel.y + GRAVITY * safeDt, MAX_VEL_Y)
  const rawX = pos.x + vel.x * safeDt
  const rawY = pos.y + newVelY * safeDt
  const newX = Math.max(0, Math.min(screenW - spriteSize, rawX))
  const newY = Math.max(0, Math.min(screenH - spriteSize, rawY))

  return {
    pos: { x: newX, y: newY },
    vel: {
      x: newX === rawX ? vel.x : 0,
      y: newVelY,
    },
    target,
  }
}

export function setWalkTarget(state: PhysicsState, target: Position): PhysicsState {
  return { ...state, target }
}

export function randomEdgeTarget(screenW: number, screenH: number, spriteSize: number): Position {
  const safeW = Math.max(0, screenW - spriteSize)
  const safeH = Math.max(0, screenH - spriteSize)
  const edge = Math.floor(Math.random() * 4)
  switch (edge) {
    case 0: return { x: Math.random() * safeW, y: 0 }
    case 1: return { x: safeW, y: Math.random() * safeH }
    case 2: return { x: Math.random() * safeW, y: safeH }
    default: return { x: 0, y: Math.random() * safeH }
  }
}
