import { useEffect, useState } from 'react'
import {
  NOTES_SETTINGS_PREFS_CHANGED_EVENT,
  readNotesSettingsPrefs,
  type NotesSettingsPrefsV1
} from '@/lib/notes-settings-prefs'

export function useNotesSettingsPrefs(): NotesSettingsPrefsV1 {
  const [prefs, setPrefs] = useState<NotesSettingsPrefsV1>(() => readNotesSettingsPrefs())

  useEffect(() => {
    const onChanged = (): void => setPrefs(readNotesSettingsPrefs())
    window.addEventListener(NOTES_SETTINGS_PREFS_CHANGED_EVENT, onChanged)
    return (): void => window.removeEventListener(NOTES_SETTINGS_PREFS_CHANGED_EVENT, onChanged)
  }, [])

  return prefs
}
