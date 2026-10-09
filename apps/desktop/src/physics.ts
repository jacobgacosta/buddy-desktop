export interface Position { x: number; y: number }
export interface PhysicsState {
  pos: Position
  vel: Position
  target: Position | null
}

export function createPhysics(initial: Position): PhysicsState {
  return { pos: initial, vel: { x: 0, y: 0 }, target: null }
}

export function tickPhysics(
  state: PhysicsState,
  screenW: number,
  screenH: number,
  spriteSize: number,
  dt: number
): PhysicsState {
  const { pos, vel, target } = state

  if (target) {
    const dx = target.x - pos.x
    const dy = target.y - pos.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < 2) {
      return { pos: target, vel: { x: 0, y: 0 }, target: null }
    }
    const speed = 80 // px/s
    return {
      pos: {
        x: pos.x + (dx / dist) * speed * dt,
        y: pos.y + (dy / dist) * speed * dt,
      },
      vel: { x: dx / dist, y: dy / dist },
      target,
    }
  }

  // gravedad hacia borde inferior cuando no hay target
  const gravity = 200
  const newVelY = vel.y + gravity * dt
  const newX = Math.max(0, Math.min(screenW - spriteSize, pos.x + vel.x * dt))
  const newY = Math.max(0, Math.min(screenH - spriteSize, pos.y + newVelY * dt))

  return {
    pos: { x: newX, y: newY },
    vel: { x: vel.x, y: newVelY },
    target,
  }
}

export function setWalkTarget(state: PhysicsState, target: Position): PhysicsState {
  return { ...state, target }
}

export function randomEdgeTarget(screenW: number, screenH: number, spriteSize: number): Position {
  const edge = Math.floor(Math.random() * 4)
  switch (edge) {
    case 0: return { x: Math.random() * (screenW - spriteSize), y: 0 }
    case 1: return { x: screenW - spriteSize, y: Math.random() * (screenH - spriteSize) }
    case 2: return { x: Math.random() * (screenW - spriteSize), y: screenH - spriteSize }
    default: return { x: 0, y: Math.random() * (screenH - spriteSize) }
  }
}
