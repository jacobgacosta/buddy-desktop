import { useRive, useStateMachineInput } from '@rive-app/react-canvas'
import { useEffect, useState } from 'react'
import type { AvatarState } from '@buddy/types'

interface Props {
  riveFile: string
  stateMachine: string
  state: AvatarState
  size: number
}

const STATE_EMOJI: Record<AvatarState, string> = {
  idle: '🦊', walk: '🦊', talk: '🦊', think: '🤔', react_happy: '🥰', sleep: '😴',
}

export function BuddyCanvas({ riveFile, stateMachine, state, size }: Props) {
  const [loadError, setLoadError] = useState(false)

  const { rive, RiveComponent } = useRive({
    src: riveFile,
    stateMachines: stateMachine,
    autoplay: true,
    onLoadError: () => setLoadError(true),
  })

  const stateInput = useStateMachineInput(rive, stateMachine, 'state')

  useEffect(() => {
    if (!stateInput) return
    const stateMap: Record<AvatarState, number> = {
      idle: 0, walk: 1, talk: 2, think: 3, react_happy: 4, sleep: 5,
    }
    stateInput.value = stateMap[state]
  }, [state, stateInput])

  if (loadError) {
    return (
      <div style={{
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.75,
        userSelect: 'none',
      }}>
        {STATE_EMOJI[state]}
      </div>
    )
  }

  return <RiveComponent style={{ width: size, height: size }} />
}
