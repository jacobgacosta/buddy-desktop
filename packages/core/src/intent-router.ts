import type { AvatarAction, VoiceCommand } from '@buddy/types'

export type { AvatarAction, VoiceCommand }

export interface IntentResult {
  type: 'wake_word' | 'command' | 'none'
  text?: string
  command?: VoiceCommand
}

export function detectIntent(
  transcript: string,
  wakeWord: string,
  commands: VoiceCommand[],
): IntentResult {
  const lower = transcript.toLowerCase()
  const lowerWake = wakeWord.toLowerCase()

  if (lower.includes(lowerWake)) {
    const escaped = wakeWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const text = transcript.replace(new RegExp(escaped, 'gi'), '').trim()
    return { type: 'wake_word', text }
  }

  for (const cmd of commands) {
    if (cmd.triggers.some(t => lower.includes(t.toLowerCase()))) {
      return { type: 'command', command: cmd }
    }
  }

  return { type: 'none' }
}
