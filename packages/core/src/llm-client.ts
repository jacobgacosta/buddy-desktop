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
    return resp.json()
  }
}
