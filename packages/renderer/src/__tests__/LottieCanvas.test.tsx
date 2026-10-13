import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { LottieCanvas } from '../LottieCanvas'
import type { CharacterManifest } from '@buddy/types'

vi.mock('lottie-react', () => ({
  default: ({ animationData, 'data-testid': testId }: { animationData: unknown; 'data-testid'?: string }) => (
    <div data-testid={testId ?? 'lottie'} data-has-data={String(!!animationData)} />
  ),
}))

// Mock fetch for clip loading
const mockClipData = { v: '5.7.4', fr: 24, ip: 0, op: 48, w: 120, h: 120, layers: [] }
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve(mockClipData),
} as Response)

const lottieChar: CharacterManifest = {
  id: 'test-cat',
  name: 'Test Cat',
  type: 'lottie',
  personality: 'test',
  palette: ['#8B5CF6', '#C4B5FD'],
  clips: {
    idle: '/assets/characters/test-cat/idle.json',
    walk: '/assets/characters/test-cat/walk.json',
  },
}

describe('LottieCanvas', () => {
  it('renders a lottie element', async () => {
    const { findByTestId } = render(
      <LottieCanvas character={lottieChar} state="idle" size={120} />
    )
    const el = await findByTestId('lottie')
    expect(el).toBeTruthy()
  })

  it('renders emoji fallback when no clips configured', () => {
    const noClips: CharacterManifest = {
      ...lottieChar, clips: undefined,
    }
    const { container } = render(
      <LottieCanvas character={noClips} state="idle" size={120} />
    )
    expect(container.textContent).toBe('🦊')
  })
})
