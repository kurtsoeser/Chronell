import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { AiConnectionsProvider, AiConnectionsSettings } from '@shared/ai-connections'
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

  useEffect(() => {
    void load()
  }, [load])

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
    await persist({ snippetConsentGiven: true, includeSnippet: true })
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

  const modelPlaceholder =
    settings.provider === 'openai'
      ? t('settings.aiConnections.modelPlaceholderOpenAi')
      : t('settings.aiConnections.modelPlaceholderGemini')

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
        <span className="mb-1 block text-[11px] font-medium text-foreground">
          {t('settings.aiConnections.provider')}
        </span>
        <p className="mb-1.5 text-[10px] text-muted-foreground">
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
        </select>
        {!settings.hasActiveApiKey && settings.enabled ? (
          <p className="mt-1 text-[10px] text-amber-600 dark:text-amber-500">
            {t('settings.aiConnections.activeKeyMissing')}
          </p>
        ) : null}
      </div>

      <label className="flex cursor-pointer items-start gap-2">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={settings.includeSnippet}
          disabled={busy || !settings.enabled}
          onChange={(e): void => {
            const checked = e.target.checked
            if (checked && !settings.snippetConsentGiven) {
              setSnippetConsentOpen(true)
              return
            }
            void persist({ includeSnippet: checked })
          }}
        />
        <span className="text-xs text-foreground">
          {t('settings.aiConnections.includeSnippet')}
        </span>
      </label>

      <label className="flex max-w-md flex-col gap-1">
        <span className="text-[11px] font-medium text-foreground">
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
        <span className="text-[10px] text-muted-foreground">
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
        <p className="text-[10px] text-muted-foreground">
          {t('settings.aiConnections.compareProvidersHint')}
        </p>
      ) : null}

      <div className="grid max-w-md grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-foreground">
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
          <span className="text-[11px] font-medium text-foreground">
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

      <p className="text-[10px] text-muted-foreground">{t('settings.aiConnections.backupNote')}</p>

      <div>
        <span className="mb-1 block text-[11px] font-medium text-foreground">
          {t('settings.aiConnections.model')}
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

      {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}

      {snippetConsentOpen ? (
        <div className={cn('rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 space-y-2')}>
          <p className="text-xs font-medium text-foreground">
            {t('settings.aiConnections.snippetConsentTitle')}
          </p>
          <p className="text-[11px] text-muted-foreground whitespace-pre-line">
            {t('settings.aiConnections.snippetConsentBody')}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={(): void => void confirmSnippetConsent()}
              className="rounded-md bg-primary px-2 py-1 text-[11px] text-primary-foreground"
            >
              {t('settings.aiConnections.snippetConsentConfirm')}
            </button>
            <button
              type="button"
              onClick={(): void => setSnippetConsentOpen(false)}
              className="rounded-md border border-border px-2 py-1 text-[11px]"
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      ) : null}

      {consentOpen ? (
        <div className={cn('rounded-lg border border-primary/40 bg-primary/5 p-3 space-y-2')}>
          <p className="text-xs font-medium text-foreground">
            {t('settings.aiConnections.consentTitle')}
          </p>
          <p className="text-[11px] text-muted-foreground whitespace-pre-line">
            {t('settings.aiConnections.consentBody')}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={(): void => void confirmConsent()}
              className="rounded-md bg-primary px-2 py-1 text-[11px] text-primary-foreground"
            >
              {t('settings.aiConnections.consentConfirm')}
            </button>
            <button
              type="button"
              onClick={(): void => setConsentOpen(false)}
              className="rounded-md border border-border px-2 py-1 text-[11px]"
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
    <div className="rounded-lg border border-border/80 bg-background/40 p-3">
      <span className="mb-2 block text-[11px] font-medium text-foreground">{label}</span>
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
          className="rounded-md border border-border px-2 py-1 text-[11px] hover:bg-secondary"
        >
          {t('settings.aiConnections.saveKey')}
        </button>
        {hasKey ? (
          <button
            type="button"
            disabled={busy}
            onClick={onClear}
            className="rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground hover:bg-secondary"
          >
            {t('settings.aiConnections.clearKey')}
          </button>
        ) : null}
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">
        {hasKey ? t('settings.aiConnections.keyStored') : t('settings.aiConnections.keyMissing')}
      </p>
    </div>
  )
}
