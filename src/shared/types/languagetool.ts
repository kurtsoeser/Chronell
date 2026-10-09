import type { LanguageToolCheckResponse } from '../languagetool'

export type { LanguageToolCheckResponse, LanguageToolMatch } from '../languagetool'

export interface LanguageToolCheckInput {
  text: string
  language?: string
  apiBaseUrl?: string
  /** LanguageTool-Premium: E-Mail / Benutzername (optional, aus Einstellungen). */
  username?: string
}

export type LanguageToolCheckOutput = LanguageToolCheckResponse

export interface LanguageToolCredentialsStatus {
  hasApiKey: boolean
}

export interface LanguageToolSetApiKeyInput {
  apiKey: string | null
}
