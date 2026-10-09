import { invoke } from '@tauri-apps/api/core'
import { useCallback } from 'react'

export function usePassthrough() {
  const setIgnore = useCallback((ignore: boolean): Promise<void> => {
    return invoke<void>('set_ignore_cursor', { ignore }).catch((err: unknown) => {
      console.error('[passthrough] set_ignore_cursor failed:', err)
      throw err
    })
  }, [])

  return { setIgnore }
}
