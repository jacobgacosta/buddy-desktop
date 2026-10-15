import { useState, useEffect, useCallback, useRef } from 'react'
import { LlmClient } from '@buddy/core'
import { AvatarStateMachine } from '@buddy/core'
import type { Avatar, Message, AvatarState } from '@buddy/types'

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:7788'
const MAX_HISTORY = 30

export function useBuddy(avatar: Avatar, initialHistory: Message[] = [], onResponse?: (text: string) => void, onError?: (text: string) => void) {
  const [state, setState] = useState<AvatarState>('idle')
  const [history, setHistory] = useState<Message[]>(initialHistory)
  const [thinking, setThinking] = useState(false)
  const [lastUserActivity, setLastUserActivity] = useState(Date.now())

  const sm = useRef<AvatarStateMachine | null>(null)
  if (sm.current === null) sm.current = new AvatarStateMachine(setState)
  const client = useRef<LlmClient | null>(null)
  if (client.current === null) client.current = new LlmClient(SERVER_URL)

  const historyRef = useRef<Message[]>([])
  useEffect(() => { historyRef.current = history }, [history])

  const onResponseRef = useRef(onResponse)
  useEffect(() => { onResponseRef.current = onResponse }, [onResponse])
  const onErrorRef = useRef(onError)
  useEffect(() => { onErrorRef.current = onError }, [onError])

  const talkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    return () => { if (talkTimerRef.current) clearTimeout(talkTimerRef.current) }
  }, [])

  const sendMessage = useCallback(async (text: string) => {
    sm.current!.wakeUp()
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      avatarId: avatar.id,
      timestamp: Date.now(),
    }
    setHistory(h => [...h, userMsg])
    setLastUserActivity(Date.now())
    setThinking(true)
    sm.current!.sendMessage()

    try {
      const resp = await client.current!.chat({
        message: text,
        avatarId: avatar.id,
        personality: avatar.personality,
        history: [...historyRef.current, userMsg],
      })
      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: resp.content,
        avatarId: avatar.id,
        timestamp: Date.now(),
      }
      setHistory(h => [...h, assistantMsg].slice(-MAX_HISTORY))
      onResponseRef.current?.(resp.content)
      sm.current!.receiveResponse()
      if (talkTimerRef.current) clearTimeout(talkTimerRef.current)
      talkTimerRef.current = setTimeout(() => sm.current!.finishTalking(), 4000)
    } catch {
      const fallback = 'No puedo conectarme en este momento.'
      const errMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: fallback,
        avatarId: avatar.id,
        timestamp: Date.now(),
      }
      setHistory(h => [...h, errMsg])
      onErrorRef.current?.(fallback)
      sm.current!.receiveResponse()
      if (talkTimerRef.current) clearTimeout(talkTimerRef.current)
      talkTimerRef.current = setTimeout(() => sm.current!.finishTalking(), 4000)
    } finally {
      setThinking(false)
    }
  }, [avatar])

  // Sleep after 3 minutes of no chat
  useEffect(() => {
    const timer = setTimeout(() => sm.current!.setSleep(), 3 * 60 * 1000)
    return () => clearTimeout(timer)
  }, [lastUserActivity])

  // Auto-wake after 2 minutes of sleep
  useEffect(() => {
    if (state !== 'sleep') return
    const timer = setTimeout(() => sm.current!.wakeUp(), 2 * 60 * 1000)
    return () => clearTimeout(timer)
  }, [state])

  const wakeUp = useCallback(() => sm.current!.wakeUp(), [])
  const startWalking = useCallback(() => sm.current!.startWalking(), [])
  const stopWalking = useCallback(() => sm.current!.stopWalking(), [])
  const stopReacting = useCallback(() => sm.current!.finishReacting(), [])
  const setSleep = useCallback(() => sm.current!.setSleep(), [])

  return { state, history, thinking, sendMessage, wakeUp, startWalking, stopWalking, stopReacting, setSleep }
}
