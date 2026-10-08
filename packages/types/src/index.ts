export interface Avatar {
  id: string
  name: string
  riveFile: string
  stateMachine: string
  personality: string
  voice: {
    system: string
    elevenlabs?: string
  }
  palette: string[]
  size: 'small' | 'medium' | 'large'
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  avatarId: string
  timestamp: number
}

export interface ChatRequest {
  message: string
  avatarId: string
  history: Message[]
  context?: string
}

export interface ChatResponse {
  content: string
  avatarId: string
}

export type AvatarState = 'idle' | 'walk' | 'talk' | 'think' | 'react_happy' | 'sleep'
