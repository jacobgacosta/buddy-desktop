import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { LlmClient } from '../llm-client'
import type { Message } from '@buddy/types'

const mockFetch = vi.fn()

describe('LlmClient', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch)
    mockFetch.mockReset()
  })
  afterEach(() => vi.unstubAllGlobals())

  it('posts to /chat with correct payload', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ content: 'Hola!', avatar_id: 'fox' }),
    })

    const client = new LlmClient('http://localhost:7788')
    const result = await client.chat({
      message: 'hola',
      avatarId: 'fox',
      personality: 'Eres Foxy.',
      history: [],
    })

    expect(result.content).toBe('Hola!')
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:7788/chat',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('throws when server returns error', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 502 })

    const client = new LlmClient('http://localhost:7788')
    await expect(
      client.chat({ message: 'hola', avatarId: 'fox', personality: '', history: [] })
    ).rejects.toThrow('LLM request failed: 502')
  })
})
