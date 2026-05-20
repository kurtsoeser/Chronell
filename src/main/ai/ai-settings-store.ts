import { app } from 'electron'
import { existsSync } from 'node:fs'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import type {
  AiConnectionsProvider,
  AiConnectionsSettings,
  AiConnectionsSettingsBackupSnapshot,
  AiConnectionsSetSettingsInput
} from '@shared/ai-connections'
import { AiConnectionsError } from '@shared/ai-connections'
import { readSecure, writeSecure } from '../secure-store'

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
  consentGiven: boolean
  includeSnippet: boolean
  snippetConsentGiven: boolean
  scanLookbackDays: number
  scanMaxAnchors: number
  minConfidence: number
  compareProviders: boolean
}

const DEFAULT_PERSISTED: PersistedAiConnectionsSettings = {
  enabled: false,
  provider: 'gemini',
  model: null,
  consentGiven: false,
  includeSnippet: false,
  snippetConsentGiven: false,
  scanLookbackDays: 90,
  scanMaxAnchors: 50,
  minConfidence: 0.65,
  compareProviders: false
}

function settingsPath(): string {
  return join(app.getPath('userData'), 'ai-connections-settings.json')
}

function storeNameForProvider(provider: AiConnectionsProvider): string {
  return provider === 'openai' ? API_KEY_STORE_OPENAI : API_KEY_STORE_GEMINI
}

async function readPersisted(): Promise<PersistedAiConnectionsSettings> {
  const path = settingsPath()
  if (!existsSync(path)) return { ...DEFAULT_PERSISTED }
  try {
    const raw = await readFile(path, 'utf8')
    const parsed = JSON.parse(raw) as Partial<PersistedAiConnectionsSettings>
    return {
      enabled: parsed.enabled === true,
      provider: parsed.provider === 'openai' ? 'openai' : 'gemini',
      model: typeof parsed.model === 'string' && parsed.model.trim() ? parsed.model.trim() : null,
      consentGiven: parsed.consentGiven === true,
      includeSnippet: parsed.includeSnippet === true,
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
      compareProviders: parsed.compareProviders === true
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
  const key = await readSecure(storeNameForProvider(provider))
  return typeof key === 'string' && key.trim().length > 0
}

export async function getAiConnectionsSettings(): Promise<AiConnectionsSettings> {
  await migrateLegacyApiKeyIfNeeded()
  const persisted = await readPersisted()
  const hasGeminiApiKey = await hasProviderApiKey('gemini')
  const hasOpenAiApiKey = await hasProviderApiKey('openai')
  const hasActiveApiKey =
    persisted.provider === 'openai' ? hasOpenAiApiKey : hasGeminiApiKey
  return {
    ...persisted,
    hasGeminiApiKey,
    hasOpenAiApiKey,
    hasActiveApiKey
  }
}

export async function setAiConnectionsSettings(
  input: AiConnectionsSetSettingsInput
): Promise<AiConnectionsSettings> {
  const current = await readPersisted()
  const next: PersistedAiConnectionsSettings = {
    enabled: input.enabled ?? current.enabled,
    provider: input.provider ?? current.provider,
    model: input.model !== undefined ? input.model : current.model,
    consentGiven: input.consentGiven ?? current.consentGiven,
    includeSnippet: input.includeSnippet ?? current.includeSnippet,
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
    compareProviders: input.compareProviders ?? current.compareProviders
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
  if (next.includeSnippet && !next.snippetConsentGiven) {
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
  const trimmed = apiKey.trim()
  if (!trimmed) {
    throw new Error('API-Schlüssel darf nicht leer sein.')
  }
  await writeSecure(storeNameForProvider(provider), trimmed)
  return getAiConnectionsSettings()
}

export async function clearAiConnectionsApiKey(
  provider: AiConnectionsProvider
): Promise<AiConnectionsSettings> {
  await writeSecure(storeNameForProvider(provider), '')
  return getAiConnectionsSettings()
}

export async function readAiConnectionsApiKey(
  provider: AiConnectionsProvider
): Promise<string | null> {
  const key = await readSecure(storeNameForProvider(provider))
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
  return resolveGeminiModel(settings.model)
}

export async function assertAiConnectionsReady(): Promise<{
  settings: AiConnectionsSettings
  apiKey: string
  model: string
}> {
  const settings = await getAiConnectionsSettings()
  if (!settings.enabled) {
    throw new AiConnectionsError('disabled', 'KI-Verbindungen sind deaktiviert.')
  }
  if (!settings.consentGiven) {
    throw new AiConnectionsError(
      'consent_required',
      'Bitte bestätigen Sie den Hinweis zu Metadaten und Cloud-KI.'
    )
  }
  const apiKey = await readAiConnectionsApiKey(settings.provider)
  if (!apiKey) {
    const label = settings.provider === 'openai' ? 'OpenAI' : 'Google Gemini'
    throw new AiConnectionsError(
      'no_api_key',
      `Kein API-Schlüssel für ${label} hinterlegt. Bitte in den Einstellungen unter KI-Verbindungen speichern.`
    )
  }
  return { settings, apiKey, model: resolveAiModel(settings) }
}

export async function exportAiConnectionsSettingsForBackup(): Promise<AiConnectionsSettingsBackupSnapshot> {
  const p = await readPersisted()
  return {
    enabled: p.enabled,
    provider: p.provider,
    model: p.model,
    consentGiven: p.consentGiven,
    includeSnippet: p.includeSnippet,
    snippetConsentGiven: p.snippetConsentGiven,
    scanLookbackDays: p.scanLookbackDays,
    scanMaxAnchors: p.scanMaxAnchors,
    minConfidence: p.minConfidence,
    compareProviders: p.compareProviders
  }
}

export async function importAiConnectionsSettingsFromBackup(
  snapshot: AiConnectionsSettingsBackupSnapshot
): Promise<void> {
  const current = await readPersisted()
  await writePersisted({
    enabled: snapshot.enabled === true,
    provider: snapshot.provider === 'openai' ? 'openai' : 'gemini',
    model: typeof snapshot.model === 'string' && snapshot.model.trim() ? snapshot.model.trim() : null,
    consentGiven: snapshot.consentGiven === true,
    includeSnippet: snapshot.includeSnippet === true,
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
    compareProviders: snapshot.compareProviders === true
  })
}
