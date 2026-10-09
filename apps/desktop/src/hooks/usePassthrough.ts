import { invoke } from '@tauri-apps/api/core'
import { useCallback } from 'react'

export function usePassthrough() {
  const setIgnore = useCallback((ignore: boolean) => {
    invoke('set_ignore_cursor', { ignore }).catch(console.error)
  }, [])

  return { setIgnore }
}
