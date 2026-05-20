import type { AiConnectionsSettings } from '@shared/ai-connections'

export type AiSnippetMode = AiConnectionsSettings['snippetMode']

/** Ob für diesen Aufruf ein Textauszug an die KI gehen darf. */
export function resolveIncludeExcerpt(
  settings: AiConnectionsSettings,
  callIncludeExcerpt?: boolean
): boolean {
  if (!settings.snippetConsentGiven) return false
  switch (settings.snippetMode) {
    case 'on':
      return true
    case 'ask':
      return callIncludeExcerpt === true
    case 'off':
    default:
      return false
  }
}

/** Legacy-Felder beim Speichern synchron halten. */
export function snippetModeToIncludeSnippet(mode: AiSnippetMode): boolean {
  return mode === 'on'
}
