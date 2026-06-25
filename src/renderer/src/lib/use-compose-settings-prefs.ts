import { useEffect, useState } from 'react'
import {
  COMPOSE_SETTINGS_PREFS_CHANGED_EVENT,
  readComposeSettingsPrefs,
  type ComposeSettingsPrefsV1
} from '@/lib/compose-settings-prefs'

export function useComposeSettingsPrefs(): ComposeSettingsPrefsV1 {
  const [prefs, setPrefs] = useState<ComposeSettingsPrefsV1>(() => readComposeSettingsPrefs())

  useEffect(() => {
    const onChanged = (): void => setPrefs(readComposeSettingsPrefs())
    window.addEventListener(COMPOSE_SETTINGS_PREFS_CHANGED_EVENT, onChanged)
    return (): void => window.removeEventListener(COMPOSE_SETTINGS_PREFS_CHANGED_EVENT, onChanged)
  }, [])

  return prefs
}
