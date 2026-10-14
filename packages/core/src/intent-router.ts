export type AvatarAction = 'sleep' | 'wakeUp' | 'walk' | 'dance' | 'react'

export interface VoiceCommand {
  triggers: string[]
  action: AvatarAction
  responses?: string[]
}

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
    const text = transcript.replace(new RegExp(wakeWord, 'gi'), '').trim()
    return { type: 'wake_word', text }
  }

  for (const cmd of commands) {
    if (cmd.triggers.some(t => lower.includes(t.toLowerCase()))) {
      return { type: 'command', command: cmd }
    }
  }

  return { type: 'none' }
}
