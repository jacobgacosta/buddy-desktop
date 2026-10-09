import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { BuddyCanvas } from '../BuddyCanvas'

// mock Rive para tests — no necesita WebGL en CI
vi.mock('@rive-app/react-canvas', () => ({
  useRive: () => ({
    rive: null,
    RiveComponent: () => <canvas data-testid="rive-canvas" />,
  }),
  useStateMachineInput: () => null,
}))

describe('BuddyCanvas', () => {
  it('renders without crashing', () => {
    const { getByTestId } = render(
      <BuddyCanvas riveFile="fox.riv" stateMachine="BuddySM" state="idle" size={120} />
    )
    expect(getByTestId('rive-canvas')).toBeTruthy()
  })
})
