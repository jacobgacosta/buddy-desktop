import type { Message, ChatResponse } from '@buddy/types'

interface ChatParams {
  message: string
  avatarId: string
  personality: string
  history: Message[]
  context?: string
}

export class LlmClient {
  constructor(private readonly baseUrl: string) {}

  async chat(params: ChatParams): Promise<ChatResponse> {
    const resp = await fetch(`${this.baseUrl}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: params.message,
        avatar_id: params.avatarId,
        personality: params.personality,
        history: params.history.map(m => ({ role: m.role, content: m.content })),
        context: params.context,
      }),
    })

    if (!resp.ok) throw new Error(`LLM request failed: ${resp.status}`)
    const raw = await resp.json() as { content: string; avatar_id: string }
    return { content: raw.content, avatarId: raw.avatar_id }
  }

  async *chatStream(params: ChatParams): AsyncGenerator<string, string, unknown> {
    const resp = await fetch(`${this.baseUrl}/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: params.message,
        avatar_id: params.avatarId,
        personality: params.personality,
        history: params.history.map(m => ({ role: m.role, content: m.content })),
        context: params.context,
      }),
    })

    if (!resp.ok) throw new Error(`Stream failed: ${resp.status}`)

    const reader = resp.body!.getReader()
    const decoder = new TextDecoder()
    let buf = ''
    let full = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      const lines = buf.split('\n')
      buf = lines.pop() ?? ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data: ')) continue
        const data = trimmed.slice(6).trim()
        if (data === '[DONE]') return full
        try {
          const parsed = JSON.parse(data) as { delta: string }
          full += parsed.delta
          yield parsed.delta
        } catch { /* malformed chunk */ }
      }
    }
    return full
  }
}
