import { useCallback, useEffect, useState } from 'react'
import type { AiConnectionsSettings } from '@shared/ai-connections'

export function useAiConnectionsSettings(): {
  settings: AiConnectionsSettings | null
  loading: boolean
  refresh: () => void
} {
  const [settings, setSettings] = useState<AiConnectionsSettings | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback((): void => {
    const fn = window.mailClient?.aiConnections?.getSettings
    if (typeof fn !== 'function') {
      setSettings(null)
      setLoading(false)
      return
    }
    setLoading(true)
    void fn()
      .then((s) => setSettings(s))
      .catch(() => setSettings(null))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { settings, loading, refresh }
}
