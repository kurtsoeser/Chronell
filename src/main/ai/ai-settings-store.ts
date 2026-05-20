import { app } from 'electron'
import { existsSync } from 'node:fs'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { AiLinkCustomDomainProfile } from '@shared/ai-link-domain'
import type {
  AiConnectionsProvider,
  AiConnectionsSettings,
  AiConnectionsSettingsBackupSnapshot,
  AiConnectionsSetSettingsInput,
  AiSnippetMode
} from '@shared/ai-connections'
import { normalizeCustomDomainProfiles } from './entity-link-ai-prompts'
import { snippetModeToIncludeSnippet } from './ai-snippet-policy'
import { AiConnectionsError, aiConnectionsHasActiveApiKey } from '@shared/ai-connections'
import { DEFAULT_EMBEDDING_MODEL } from '@shared/entity-embeddings'
import { readSecure, writeSecure } from '../secure-store'
import { DEFAULT_OLLAMA_BASE_URL, normalizeOllamaBaseUrl } from './ollama-provider'

const API_KEY_STORE_GEMINI = 'ai-connections-api-key-gemini'
const API_KEY_STORE_OPENAI = 'ai-connections-api-key-openai'
const API_KEY_STORE_LEGACY = 'ai-connections-api-key'

/** GA-Ersatz für abgeschaltetes gemini-2.0-flash (neue API-Keys). */
const DEFAULT_MODEL_GEMINI = 'gemini-2.5-flash'

const DEPRECATED_GEMINI_MODELS: Record<string, string> = {
  'gemini-2.0-flash': 'gemini-2.5-flash',
  'gemini-2.0-flash-001': 'gemini-2.5-flash',
  'gemini-2.0-flash-lite': 'gemini-2.5-flash-lite',
  'gemini-2.0-flash-lite-001': 'gemini-2.5-flash-lite'
}

interface PersistedAiConnectionsSettings {
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

function parseSnippetMode(parsed: Partial<PersistedAiConnectionsSettings>): AiSnippetMode {
  if (
    parsed.snippetMode === 'on' ||
    parsed.snippetMode === 'ask' ||
    parsed.snippetMode === 'off'
  ) {
    return parsed.snippetMode
  }
  return parsed.includeSnippet === true ? 'on' : 'off'
}

function parseProvider(value: unknown): AiConnectionsProvider {
  if (value === 'openai') return 'openai'
  if (value === 'ollama') return 'ollama'
  return 'gemini'
}

const DEFAULT_PERSISTED: PersistedAiConnectionsSettings = {
  enabled: false,
  provider: 'gemini',
  model: null,
  ollamaBaseUrl: DEFAULT_OLLAMA_BASE_URL,
  consentGiven: false,
  snippetMode: 'off',
  includeSnippet: false,
  snippetConsentGiven: false,
  scanLookbackDays: 90,
  scanMaxAnchors: 50,
  minConfidence: 0.65,
  compareProviders: false,
  customDomainProfiles: [],
  showLinkQualityOnGraph: false,
  embeddingsEnabled: true,
  embeddingModel: DEFAULT_EMBEDDING_MODEL,
  embeddingHybridRetrieval: true,
  embeddingAutoIndex: true,
  embeddingFastSuggestions: true
}

function settingsPath(): string {
  return join(app.getPath('userData'), 'ai-connections-settings.json')
}

function storeNameForProvider(provider: AiConnectionsProvider): string | null {
  if (provider === 'openai') return API_KEY_STORE_OPENAI
  if (provider === 'gemini') return API_KEY_STORE_GEMINI
  return null
}

async function readPersisted(): Promise<PersistedAiConnectionsSettings> {
  const path = settingsPath()
  if (!existsSync(path)) return { ...DEFAULT_PERSISTED }
  try {
    const raw = await readFile(path, 'utf8')
    const parsed = JSON.parse(raw) as Partial<PersistedAiConnectionsSettings>
    return {
      enabled: parsed.enabled === true,
      provider: parseProvider(parsed.provider),
      model: typeof parsed.model === 'string' && parsed.model.trim() ? parsed.model.trim() : null,
      ollamaBaseUrl: normalizeOllamaBaseUrl(
        typeof parsed.ollamaBaseUrl === 'string' ? parsed.ollamaBaseUrl : DEFAULT_OLLAMA_BASE_URL
      ),
      consentGiven: parsed.consentGiven === true,
      snippetMode: parseSnippetMode(parsed),
      includeSnippet: parseSnippetMode(parsed) === 'on',
      snippetConsentGiven: parsed.snippetConsentGiven === true,
      scanLookbackDays:
        typeof parsed.scanLookbackDays === 'number'
          ? Math.min(Math.max(Math.round(parsed.scanLookbackDays), 7), 365)
          : DEFAULT_PERSISTED.scanLookbackDays,
      scanMaxAnchors:
        typeof parsed.scanMaxAnchors === 'number'
          ? Math.min(Math.max(Math.round(parsed.scanMaxAnchors), 1), 50)
          : DEFAULT_PERSISTED.scanMaxAnchors,
      minConfidence:
        typeof parsed.minConfidence === 'number'
          ? Math.min(Math.max(parsed.minConfidence, 0.5), 0.95)
          : DEFAULT_PERSISTED.minConfidence,
      compareProviders: parsed.compareProviders === true,
      customDomainProfiles: normalizeCustomDomainProfiles(parsed.customDomainProfiles),
      showLinkQualityOnGraph: parsed.showLinkQualityOnGraph === true,
      embeddingsEnabled: parsed.embeddingsEnabled !== false,
      embeddingModel:
        typeof parsed.embeddingModel === 'string' && parsed.embeddingModel.trim()
          ? parsed.embeddingModel.trim()
          : DEFAULT_EMBEDDING_MODEL,
      embeddingHybridRetrieval: parsed.embeddingHybridRetrieval !== false,
      embeddingAutoIndex: parsed.embeddingAutoIndex !== false,
      embeddingFastSuggestions: parsed.embeddingFastSuggestions !== false
    }
  } catch {
    return { ...DEFAULT_PERSISTED }
  }
}

async function writePersisted(data: PersistedAiConnectionsSettings): Promise<void> {
  const path = settingsPath()
  await mkdir(join(app.getPath('userData')), { recursive: true })
  await writeFile(path, JSON.stringify(data, null, 2), 'utf8')
}

/** Früher ein gemeinsamer Key — nach Gemini migrieren. */
async function migrateLegacyApiKeyIfNeeded(): Promise<void> {
  const legacy = await readSecure(API_KEY_STORE_LEGACY)
  if (!legacy?.trim()) return
  const gemini = await readSecure(API_KEY_STORE_GEMINI)
  if (!gemini?.trim()) {
    await writeSecure(API_KEY_STORE_GEMINI, legacy.trim())
  }
  await writeSecure(API_KEY_STORE_LEGACY, '')
}

async function hasProviderApiKey(provider: AiConnectionsProvider): Promise<boolean> {
  const store = storeNameForProvider(provider)
  if (!store) return false
  const key = await readSecure(store)
  return typeof key === 'string' && key.trim().length > 0
}

export async function getAiConnectionsSettings(): Promise<AiConnectionsSettings> {
  await migrateLegacyApiKeyIfNeeded()
  const persisted = await readPersisted()
  const hasGeminiApiKey = await hasProviderApiKey('gemini')
  const hasOpenAiApiKey = await hasProviderApiKey('openai')
  const view: AiConnectionsSettings = {
    ...persisted,
    hasGeminiApiKey,
    hasOpenAiApiKey,
    hasActiveApiKey: false
  }
  view.hasActiveApiKey = aiConnectionsHasActiveApiKey(view)
  return view
}

export async function setAiConnectionsSettings(
  input: AiConnectionsSetSettingsInput
): Promise<AiConnectionsSettings> {
  const current = await readPersisted()
  const next: PersistedAiConnectionsSettings = {
    enabled: input.enabled ?? current.enabled,
    provider: input.provider ?? current.provider,
    model: input.model !== undefined ? input.model : current.model,
    ollamaBaseUrl:
      input.ollamaBaseUrl !== undefined
        ? normalizeOllamaBaseUrl(input.ollamaBaseUrl)
        : current.ollamaBaseUrl,
    consentGiven: input.consentGiven ?? current.consentGiven,
    snippetMode:
      input.snippetMode ??
      (input.includeSnippet !== undefined
        ? input.includeSnippet
          ? 'on'
          : current.snippetMode === 'on'
            ? 'off'
            : current.snippetMode
        : current.snippetMode),
    snippetConsentGiven: input.snippetConsentGiven ?? current.snippetConsentGiven,
    scanLookbackDays:
      input.scanLookbackDays !== undefined
        ? Math.min(Math.max(Math.round(input.scanLookbackDays), 7), 365)
        : current.scanLookbackDays,
    scanMaxAnchors:
      input.scanMaxAnchors !== undefined
        ? Math.min(Math.max(Math.round(input.scanMaxAnchors), 1), 50)
        : current.scanMaxAnchors,
    minConfidence:
      input.minConfidence !== undefined
        ? Math.min(Math.max(input.minConfidence, 0.5), 0.95)
        : current.minConfidence,
    compareProviders: input.compareProviders ?? current.compareProviders,
    customDomainProfiles:
      input.customDomainProfiles !== undefined
        ? normalizeCustomDomainProfiles(input.customDomainProfiles)
        : current.customDomainProfiles,
    showLinkQualityOnGraph:
      input.showLinkQualityOnGraph ?? current.showLinkQualityOnGraph,
    embeddingsEnabled: input.embeddingsEnabled ?? current.embeddingsEnabled,
    embeddingModel:
      input.embeddingModel !== undefined
        ? input.embeddingModel.trim() || DEFAULT_EMBEDDING_MODEL
        : current.embeddingModel,
    embeddingHybridRetrieval:
      input.embeddingHybridRetrieval ?? current.embeddingHybridRetrieval,
    embeddingAutoIndex: input.embeddingAutoIndex ?? current.embeddingAutoIndex,
    embeddingFastSuggestions:
      input.embeddingFastSuggestions ?? current.embeddingFastSuggestions,
    includeSnippet: false
  }
  next.includeSnippet = snippetModeToIncludeSnippet(next.snippetMode)
  if (next.provider === 'ollama') {
    next.compareProviders = false
  }
  if (next.compareProviders) {
    const hasGemini = await hasProviderApiKey('gemini')
    const hasOpenAi = await hasProviderApiKey('openai')
    if (!hasGemini || !hasOpenAi) {
      throw new AiConnectionsError(
        'no_api_key',
        'Vergleichsmodus erfordert API-Schlüssel für Gemini und OpenAI.'
      )
    }
  }
  if (next.snippetMode === 'on' && !next.snippetConsentGiven) {
    throw new AiConnectionsError(
      'consent_required',
      'Bitte bestätigen Sie den Hinweis zu Snippet/Body-Auszug.'
    )
  }
  if (next.enabled && !next.consentGiven) {
    throw new AiConnectionsError(
      'consent_required',
      'Bitte bestätigen Sie den Hinweis zu Metadaten und Cloud-KI.'
    )
  }
  await writePersisted(next)
  return getAiConnectionsSettings()
}

export async function setAiConnectionsApiKey(
  provider: AiConnectionsProvider,
  apiKey: string
): Promise<AiConnectionsSettings> {
  if (provider === 'ollama') {
    throw new Error('Ollama benötigt keinen API-Schlüssel.')
  }
  const trimmed = apiKey.trim()
  if (!trimmed) {
    throw new Error('API-Schlüssel darf nicht leer sein.')
  }
  const store = storeNameForProvider(provider)
  if (!store) throw new Error('Dieser Anbieter verwendet keinen API-Schlüssel.')
  await writeSecure(store, trimmed)
  return getAiConnectionsSettings()
}

export async function clearAiConnectionsApiKey(
  provider: AiConnectionsProvider
): Promise<AiConnectionsSettings> {
  const store = storeNameForProvider(provider)
  if (!store) return getAiConnectionsSettings()
  await writeSecure(store, '')
  return getAiConnectionsSettings()
}

export async function readAiConnectionsApiKey(
  provider: AiConnectionsProvider
): Promise<string | null> {
  const store = storeNameForProvider(provider)
  if (!store) return ''
  const key = await readSecure(store)
  if (!key?.trim()) return null
  return key.trim()
}

export function resolveGeminiModel(model: string | null | undefined): string {
  const trimmed = model?.trim()
  if (!trimmed) return DEFAULT_MODEL_GEMINI
  return DEPRECATED_GEMINI_MODELS[trimmed] ?? trimmed
}

export function resolveAiModel(settings: AiConnectionsSettings): string {
  if (settings.provider === 'openai') {
    return settings.model?.trim() || 'gpt-4o-mini'
  }
  if (settings.provider === 'ollama') {
    const trimmed = settings.model?.trim()
    if (!trimmed) {
      throw new AiConnectionsError(
        'no_api_key',
        'Bitte ein Ollama-Modell wählen (Einstellungen → KI-Verbindungen). Vorher z. B. `ollama pull nemotron3:33b`.'
      )
    }
    return trimmed
  }
  return resolveGeminiModel(settings.model)
}

export async function assertAiConnectionsReady(): Promise<{
  settings: AiConnectionsSettings
  apiKey: string
  model: string
  ollamaBaseUrl: string
}> {
  const settings = await getAiConnectionsSettings()
  if (!settings.enabled) {
    throw new AiConnectionsError('disabled', 'KI-Verbindungen sind deaktiviert.')
  }
  if (!settings.consentGiven) {
    throw new AiConnectionsError(
      'consent_required',
      settings.provider === 'ollama'
        ? 'Bitte bestätigen Sie den Hinweis zur lokalen KI (Ollama).'
        : 'Bitte bestätigen Sie den Hinweis zu Metadaten und Cloud-KI.'
    )
  }
  const model = resolveAiModel(settings)
  if (settings.provider === 'ollama') {
    return {
      settings,
      apiKey: '',
      model,
      ollamaBaseUrl: normalizeOllamaBaseUrl(settings.ollamaBaseUrl)
    }
  }
  const apiKey = await readAiConnectionsApiKey(settings.provider)
  if (!apiKey) {
    const label = settings.provider === 'openai' ? 'OpenAI' : 'Google Gemini'
    throw new AiConnectionsError(
      'no_api_key',
      `Kein API-Schlüssel für ${label} hinterlegt. Bitte in den Einstellungen unter KI-Verbindungen speichern.`
    )
  }
  return {
    settings,
    apiKey,
    model,
    ollamaBaseUrl: normalizeOllamaBaseUrl(settings.ollamaBaseUrl)
  }
}

export async function exportAiConnectionsSettingsForBackup(): Promise<AiConnectionsSettingsBackupSnapshot> {
  const p = await readPersisted()
  return {
    enabled: p.enabled,
    provider: p.provider,
    model: p.model,
    ollamaBaseUrl: p.ollamaBaseUrl,
    consentGiven: p.consentGiven,
    snippetMode: p.snippetMode,
    includeSnippet: p.includeSnippet,
    snippetConsentGiven: p.snippetConsentGiven,
    scanLookbackDays: p.scanLookbackDays,
    scanMaxAnchors: p.scanMaxAnchors,
    minConfidence: p.minConfidence,
    compareProviders: p.compareProviders,
    customDomainProfiles: p.customDomainProfiles,
    showLinkQualityOnGraph: p.showLinkQualityOnGraph,
    embeddingsEnabled: p.embeddingsEnabled,
    embeddingModel: p.embeddingModel,
    embeddingHybridRetrieval: p.embeddingHybridRetrieval,
    embeddingAutoIndex: p.embeddingAutoIndex,
    embeddingFastSuggestions: p.embeddingFastSuggestions
  }
}

export async function importAiConnectionsSettingsFromBackup(
  snapshot: AiConnectionsSettingsBackupSnapshot
): Promise<void> {
  const current = await readPersisted()
  const snippetMode: AiSnippetMode =
    snapshot.snippetMode === 'on' ||
    snapshot.snippetMode === 'ask' ||
    snapshot.snippetMode === 'off'
      ? snapshot.snippetMode
      : snapshot.includeSnippet === true
        ? 'on'
        : 'off'
  await writePersisted({
    enabled: snapshot.enabled === true,
    provider: parseProvider(snapshot.provider),
    model: typeof snapshot.model === 'string' && snapshot.model.trim() ? snapshot.model.trim() : null,
    ollamaBaseUrl: normalizeOllamaBaseUrl(
      typeof snapshot.ollamaBaseUrl === 'string'
        ? snapshot.ollamaBaseUrl
        : current.ollamaBaseUrl
    ),
    consentGiven: snapshot.consentGiven === true,
    snippetMode,
    includeSnippet: snippetModeToIncludeSnippet(snippetMode),
    snippetConsentGiven: snapshot.snippetConsentGiven === true,
    scanLookbackDays:
      typeof snapshot.scanLookbackDays === 'number'
        ? Math.min(Math.max(Math.round(snapshot.scanLookbackDays), 7), 365)
        : current.scanLookbackDays,
    scanMaxAnchors:
      typeof snapshot.scanMaxAnchors === 'number'
        ? Math.min(Math.max(Math.round(snapshot.scanMaxAnchors), 1), 50)
        : current.scanMaxAnchors,
    minConfidence:
      typeof snapshot.minConfidence === 'number'
        ? Math.min(Math.max(snapshot.minConfidence, 0.5), 0.95)
        : current.minConfidence,
    compareProviders: snapshot.compareProviders === true,
    customDomainProfiles: normalizeCustomDomainProfiles(
      snapshot.customDomainProfiles ?? current.customDomainProfiles
    ),
    showLinkQualityOnGraph:
      snapshot.showLinkQualityOnGraph === true
        ? true
        : snapshot.showLinkQualityOnGraph === false
          ? false
          : current.showLinkQualityOnGraph,
    embeddingsEnabled:
      snapshot.embeddingsEnabled === false
        ? false
        : snapshot.embeddingsEnabled === true
          ? true
          : current.embeddingsEnabled,
    embeddingModel:
      typeof snapshot.embeddingModel === 'string' && snapshot.embeddingModel.trim()
        ? snapshot.embeddingModel.trim()
        : current.embeddingModel,
    embeddingHybridRetrieval:
      snapshot.embeddingHybridRetrieval === false
        ? false
        : snapshot.embeddingHybridRetrieval === true
          ? true
          : current.embeddingHybridRetrieval,
    embeddingAutoIndex:
      snapshot.embeddingAutoIndex === false
        ? false
        : snapshot.embeddingAutoIndex === true
          ? true
          : current.embeddingAutoIndex,
    embeddingFastSuggestions:
      snapshot.embeddingFastSuggestions === false
        ? false
        : snapshot.embeddingFastSuggestions === true
          ? true
          : current.embeddingFastSuggestions
  })
}
