export interface Position { x: number; y: number }
export interface PhysicsState {
  pos: Position
  vel: Position
  target: Position | null
}

export function createPhysics(initial: Position): PhysicsState {
  return { pos: initial, vel: { x: 0, y: 0 }, target: null }
}

const WALK_SPEED = 80  // px/s
const ARRIVE_DIST = 2  // px

// Avatar position bounds that keep the entire window on screen.
// Window is WIN_W x WIN_H, avatar sits at (OFF_X, OFF_Y) within it.
// wx = pos.x - offX  must be >= 0  → pos.x >= offX
// wy = pos.y - offY  must be >= 0  → pos.y >= offY
// wx + winW <= screenW             → pos.x <= screenW - winW + offX
// wy + winH <= screenH             → pos.y <= screenH - winH + offY
function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}

export function tickPhysics(
  state: PhysicsState,
  dt: number
): PhysicsState {
  const safeDt = Math.min(dt, 0.05)
  const { pos, target } = state

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

  return { pos, vel: { x: 0, y: 0 }, target: null }
}

export function setWalkTarget(state: PhysicsState, target: Position): PhysicsState {
  return { ...state, target }
}

// Random target near the current position — safe for multi-monitor setups.
// Never uses absolute screen bounds so the character stays on whichever monitor it's on.
export function randomNearbyTarget(current: Position, radius = 350): Position {
  const angle = Math.random() * 2 * Math.PI
  const dist = 80 + Math.random() * radius
  return {
    x: current.x + Math.cos(angle) * dist,
    y: current.y + Math.sin(angle) * dist,
  }
}
