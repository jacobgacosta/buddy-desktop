import { useState, useEffect, useCallback, useRef } from 'react'
import { LlmClient } from '@buddy/core'
import { AvatarStateMachine } from '@buddy/core'
import type { Avatar, Message, AvatarState } from '@buddy/types'

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:7788'

export function useBuddy(avatar: Avatar) {
  const [state, setState] = useState<AvatarState>('idle')
  const [history, setHistory] = useState<Message[]>([])
  const [thinking, setThinking] = useState(false)
  const sm = useRef(new AvatarStateMachine(setState))
  const client = useRef(new LlmClient(SERVER_URL))

  const sendMessage = useCallback(async (text: string) => {
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      avatarId: avatar.id,
      timestamp: Date.now(),
    }
    setHistory(h => [...h, userMsg])
    setThinking(true)
    sm.current.sendMessage()

    try {
      const resp = await client.current.chat({
        message: text,
        avatarId: avatar.id,
        personality: avatar.personality,
        history: [...history, userMsg],
      })
      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: resp.content,
        avatarId: avatar.id,
        timestamp: Date.now(),
      }
      setHistory(h => [...h, assistantMsg])
      sm.current.receiveResponse()
      // vuelve a idle tras 4 segundos de "hablar"
      setTimeout(() => sm.current.finishTalking(), 4000)
    } catch (err) {
      console.error(err)
      sm.current.finishTalking()
    } finally {
      setThinking(false)
    }
  }, [avatar, history])

  // entrar en sleep tras 5 minutos de inactividad
  useEffect(() => {
    const timer = setTimeout(() => sm.current.setSleep(), 5 * 60 * 1000)
    return () => clearTimeout(timer)
  }, [history])

  return { state, history, thinking, sendMessage }
}
