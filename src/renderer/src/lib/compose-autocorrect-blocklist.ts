import { patchComposeSettingsPrefs, readComposeSettingsPrefs } from '@/lib/compose-settings-prefs'
import {
  parseComposeAutoCorrectBlocklistText,
  setComposeAutoCorrectRuntime
} from '@/lib/compose-autocorrect-runtime'

/** Wort zur Autokorrektur-Ausnahmeliste hinzufügen (Einstellungen + Laufzeit). */
export function addWordToComposeAutoCorrectBlocklist(word: string): boolean {
  const trimmed = word.trim()
  if (!trimmed) return false
  const lower = trimmed.toLowerCase()
  const prefs = readComposeSettingsPrefs()
  const set = parseComposeAutoCorrectBlocklistText(prefs.composeAutoCorrectBlocklistText)
  if (set.has(lower)) return false
  set.add(lower)
  const composeAutoCorrectBlocklistText = [...set].sort((a, b) => a.localeCompare(b, 'de')).join('\n')
  patchComposeSettingsPrefs({ composeAutoCorrectBlocklistText })
  setComposeAutoCorrectRuntime({
    enabled: prefs.composeAutoCorrectOnSpace,
    blocklist: set
  })
  return true
}
