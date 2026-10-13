import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { CharacterRenderer } from '../CharacterRenderer'
import type { CharacterManifest } from '@buddy/types'

vi.mock('../SpriteCanvas', () => ({
  SpriteCanvas: () => <div data-testid="sprite-canvas" />,
}))
vi.mock('../LottieCanvas', () => ({
  LottieCanvas: () => <div data-testid="lottie-canvas" />,
}))
vi.mock('@rive-app/react-canvas', () => ({
  useRive: () => ({ rive: null, RiveComponent: () => <canvas data-testid="rive-canvas" /> }),
  useStateMachineInput: () => null,
}))

const spriteChar: CharacterManifest = {
  id: 'fox', name: 'Fox', type: 'sprite', personality: 'p', palette: ['#f00', '#0f0'],
}
const lottieChar: CharacterManifest = {
  id: 'cat', name: 'Cat', type: 'lottie', personality: 'p', palette: ['#00f', '#ff0'],
}

describe('CharacterRenderer', () => {
  it('renders SpriteCanvas for sprite characters', () => {
    const { getByTestId } = render(
      <CharacterRenderer character={spriteChar} state="idle" size={120} />
    )
    expect(getByTestId('sprite-canvas')).toBeTruthy()
  })

  it('renders LottieCanvas for lottie characters', () => {
    const { getByTestId } = render(
      <CharacterRenderer character={lottieChar} state="idle" size={120} />
    )
    expect(getByTestId('lottie-canvas')).toBeTruthy()
  })
})
