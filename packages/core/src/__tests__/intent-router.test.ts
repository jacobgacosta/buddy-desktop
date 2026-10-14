import { describe, it, expect } from 'vitest'
import { detectIntent } from '../intent-router'
import type { VoiceCommand } from '../intent-router'

const commands: VoiceCommand[] = [
  { triggers: ['duerme', 'a dormir'], action: 'sleep', responses: ['Zzz...'] },
  { triggers: ['despierta', 'levántate'], action: 'wakeUp', responses: ['¡Aquí!'] },
  { triggers: ['camina'], action: 'walk' },
]

describe('detectIntent — wake word', () => {
  it('detects wake word at start', () => {
    const r = detectIntent('buddy qué hora es', 'buddy', commands)
    expect(r.type).toBe('wake_word')
    expect(r.text).toBe('qué hora es')
  })
  it('detects wake word case-insensitive', () => {
    const r = detectIntent('BUDDY ayúdame', 'buddy', commands)
    expect(r.type).toBe('wake_word')
    expect(r.text).toBe('ayúdame')
  })
  it('strips wake word and trims result', () => {
    const r = detectIntent('oye buddy cuántos años tienes', 'buddy', commands)
    expect(r.type).toBe('wake_word')
    expect(r.text?.trim()).toBeTruthy()
  })
})

describe('detectIntent — command', () => {
  it('matches sleep trigger', () => {
    const r = detectIntent('duerme un rato', 'buddy', commands)
    expect(r.type).toBe('command')
    expect(r.command?.action).toBe('sleep')
  })
  it('matches wakeUp trigger', () => {
    const r = detectIntent('levántate', 'buddy', commands)
    expect(r.type).toBe('command')
    expect(r.command?.action).toBe('wakeUp')
  })
  it('command with no responses returns undefined responses', () => {
    const r = detectIntent('camina un poco', 'buddy', commands)
    expect(r.type).toBe('command')
    expect(r.command?.responses).toBeUndefined()
  })
})

describe('detectIntent — none', () => {
  it('returns none for unrelated speech', () => {
    const r = detectIntent('qué buen día hace hoy', 'buddy', commands)
    expect(r.type).toBe('none')
  })
  it('wake word takes priority over command', () => {
    const r = detectIntent('buddy duerme', 'buddy', commands)
    expect(r.type).toBe('wake_word')
  })
})
