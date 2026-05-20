import type { AiLinkCustomDomainProfile } from './ai-link-domain'

export type AiConnectionsProvider = 'gemini' | 'openai' | 'ollama'

export interface OllamaModelEntry {
  name: string
  sizeBytes: number | null
}

export interface OllamaConnectionTestInput {
  baseUrl?: string
  model?: string | null
}

export interface OllamaConnectionTestResult {
  ok: boolean
  message: string
  modelCount: number
  serverVersion?: string
  modelResponded?: boolean
  latencyMs?: number
}

/** Steuert, wann Textauszüge an die Cloud gehen. */
export type AiSnippetMode = 'off' | 'on' | 'ask'

export interface AiConnectionsSettings {
  enabled: boolean
  /** Bevorzugter Anbieter für KI-Vorschläge und Graph-Scan. */
  provider: AiConnectionsProvider
  model: string | null
  /** Basis-URL für Ollama (z. B. http://127.0.0.1:11434). */
  ollamaBaseUrl: string
  hasGeminiApiKey: boolean
  hasOpenAiApiKey: boolean
  /** API-Schlüssel bzw. Ollama-Modell für den gewählten `provider` bereit. */
  hasActiveApiKey: boolean
  consentGiven: boolean
  /** Snippet/Body-Auszug (~500 Zeichen) – Modus `on` oder pro Aufruf bei `ask`. */
  snippetMode: AiSnippetMode
  /** Legacy-Spiegel: true nur bei `snippetMode === 'on'`. */
  includeSnippet: boolean
  snippetConsentGiven: boolean
  /** Standard für Vollgraph-Scan (ohne Auswahl). */
  scanLookbackDays: number
  scanMaxAnchors: number
  minConfidence: number
  compareProviders: boolean
  customDomainProfiles: AiLinkCustomDomainProfile[]
  /** Bestehende Kanten im Graph nach KI-Qualität einfärben (wenn Bewertung vorliegt). */
  showLinkQualityOnGraph: boolean
  /** Lokaler Vektorindex (Ollama-Embeddings). */
  embeddingsEnabled: boolean
  embeddingModel: string
  /** Heuristik + Vektorsuche in entity-link-ai-retrieval. */
  embeddingHybridRetrieval: boolean
  /** Nach Mail-Sync / Notiz-Änderung im Hintergrund einbetten. */
  embeddingAutoIndex: boolean
  /** Vorschläge aus Vektorähnlichkeit ohne LLM (schnell). */
  embeddingFastSuggestions: boolean
}

export interface AiConnectionsSetSettingsInput {
  enabled?: boolean
  provider?: AiConnectionsProvider
  model?: string | null
  ollamaBaseUrl?: string
  consentGiven?: boolean
  snippetMode?: AiSnippetMode
  /** Legacy: true → snippetMode `on`. */
  includeSnippet?: boolean
  snippetConsentGiven?: boolean
  scanLookbackDays?: number
  scanMaxAnchors?: number
  minConfidence?: number
  compareProviders?: boolean
  customDomainProfiles?: AiLinkCustomDomainProfile[]
  showLinkQualityOnGraph?: boolean
  embeddingsEnabled?: boolean
  embeddingModel?: string
  embeddingHybridRetrieval?: boolean
  embeddingAutoIndex?: boolean
  embeddingFastSuggestions?: boolean
}

/** Einstellungen ohne API-Keys (Sicherungsdatei). */
export interface AiConnectionsSettingsBackupSnapshot {
  enabled: boolean
  provider: AiConnectionsProvider
  model: string | null
  ollamaBaseUrl: string
  consentGiven: boolean
  snippetMode: AiSnippetMode
  includeSnippet: boolean
  snippetConsentGiven: boolean
  scanLookbackDays: number
  scanMaxAnchors: number
  minConfidence: number
  compareProviders: boolean
  customDomainProfiles: AiLinkCustomDomainProfile[]
  showLinkQualityOnGraph: boolean
  embeddingsEnabled: boolean
  embeddingModel: string
  embeddingHybridRetrieval: boolean
  embeddingAutoIndex: boolean
  embeddingFastSuggestions: boolean
}

export function isEmbeddingPipelineActive(settings: AiConnectionsSettings): boolean {
  return settings.embeddingsEnabled && Boolean(settings.ollamaBaseUrl?.trim())
}

export interface AiConnectionsSetApiKeyInput {
  provider: AiConnectionsProvider
  apiKey: string
}

export function aiConnectionsHasActiveApiKey(settings: AiConnectionsSettings): boolean {
  if (settings.provider === 'ollama') {
    return Boolean(settings.model?.trim())
  }
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
