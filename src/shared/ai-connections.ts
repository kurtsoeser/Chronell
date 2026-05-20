export type AiConnectionsProvider = 'gemini' | 'openai'

export interface AiConnectionsSettings {
  enabled: boolean
  /** Bevorzugter Anbieter für KI-Vorschläge und Graph-Scan. */
  provider: AiConnectionsProvider
  model: string | null
  hasGeminiApiKey: boolean
  hasOpenAiApiKey: boolean
  /** API-Schlüssel für den gewählten `provider` vorhanden. */
  hasActiveApiKey: boolean
  consentGiven: boolean
  /** Snippet/Body-Auszug (~500 Zeichen) mitsenden – erfordert `snippetConsentGiven`. */
  includeSnippet: boolean
  snippetConsentGiven: boolean
  /** Standard für Vollgraph-Scan (ohne Auswahl). */
  scanLookbackDays: number
  scanMaxAnchors: number
  minConfidence: number
  compareProviders: boolean
}

export interface AiConnectionsSetSettingsInput {
  enabled?: boolean
  provider?: AiConnectionsProvider
  model?: string | null
  consentGiven?: boolean
  includeSnippet?: boolean
  snippetConsentGiven?: boolean
  scanLookbackDays?: number
  scanMaxAnchors?: number
  minConfidence?: number
  compareProviders?: boolean
}

/** Einstellungen ohne API-Keys (Sicherungsdatei). */
export interface AiConnectionsSettingsBackupSnapshot {
  enabled: boolean
  provider: AiConnectionsProvider
  model: string | null
  consentGiven: boolean
  includeSnippet: boolean
  snippetConsentGiven: boolean
  scanLookbackDays: number
  scanMaxAnchors: number
  minConfidence: number
  compareProviders: boolean
}

export interface AiConnectionsSetApiKeyInput {
  provider: AiConnectionsProvider
  apiKey: string
}

export function aiConnectionsHasActiveApiKey(settings: AiConnectionsSettings): boolean {
  return settings.provider === 'openai' ? settings.hasOpenAiApiKey : settings.hasGeminiApiKey
}

export type AiConnectionsErrorCode =
  | 'disabled'
  | 'no_api_key'
  | 'consent_required'
  | 'network'
  | 'provider_error'
  | 'invalid_response'

export class AiConnectionsError extends Error {
  readonly code: AiConnectionsErrorCode

  constructor(code: AiConnectionsErrorCode, message: string) {
    super(message)
    this.name = 'AiConnectionsError'
    this.code = code
  }
}
