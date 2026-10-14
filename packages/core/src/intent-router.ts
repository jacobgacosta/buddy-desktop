import type { AvatarAction, VoiceCommand } from '@buddy/types'

export type { AvatarAction, VoiceCommand }

export interface IntentResult {
  type: 'wake_word' | 'command' | 'none'
  text?: string
  command?: VoiceCommand
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1])
  return dp[m][n]
}

// Universal Spanish triggers that Whisper reliably transcribes
const UNIVERSAL_TRIGGERS = ['oye', 'hey', 'ey']

function stripPunctuation(s: string) {
  return s.replace(/[.,!?¿¡;:]/g, '').trim()
}

function matchesWakeWord(transcript: string, wakeWord: string): boolean {
  const clean = stripPunctuation(transcript).toLowerCase()
  const wake = wakeWord.toLowerCase()
  // exact match
  if (clean.includes(wake)) return true
  // fuzzy word match (edit distance ≤ 2)
  if (clean.split(/\s+/).some(w => w.length >= 3 && levenshtein(w, wake) <= 2)) return true
  // universal triggers: "oye ...", "hey ..."
  return UNIVERSAL_TRIGGERS.some(t => clean.startsWith(t))
}

function extractText(transcript: string, wakeWord: string): string {
  const clean = stripPunctuation(transcript)
  const lower = clean.toLowerCase()
  // remove universal trigger at start
  for (const t of UNIVERSAL_TRIGGERS) {
    if (lower.startsWith(t)) {
      const rest = clean.slice(t.length).trim()
      // also strip the character name if it follows
      const restLower = rest.toLowerCase()
      const wake = wakeWord.toLowerCase()
      if (restLower.startsWith(wake)) return rest.slice(wake.length).trim()
      // fuzzy strip of character name
      const firstWord = restLower.split(/\s+/)[0]
      if (firstWord && levenshtein(firstWord, wake) <= 2) return rest.split(/\s+/).slice(1).join(' ').trim()
      return rest
    }
  }
  // remove wake word and fuzzy variants
  return clean.split(/\s+/)
    .filter(w => levenshtein(w.toLowerCase(), wakeWord.toLowerCase()) > 2)
    .join(' ').trim()
}

export function detectIntent(
  transcript: string,
  wakeWord: string,
  commands: VoiceCommand[],
): IntentResult {
  const lower = transcript.toLowerCase()

  // commands take priority only if no wake trigger present
  const hasWake = matchesWakeWord(transcript, wakeWord)

  if (!hasWake) {
    for (const cmd of commands) {
      if (cmd.triggers.some(t => lower.includes(t.toLowerCase()))) {
        return { type: 'command', command: cmd }
      }
    }
    return { type: 'none' }
  }

  // check commands first within a wake phrase ("oye duerme")
  for (const cmd of commands) {
    if (cmd.triggers.some(t => lower.includes(t.toLowerCase()))) {
      return { type: 'command', command: cmd }
    }
  }

  const text = extractText(transcript, wakeWord)
  return { type: 'wake_word', text }
}
