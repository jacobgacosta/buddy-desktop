import { describe, it, expect, vi } from 'vitest'
import { AvatarStateMachine } from '../avatar-state'

describe('AvatarStateMachine', () => {
  it('starts in idle state', () => {
    const sm = new AvatarStateMachine()
    expect(sm.state).toBe('idle')
  })

  it('transitions to think when sendMessage is called', () => {
    const sm = new AvatarStateMachine()
    sm.sendMessage()
    expect(sm.state).toBe('think')
  })

  it('transitions to talk when response arrives', () => {
    const sm = new AvatarStateMachine()
    sm.sendMessage()
    sm.receiveResponse()
    expect(sm.state).toBe('talk')
  })

  it('returns to idle after talk finishes', () => {
    const sm = new AvatarStateMachine()
    sm.sendMessage()
    sm.receiveResponse()
    sm.finishTalking()
    expect(sm.state).toBe('idle')
  })

  it('calls onStateChange callback on every transition', () => {
    const onChange = vi.fn()
    const sm = new AvatarStateMachine(onChange)
    sm.sendMessage()
    expect(onChange).toHaveBeenCalledWith('think')
  })

  it('enters sleep after setSleep()', () => {
    const sm = new AvatarStateMachine()
    sm.setSleep()
    expect(sm.state).toBe('sleep')
  })

  it('wakes to idle from sleep on sendMessage', () => {
    const sm = new AvatarStateMachine()
    sm.setSleep()
    sm.sendMessage()
    expect(sm.state).toBe('think')
  })

  it('transitions idle → react_happy on reactHappy()', () => {
    const sm = new AvatarStateMachine()
    sm.reactHappy()
    expect(sm.state).toBe('react_happy')
  })

  it('transitions react_happy → idle on finishReacting()', () => {
    const sm = new AvatarStateMachine()
    sm.reactHappy()
    sm.finishReacting()
    expect(sm.state).toBe('idle')
  })

  it('ignores reactHappy() when not idle', () => {
    const sm = new AvatarStateMachine()
    sm.startWalking()
    sm.reactHappy()
    expect(sm.state).toBe('walk')
  })
})
