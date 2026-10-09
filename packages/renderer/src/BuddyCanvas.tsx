import { useRive, useStateMachineInput } from '@rive-app/react-canvas'
import { useEffect } from 'react'
import type { AvatarState } from '@buddy/types'

interface Props {
  riveFile: string
  stateMachine: string
  state: AvatarState
  size: number
}

export function BuddyCanvas({ riveFile, stateMachine, state, size }: Props) {
  const { rive, RiveComponent } = useRive({
    src: riveFile,
    stateMachines: stateMachine,
    autoplay: true,
  })

  const stateInput = useStateMachineInput(rive, stateMachine, 'state')

  useEffect(() => {
    if (!stateInput) return
    const stateMap: Record<AvatarState, number> = {
      idle: 0, walk: 1, talk: 2, think: 3, react_happy: 4, sleep: 5,
    }
    stateInput.value = stateMap[state]
  }, [state, stateInput])

  return <RiveComponent style={{ width: size, height: size }} />
}
