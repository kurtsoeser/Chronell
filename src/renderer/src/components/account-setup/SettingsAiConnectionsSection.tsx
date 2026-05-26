import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { AiLinkCustomDomainProfile } from '@shared/ai-link-domain'
import type {
  AiConnectionsProvider,
  AiConnectionsSettings,
  OllamaConnectionTestResult,
  OllamaModelEntry
} from '@shared/ai-connections'
import type { EntityEmbeddingIndexStatus } from '@shared/entity-embeddings'
import { isCompactOllamaModel } from '@shared/ai-prompt-tier'
import { cn } from '@/lib/utils'

export function SettingsAiConnectionsSection(): JSX.Element {
  const { t } = useTranslation()
  const [settings, setSettings] = useState<AiConnectionsSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [geminiKeyDraft, setGeminiKeyDraft] = useState('')
  const [openAiKeyDraft, setOpenAiKeyDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [consentOpen, setConsentOpen] = useState(false)
  const [snippetConsentOpen, setSnippetConsentOpen] = useState(false)
  const [ollamaModels, setOllamaModels] = useState<OllamaModelEntry[]>([])
  const [ollamaModelsLoading, setOllamaModelsLoading] = useState(false)
  const [ollamaModelsError, setOllamaModelsError] = useState<string | null>(null)
  const [ollamaTestLoading, setOllamaTestLoading] = useState(false)
  const [ollamaTestResult, setOllamaTestResult] = useState<OllamaConnectionTestResult | null>(
    null
  )
  const [embedStatus, setEmbedStatus] = useState<EntityEmbeddingIndexStatus | null>(null)
  const [embedRebuildBusy, setEmbedRebuildBusy] = useState(false)
  const [auditRows, setAuditRows] = useState<
    Array<{
      id: number
      kind: string
      anchorKey: string | null
      provider: string | null
      charEstimate: number
      includeExcerpt: boolean
      createdAt: string
    }>
  >([])

  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    try {
      const s = await window.mailClient.aiConnections.getSettings()
      setSettings(s)
    } catch {
      setSettings(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadEmbedStatus = useCallback(async (): Promise<void> => {
    try {
      const s = await window.mailClient.aiConnections.getEmbeddingIndexStatus()
      setEmbedStatus(s)
    } catch {
      setEmbedStatus(null)
    }
  }, [])

  useEffect(() => {
    void load()
    void loadEmbedStatus()
  }, [load, loadEmbedStatus])

  useEffect(() => {
    if (!embedStatus?.rebuildRunning) return
    const id = window.setInterval(() => void loadEmbedStatus(), 1500)
    return (): void => window.clearInterval(id)
  }, [embedStatus?.rebuildRunning, loadEmbedStatus])

  const refreshOllamaModels = useCallback(async (baseUrl?: string): Promise<void> => {
    setOllamaModelsLoading(true)
    setOllamaModelsError(null)
    try {
      const list = await window.mailClient.aiConnections.listOllamaModels(baseUrl)
      setOllamaModels(list)
      if (list.length === 0) {
        setOllamaModelsError(t('settings.aiConnections.ollamaModelsEmpty'))
      }
    } catch (err) {
      setOllamaModels([])
      setOllamaModelsError(
        err instanceof Error ? err.message : t('settings.aiConnections.ollamaModelsError')
      )
    } finally {
      setOllamaModelsLoading(false)
    }
  }, [t])

  useEffect(() => {
    if (settings?.provider === 'ollama') {
      void refreshOllamaModels(settings.ollamaBaseUrl)
    }
  }, [settings?.provider, settings?.ollamaBaseUrl, refreshOllamaModels])

  useEffect(() => {
    if (!settings?.enabled) {
      setAuditRows([])
      return
    }
    void window.mailClient.entityLinks
      .listAiAudit(12)
      .then(setAuditRows)
      .catch(() => setAuditRows([]))
  }, [settings?.enabled, busy])

  async function persist(
    patch: Parameters<typeof window.mailClient.aiConnections.setSettings>[0]
  ): Promise<void> {
    setBusy(true)
    setMessage(null)
    try {
      const next = await window.mailClient.aiConnections.setSettings(patch)
      setSettings(next)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t('settings.aiConnections.saveError'))
    } finally {
      setBusy(false)
    }
  }

  async function saveApiKey(
    provider: AiConnectionsProvider,
    apiKey: string
  ): Promise<void> {
    if (!apiKey.trim()) return
    setBusy(true)
    setMessage(null)
    try {
      const next = await window.mailClient.aiConnections.setApiKey({ provider, apiKey: apiKey.trim() })
      setSettings(next)
      if (provider === 'gemini') setGeminiKeyDraft('')
      else setOpenAiKeyDraft('')
      setMessage(t('settings.aiConnections.keySaved'))
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t('settings.aiConnections.saveError'))
    } finally {
      setBusy(false)
    }
  }

  async function clearApiKey(provider: AiConnectionsProvider): Promise<void> {
    setBusy(true)
    setMessage(null)
    try {
      const next = await window.mailClient.aiConnections.clearApiKey(provider)
      setSettings(next)
      if (provider === 'gemini') setGeminiKeyDraft('')
      else setOpenAiKeyDraft('')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t('settings.aiConnections.saveError'))
    } finally {
      setBusy(false)
    }
  }

  async function confirmConsent(): Promise<void> {
    setConsentOpen(false)
    await persist({ consentGiven: true, enabled: true })
  }

  async function confirmSnippetConsent(): Promise<void> {
    setSnippetConsentOpen(false)
    await persist({ snippetConsentGiven: true, snippetMode: 'on' })
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        {t('common.loading')}
      </div>
    )
  }

  if (!settings) {
    return <p className="text-xs text-muted-foreground">{t('settings.aiConnections.loadError')}</p>
  }

  const isOllama = settings.provider === 'ollama'
  const usesCompactPrompts =
    isOllama && Boolean(settings.model?.trim()) && isCompactOllamaModel(settings.model!)
  const modelPlaceholder = isOllama
    ? t('settings.aiConnections.modelPlaceholderOllama')
    : settings.provider === 'openai'
      ? t('settings.aiConnections.modelPlaceholderOpenAi')
      : t('settings.aiConnections.modelPlaceholderGemini')

  function formatOllamaSize(bytes: number | null): string {
    if (bytes == null || bytes <= 0) return ''
    const gb = bytes / 1_000_000_000
    return gb >= 1 ? ` (${gb.toFixed(1)} GB)` : ''
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-foreground">{t('settings.aiConnections.heading')}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{t('settings.aiConnections.hint')}</p>
      </div>

      <label className="flex cursor-pointer items-start gap-2">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={settings.enabled}
          disabled={busy}
          onChange={(e): void => {
            const checked = e.target.checked
            if (checked && !settings.consentGiven) {
              setConsentOpen(true)
              return
            }
            void persist({ enabled: checked })
          }}
        />
        <span className="text-xs text-foreground">{t('settings.aiConnections.enable')}</span>
      </label>

      <div>
        <span className="mb-1 block text-xs font-medium text-foreground">
          {t('settings.aiConnections.provider')}
        </span>
        <p className="mb-1.5 text-2xs text-muted-foreground">
          {t('settings.aiConnections.providerHint')}
        </p>
        <select
          className="w-full max-w-xs rounded-md border border-border bg-background px-2 py-1.5 text-xs"
          value={settings.provider}
          disabled={busy}
          onChange={(e): void =>
            void persist({ provider: e.target.value as AiConnectionsProvider })
          }
        >
          <option value="gemini">Google Gemini</option>
          <option value="openai">OpenAI</option>
          <option value="ollama">Ollama (lokal)</option>
        </select>
        {isOllama ? (
          <p className="mt-1 text-2xs text-muted-foreground">
            {t('settings.aiConnections.ollamaLocalHint')}
          </p>
        ) : null}
        {!settings.hasActiveApiKey && settings.enabled ? (
          <p className="mt-1 text-2xs text-amber-600 dark:text-amber-500">
            {isOllama
              ? t('settings.aiConnections.ollamaModelMissing')
              : t('settings.aiConnections.activeKeyMissing')}
          </p>
        ) : null}
      </div>

      {isOllama ? (
        <div className="chronell-prompt-card max-w-md space-y-2 p-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-foreground">
              {t('settings.aiConnections.ollamaBaseUrl')}
            </span>
            <input
              type="url"
              className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
              defaultValue={settings.ollamaBaseUrl}
              disabled={busy}
              onBlur={(e): void => {
                const v = e.target.value.trim()
                if (v && v !== settings.ollamaBaseUrl) {
                  void persist({ ollamaBaseUrl: v })
                }
              }}
            />
            <span className="text-2xs text-muted-foreground">
              {t('settings.aiConnections.ollamaBaseUrlHint')}
            </span>
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busy || ollamaModelsLoading}
              className="rounded-md border border-border px-2 py-1 text-xs hover:bg-secondary disabled:opacity-50"
              onClick={(): void => void refreshOllamaModels(settings.ollamaBaseUrl)}
            >
              {ollamaModelsLoading ? (
                <span className="inline-flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {t('settings.aiConnections.ollamaModelsLoading')}
                </span>
              ) : (
                t('settings.aiConnections.ollamaRefreshModels')
              )}
            </button>
            <button
              type="button"
              disabled={busy || ollamaTestLoading}
              className="rounded-md border border-border px-2 py-1 text-xs hover:bg-secondary disabled:opacity-50"
              onClick={(): void => {
                setOllamaTestLoading(true)
                setOllamaTestResult(null)
                void window.mailClient.aiConnections
                  .testOllamaConnection({
                    baseUrl: settings.ollamaBaseUrl,
                    model: settings.model
                  })
                  .then(setOllamaTestResult)
                  .catch((err) =>
                    setOllamaTestResult({
                      ok: false,
                      message:
                        err instanceof Error
                          ? err.message
                          : t('settings.aiConnections.ollamaTestFail'),
                      modelCount: 0
                    })
                  )
                  .finally(() => setOllamaTestLoading(false))
              }}
            >
              {ollamaTestLoading ? (
                <span className="inline-flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {t('settings.aiConnections.ollamaTesting')}
                </span>
              ) : (
                t('settings.aiConnections.ollamaTestConnection')
              )}
            </button>
            {ollamaModelsError ? (
              <span className="text-2xs text-amber-600 dark:text-amber-500">{ollamaModelsError}</span>
            ) : null}
          </div>
          {ollamaTestResult ? (
            <p
              className={cn(
                'text-2xs',
                ollamaTestResult.ok
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : 'text-amber-600 dark:text-amber-500'
              )}
            >
              {ollamaTestResult.message}
            </p>
          ) : null}
          {usesCompactPrompts ? (
            <p className="text-2xs text-muted-foreground">
              {t('settings.aiConnections.ollamaCompactPrompts')}
            </p>
          ) : null}
          {ollamaModels.length > 0 ? (
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-foreground">
                {t('settings.aiConnections.ollamaModelSelect')}
              </span>
              <select
                className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                value={settings.model ?? ''}
                disabled={busy}
                onChange={(e): void => {
                  const v = e.target.value.trim()
                  if (v) void persist({ model: v })
                }}
              >
                <option value="">—</option>
                {ollamaModels.map((m) => (
                  <option key={m.name} value={m.name}>
                    {m.name}
                    {formatOllamaSize(m.sizeBytes)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      ) : null}

      <div className="chronell-prompt-card max-w-md space-y-2 p-3">
        <p className="text-xs font-medium text-foreground">
          {t('settings.aiConnections.embeddingsHeading')}
        </p>
        <p className="text-2xs text-muted-foreground">
          {t('settings.aiConnections.embeddingsHint')}
        </p>
        <label className="flex cursor-pointer items-start gap-2">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={settings.embeddingsEnabled}
            disabled={busy}
            onChange={(e): void => void persist({ embeddingsEnabled: e.target.checked })}
          />
          <span className="text-xs text-foreground">
            {t('settings.aiConnections.embeddingsEnable')}
          </span>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-foreground">
            {t('settings.aiConnections.embeddingModel')}
          </span>
          <input
            type="text"
            className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
            defaultValue={settings.embeddingModel}
            disabled={busy}
            onBlur={(e): void => {
              const v = e.target.value.trim()
              if (v) void persist({ embeddingModel: v })
            }}
          />
          <span className="text-2xs text-muted-foreground">
            {t('settings.aiConnections.embeddingModelHint')}
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-2">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={settings.embeddingHybridRetrieval}
            disabled={busy || !settings.embeddingsEnabled}
            onChange={(e): void =>
              void persist({ embeddingHybridRetrieval: e.target.checked })
            }
          />
          <span className="text-xs text-foreground">
            {t('settings.aiConnections.embeddingHybrid')}
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-2">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={settings.embeddingAutoIndex}
            disabled={busy || !settings.embeddingsEnabled}
            onChange={(e): void => void persist({ embeddingAutoIndex: e.target.checked })}
          />
          <span className="text-xs text-foreground">
            {t('settings.aiConnections.embeddingAutoIndex')}
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-2">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={settings.embeddingFastSuggestions}
            disabled={busy || !settings.embeddingsEnabled}
            onChange={(e): void =>
              void persist({ embeddingFastSuggestions: e.target.checked })
            }
          />
          <span className="text-xs text-foreground">
            {t('settings.aiConnections.embeddingFast')}
          </span>
        </label>
        {embedStatus ? (
          <p className="text-2xs text-muted-foreground">
            {t('settings.aiConnections.embeddingStatus', {
              indexed: embedStatus.indexedCount,
              pending: embedStatus.pendingEstimate
            })}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || embedRebuildBusy || !settings.embeddingsEnabled}
            className="rounded-md border border-border px-2 py-1 text-xs hover:bg-secondary disabled:opacity-50"
            onClick={(): void => {
              setEmbedRebuildBusy(true)
              void window.mailClient.aiConnections
                .rebuildEmbeddingIndex({
                  lookbackDays: settings.scanLookbackDays,
                  maxEntities: 12_000
                })
                .then((r) => {
                  setMessage(
                    t('settings.aiConnections.embeddingRebuildDone', {
                      indexed: r.indexed,
                      skipped: r.skipped
                    })
                  )
                })
                .catch((err) => {
                  setMessage(err instanceof Error ? err.message : t('settings.aiConnections.saveError'))
                })
                .finally(() => {
                  setEmbedRebuildBusy(false)
                  void loadEmbedStatus()
                })
            }}
          >
            {embedRebuildBusy || embedStatus?.rebuildRunning ? (
              <span className="inline-flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                {embedStatus?.rebuildProgress
                  ? t('settings.aiConnections.embeddingRebuildBusy', {
                      done: embedStatus.rebuildProgress.done,
                      total: embedStatus.rebuildProgress.total
                    })
                  : t('settings.aiConnections.embeddingRebuildBusy', { done: 0, total: 0 })}
              </span>
            ) : (
              t('settings.aiConnections.embeddingRebuild')
            )}
          </button>
          {embedStatus?.rebuildRunning ? (
            <button
              type="button"
              disabled={busy}
              className="rounded-md border border-border px-2 py-1 text-xs hover:bg-secondary"
              onClick={(): void => {
                void window.mailClient.aiConnections.cancelEmbeddingRebuild()
                void loadEmbedStatus()
              }}
            >
              {t('settings.aiConnections.embeddingRebuildCancel')}
            </button>
          ) : null}
        </div>
      </div>

      <div className="max-w-md space-y-1.5">
        <span className="text-xs font-medium text-foreground">
          {t('settings.aiConnections.snippetMode')}
        </span>
        <p className="text-2xs text-muted-foreground">
          {t('settings.aiConnections.snippetModeHint')}
        </p>
        {(['off', 'on', 'ask'] as const).map((mode) => (
          <label key={mode} className="flex cursor-pointer items-start gap-2">
            <input
              type="radio"
              name="snippetMode"
              className="mt-0.5"
              disabled={busy || !settings.enabled}
              checked={settings.snippetMode === mode}
              onChange={(): void => {
                if (mode === 'on' && !settings.snippetConsentGiven) {
                  setSnippetConsentOpen(true)
                  return
                }
                void persist({ snippetMode: mode })
              }}
            />
            <span className="text-xs text-foreground">
              {t(`settings.aiConnections.snippetMode_${mode}`)}
            </span>
          </label>
        ))}
      </div>

      <label className="flex max-w-md flex-col gap-1">
        <span className="text-xs font-medium text-foreground">
          {t('settings.aiConnections.minConfidence', {
            percent: Math.round(settings.minConfidence * 100)
          })}
        </span>
        <input
          type="range"
          min={50}
          max={95}
          step={5}
          disabled={busy || !settings.enabled}
          value={Math.round(settings.minConfidence * 100)}
          onChange={(e): void => {
            const pct = Number(e.target.value)
            if (Number.isFinite(pct)) {
              void persist({ minConfidence: pct / 100 })
            }
          }}
          className="w-full"
        />
        <span className="text-2xs text-muted-foreground">
          {t('settings.aiConnections.minConfidenceHint')}
        </span>
      </label>

      <label className="flex cursor-pointer items-start gap-2">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={settings.compareProviders}
          disabled={
            busy ||
            !settings.enabled ||
            !settings.hasGeminiApiKey ||
            !settings.hasOpenAiApiKey
          }
          onChange={(e): void => void persist({ compareProviders: e.target.checked })}
        />
        <span className="text-xs text-foreground">
          {t('settings.aiConnections.compareProviders')}
        </span>
      </label>
      {settings.compareProviders ? (
        <p className="text-2xs text-muted-foreground">
          {t('settings.aiConnections.compareProvidersHint')}
        </p>
      ) : null}

      <label className="flex cursor-pointer items-start gap-2">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={settings.showLinkQualityOnGraph}
          disabled={busy || !settings.enabled}
          onChange={(e): void =>
            void persist({ showLinkQualityOnGraph: e.target.checked })
          }
        />
        <span className="text-xs text-foreground">
          {t('settings.aiConnections.showLinkQualityOnGraph')}
        </span>
      </label>
      <p className="text-2xs text-muted-foreground">
        {t('settings.aiConnections.showLinkQualityOnGraphHint')}
      </p>

      <div className="grid max-w-md grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-foreground">
            {t('settings.aiConnections.scanLookbackDays')}
          </span>
          <input
            type="number"
            min={7}
            max={365}
            disabled={busy}
            defaultValue={settings.scanLookbackDays}
            onBlur={(e): void => {
              const v = Number(e.target.value)
              if (Number.isFinite(v)) void persist({ scanLookbackDays: v })
            }}
            className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-foreground">
            {t('settings.aiConnections.scanMaxAnchors')}
          </span>
          <input
            type="number"
            min={1}
            max={50}
            disabled={busy}
            defaultValue={settings.scanMaxAnchors}
            onBlur={(e): void => {
              const v = Number(e.target.value)
              if (Number.isFinite(v)) void persist({ scanMaxAnchors: v })
            }}
            className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
          />
        </label>
      </div>

      {settings.enabled ? (
        <div className="chronell-prompt-card max-w-md space-y-2 p-3">
          <p className="text-xs font-medium text-foreground">
            {t('settings.aiConnections.domainProfilesTitle')}
          </p>
          <p className="text-2xs text-muted-foreground">
            {t('settings.aiConnections.domainProfilesHint')}
          </p>
          {(settings.customDomainProfiles ?? []).map((profile, index) => (
            <div key={profile.id} className="flex flex-col gap-1 rounded-md bg-background/60 p-2">
              <input
                type="text"
                disabled={busy}
                defaultValue={profile.label}
                placeholder={t('settings.aiConnections.domainProfileLabel')}
                className="rounded-md border border-border bg-background px-2 py-1 text-xs"
                onBlur={(e): void => {
                  const label = e.target.value.trim()
                  if (!label) return
                  const next = [...(settings.customDomainProfiles ?? [])]
                  next[index] = { ...profile, label }
                  void persist({ customDomainProfiles: next })
                }}
              />
              <input
                type="text"
                disabled={busy}
                defaultValue={profile.keywords.join(', ')}
                placeholder={t('settings.aiConnections.domainProfileKeywords')}
                className="rounded-md border border-border bg-background px-2 py-1 text-xs"
                onBlur={(e): void => {
                  const keywords = e.target.value
                    .split(/[,;]+/)
                    .map((k) => k.trim().toLowerCase())
                    .filter((k) => k.length >= 2)
                  const next = [...(settings.customDomainProfiles ?? [])]
                  next[index] = { ...profile, keywords }
                  void persist({ customDomainProfiles: next })
                }}
              />
              <button
                type="button"
                disabled={busy}
                className="self-start text-2xs text-destructive hover:underline"
                onClick={(): void => {
                  const next = (settings.customDomainProfiles ?? []).filter((_, i) => i !== index)
                  void persist({ customDomainProfiles: next })
                }}
              >
                {t('settings.aiConnections.domainProfileRemove')}
              </button>
            </div>
          ))}
          <button
            type="button"
            disabled={busy || (settings.customDomainProfiles?.length ?? 0) >= 8}
            className="rounded-md border border-border px-2 py-1 text-xs hover:bg-secondary disabled:opacity-50"
            onClick={(): void => {
              const id = `custom_${Date.now()}`
              const row: AiLinkCustomDomainProfile = {
                id,
                label: t('settings.aiConnections.domainProfileNew'),
                keywords: []
              }
              void persist({
                customDomainProfiles: [...(settings.customDomainProfiles ?? []), row]
              })
            }}
          >
            {t('settings.aiConnections.domainProfileAdd')}
          </button>
        </div>
      ) : null}

      {settings.enabled && auditRows.length > 0 ? (
        <div className="chronell-prompt-card max-w-md p-3">
          <p className="mb-2 text-xs font-medium text-foreground">
            {t('settings.aiConnections.auditTitle')}
          </p>
          <ul className="max-h-32 space-y-1 overflow-y-auto text-2xs text-muted-foreground">
            {auditRows.map((row) => (
              <li key={row.id} className="flex flex-wrap gap-x-2">
                <span className="text-foreground/80">
                  {t(`settings.aiConnections.auditKind.${row.kind}`, { defaultValue: row.kind })}
                </span>
                <span className="tabular-nums">{row.createdAt.slice(0, 16)}</span>
                {row.provider ? <span>{row.provider}</span> : null}
                {row.includeExcerpt ? (
                  <span className="text-amber-600 dark:text-amber-500">
                    {t('settings.aiConnections.auditExcerpt')}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="text-2xs text-muted-foreground">{t('settings.aiConnections.backupNote')}</p>

      <div>
        <span className="mb-1 block text-xs font-medium text-foreground">
          {isOllama
            ? t('settings.aiConnections.ollamaModelManual')
            : t('settings.aiConnections.model')}
        </span>
        <input
          type="text"
          className="w-full max-w-md rounded-md border border-border bg-background px-2 py-1.5 text-xs"
          placeholder={modelPlaceholder}
          defaultValue={settings.model ?? ''}
          disabled={busy}
          onBlur={(e): void => {
            const v = e.target.value.trim()
            void persist({ model: v || null })
          }}
        />
      </div>

      {!isOllama ? (
        <>
          <ProviderApiKeyBlock
            label={t('settings.aiConnections.geminiKey')}
            hasKey={settings.hasGeminiApiKey}
            draft={geminiKeyDraft}
            busy={busy}
            onDraftChange={setGeminiKeyDraft}
            onSave={(): void => void saveApiKey('gemini', geminiKeyDraft)}
            onClear={(): void => void clearApiKey('gemini')}
            t={t}
          />
          <ProviderApiKeyBlock
            label={t('settings.aiConnections.openAiKey')}
            hasKey={settings.hasOpenAiApiKey}
            draft={openAiKeyDraft}
            busy={busy}
            onDraftChange={setOpenAiKeyDraft}
            onSave={(): void => void saveApiKey('openai', openAiKeyDraft)}
            onClear={(): void => void clearApiKey('openai')}
            t={t}
          />
        </>
      ) : null}

      {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}

      {snippetConsentOpen ? (
        <div className={cn('rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 space-y-2')}>
          <p className="text-xs font-medium text-foreground">
            {t('settings.aiConnections.snippetConsentTitle')}
          </p>
          <p className="text-xs text-muted-foreground whitespace-pre-line">
            {t('settings.aiConnections.snippetConsentBody')}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={(): void => void confirmSnippetConsent()}
              className="rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground"
            >
              {t('settings.aiConnections.snippetConsentConfirm')}
            </button>
            <button
              type="button"
              onClick={(): void => setSnippetConsentOpen(false)}
              className="rounded-md border border-border px-2 py-1 text-xs"
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      ) : null}

      {consentOpen ? (
        <div className={cn('rounded-lg border border-primary/40 bg-primary/5 p-3 space-y-2')}>
          <p className="text-xs font-medium text-foreground">
            {isOllama
              ? t('settings.aiConnections.consentTitleOllama')
              : t('settings.aiConnections.consentTitle')}
          </p>
          <p className="text-xs text-muted-foreground whitespace-pre-line">
            {isOllama
              ? t('settings.aiConnections.consentBodyOllama')
              : t('settings.aiConnections.consentBody')}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={(): void => void confirmConsent()}
              className="rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground"
            >
              {t('settings.aiConnections.consentConfirm')}
            </button>
            <button
              type="button"
              onClick={(): void => setConsentOpen(false)}
              className="rounded-md border border-border px-2 py-1 text-xs"
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function ProviderApiKeyBlock({
  label,
  hasKey,
  draft,
  busy,
  onDraftChange,
  onSave,
  onClear,
  t
}: {
  label: string
  hasKey: boolean
  draft: string
  busy: boolean
  onDraftChange: (v: string) => void
  onSave: () => void
  onClear: () => void
  t: (key: string) => string
}): JSX.Element {
  return (
    <div className="chronell-prompt-card p-3">
      <span className="mb-2 block text-xs font-medium text-foreground">{label}</span>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="password"
          autoComplete="off"
          className="min-w-[12rem] flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-xs"
          placeholder={
            hasKey
              ? t('settings.aiConnections.apiKeyReplace')
              : t('settings.aiConnections.apiKeyPlaceholder')
          }
          value={draft}
          disabled={busy}
          onChange={(e): void => onDraftChange(e.target.value)}
        />
        <button
          type="button"
          disabled={busy || !draft.trim()}
          onClick={onSave}
          className="rounded-md border border-border px-2 py-1 text-xs hover:bg-secondary"
        >
          {t('settings.aiConnections.saveKey')}
        </button>
        {hasKey ? (
          <button
            type="button"
            disabled={busy}
            onClick={onClear}
            className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-secondary"
          >
            {t('settings.aiConnections.clearKey')}
          </button>
        ) : null}
      </div>
      <p className="mt-1 text-2xs text-muted-foreground">
        {hasKey ? t('settings.aiConnections.keyStored') : t('settings.aiConnections.keyMissing')}
      </p>
    </div>
  )
}
