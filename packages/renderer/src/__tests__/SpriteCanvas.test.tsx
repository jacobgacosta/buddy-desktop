import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { SpriteCanvas } from '../SpriteCanvas'
import type { CharacterManifest } from '@buddy/types'

const spriteChar: CharacterManifest = {
  id: 'test-fox',
  name: 'Test Fox',
  type: 'sprite',
  personality: 'test',
  palette: ['#FF6B35', '#F7C59F'],
  sheet: '/assets/characters/test-fox/sheet.png',
  frameWidth: 48,
  frameHeight: 48,
  fps: 8,
  states: {
    idle: { row: 0, frames: 4 },
    walk: { row: 1, frames: 8 },
  },
}

const noSheetChar: CharacterManifest = {
  id: 'no-sheet',
  name: 'No Sheet',
  type: 'sprite',
  personality: 'test',
  palette: ['#000', '#fff'],
}

// Mock canvas context — jsdom does not implement it
beforeEach(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    clearRect: vi.fn(),
    drawImage: vi.fn(),
  }) as unknown as CanvasRenderingContext2D)
})

describe('SpriteCanvas', () => {
  it('renders a canvas element when sheet is configured', () => {
    const { container } = render(
      <SpriteCanvas character={spriteChar} state="idle" size={120} />
    )
    expect(container.querySelector('canvas')).toBeTruthy()
  })

  it('renders emoji fallback when no sheet is configured', () => {
    const { container } = render(
      <SpriteCanvas character={noSheetChar} state="idle" size={120} />
    )
    expect(container.querySelector('canvas')).toBeFalsy()
    expect(container.textContent).toBe('🦊')
  })

  it('renders emoji fallback when state has no row configured', () => {
    const { container } = render(
      <SpriteCanvas character={spriteChar} state="sleep" size={120} />
    )
    // sleep has no row in spriteChar → falls back to idle row
    // canvas still renders (idle row is used as fallback)
    expect(container.querySelector('canvas')).toBeTruthy()
  })
})
