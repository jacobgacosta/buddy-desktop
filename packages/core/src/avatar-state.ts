import type { AvatarState } from '@buddy/types'

export class AvatarStateMachine {
  private _state: AvatarState = 'idle'

  constructor(private readonly onChange?: (state: AvatarState) => void) {}

  get state(): AvatarState {
    return this._state
  }

  private transition(next: AvatarState) {
    this._state = next
    this.onChange?.(next)
  }

  sendMessage() {
    this.transition('think')
  }

  receiveResponse() {
    if (this._state === 'think') this.transition('talk')
  }

  finishTalking() {
    if (this._state === 'talk') this.transition('idle')
  }

  setSleep() {
    if (this._state === 'idle') this.transition('sleep')
  }

  wakeUp() {
    if (this._state === 'sleep') this.transition('idle')
  }

  startWalking() {
    if (this._state === 'idle') this.transition('walk')
  }

  stopWalking() {
    if (this._state === 'walk') this.transition('idle')
  }

  reactHappy() {
    if (this._state === 'idle') this.transition('react_happy')
  }

  finishReacting() {
    if (this._state === 'react_happy') this.transition('idle')
  }
}
