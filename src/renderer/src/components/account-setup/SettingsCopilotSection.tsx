import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  normalizeCopilotChatEngine,
  type CopilotChatEngine
} from '@shared/types'
import {
  COPILOT_PROMPT_DEFAULT_I18N_KEY,
  COPILOT_PROMPT_PREFS_CHANGED_EVENT,
  type CopilotPromptId,
  readCopilotPromptPrefs,
  resetAllCopilotPromptPrefs,
  resetCopilotPromptPref,
  setCopilotPromptPref
} from '@/lib/copilot-prompt-prefs'
import {
  persistDefaultCopilotEnginePref,
  readDefaultCopilotEnginePref,
  useDefaultCopilotEnginePref
} from '@/lib/copilot-engine-prefs'
import {
  enableWorkIqAvailability,
  readWorkIqAvailablePref
} from '@/lib/workiq-availability'
import { useAccountsStore } from '@/stores/accounts'
import { cn } from '@/lib/utils'

type CopilotSettingsSub =
  | 'mail'
  | 'compose'
  | 'contact'
  | 'meeting'
  | 'engine'

const DEFAULT_ENGINE_CHOICES: ReadonlyArray<{
  value: 'auto' | CopilotChatEngine
  labelKey: string
}> = [
  { value: 'auto', labelKey: 'settings.copilot.defaultEngineAuto' },
  { value: 'graph', labelKey: 'copilot.assist.engineGraph' },
  { value: 'workiq', labelKey: 'copilot.assist.engineWorkIq' },
  { value: 'gemini', labelKey: 'copilot.assist.engineGemini' },
  { value: 'openai', labelKey: 'copilot.assist.engineOpenAi' },
  { value: 'ollama', labelKey: 'copilot.assist.engineOllama' }
]

const SECTION_PROMPTS: Record<
  CopilotSettingsSub,
  ReadonlyArray<{ id: CopilotPromptId; labelKey: string; hintKey: string }>
> = {
  mail: [
    {
      id: 'mail.summarize',
      labelKey: 'settings.copilot.mailSummarizeLabel',
      hintKey: 'settings.copilot.mailSummarizeHint'
    }
  ],
  compose: [
    {
      id: 'compose.new',
      labelKey: 'settings.copilot.composeNewLabel',
      hintKey: 'settings.copilot.composeNewHint'
    },
    {
      id: 'compose.reply',
      labelKey: 'settings.copilot.composeReplyLabel',
      hintKey: 'settings.copilot.composeReplyHint'
    },
    {
      id: 'compose.forward',
      labelKey: 'settings.copilot.composeForwardLabel',
      hintKey: 'settings.copilot.composeForwardHint'
    }
  ],
  contact: [
    {
      id: 'contact.summarize',
      labelKey: 'settings.copilot.contactSummarizeLabel',
      hintKey: 'settings.copilot.contactSummarizeHint'
    }
  ],
  meeting: [
    {
      id: 'meeting.prepare',
      labelKey: 'settings.copilot.meetingPrepareLabel',
      hintKey: 'settings.copilot.meetingPrepareHint'
    },
    {
      id: 'meeting.review',
      labelKey: 'settings.copilot.meetingReviewLabel',
      hintKey: 'settings.copilot.meetingReviewHint'
    }
  ],
  engine: [
    {
      id: 'assist.workIqExtra',
      labelKey: 'settings.copilot.workIqExtraLabel',
      hintKey: 'settings.copilot.workIqExtraHint'
    }
  ]
}

function PromptEditor({
  id,
  label,
  hint,
  defaultText,
  value,
  onChange,
  onReset
}: {
  id: CopilotPromptId
  label: string
  hint: string
  defaultText: string
  value: string
  onChange: (next: string) => void
  onReset: () => void
}): JSX.Element {
  const { t } = useTranslation()
  const isCustom = value.trim().length > 0
  const display = isCustom ? value : defaultText

  return (
    <div className="space-y-1.5 rounded-md border border-border/50 bg-secondary/[0.03] px-3 py-2.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-foreground">{label}</p>
          <p className="mt-0.5 text-2xs text-muted-foreground">{hint}</p>
        </div>
        <button
          type="button"
          disabled={!isCustom}
          className="shrink-0 rounded-md border border-border/60 bg-background px-2 py-1 text-2xs font-medium text-foreground hover:bg-secondary/40 disabled:opacity-40"
          onClick={onReset}
          title={t('settings.copilot.resetOneTitle')}
        >
          {t('settings.copilot.resetOne')}
        </button>
      </div>
      <textarea
        id={`copilot-prompt-${id}`}
        rows={5}
        value={display}
        onChange={(e): void => onChange(e.target.value)}
        onBlur={(e): void => {
          const next = e.target.value.trim()
          if (next === defaultText.trim()) onChange('')
        }}
        className={cn(
          'w-full resize-y rounded-md border border-border/60 bg-background px-2.5 py-2 text-xs leading-relaxed text-foreground',
          'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
        )}
        spellCheck
      />
      <p className="text-2xs text-muted-foreground">
        {isCustom ? t('settings.copilot.usingCustom') : t('settings.copilot.usingDefault')}
      </p>
    </div>
  )
}

export function SettingsCopilotSection({
  subNav
}: {
  subNav: CopilotSettingsSub
}): JSX.Element {
  const { t } = useTranslation()
  const [drafts, setDrafts] = useState(() => readCopilotPromptPrefs())
  const defaultEnginePref = useDefaultCopilotEnginePref()
  const accounts = useAccountsStore((s) => s.accounts)
  const msAccounts = accounts.filter((a) => a.id.startsWith('ms:'))
  const [workIqAccountId, setWorkIqAccountId] = useState<string>('')
  const [workIqBusy, setWorkIqBusy] = useState(false)
  const [workIqMessage, setWorkIqMessage] = useState<string | null>(null)
  const [workIqTick, setWorkIqTick] = useState(0)

  useEffect(() => {
    if (msAccounts.length === 0) {
      setWorkIqAccountId('')
      return
    }
    setWorkIqAccountId((prev) =>
      prev && msAccounts.some((a) => a.id === prev) ? prev : msAccounts[0]!.id
    )
  }, [msAccounts])

  const workIqReady =
    Boolean(workIqAccountId) && readWorkIqAvailablePref(workIqAccountId) && workIqTick >= 0

  const reload = useCallback((): void => {
    setDrafts(readCopilotPromptPrefs())
  }, [])

  useEffect(() => {
    reload()
    const onChange = (): void => reload()
    window.addEventListener(COPILOT_PROMPT_PREFS_CHANGED_EVENT, onChange)
    return (): void => window.removeEventListener(COPILOT_PROMPT_PREFS_CHANGED_EVENT, onChange)
  }, [reload])

  const rows = SECTION_PROMPTS[subNav]
  const introKey =
    subNav === 'mail'
      ? 'settings.copilot.mailIntro'
      : subNav === 'compose'
        ? 'settings.copilot.composeIntro'
        : subNav === 'contact'
          ? 'settings.copilot.contactIntro'
          : subNav === 'meeting'
            ? 'settings.copilot.meetingIntro'
            : 'settings.copilot.engineIntro'

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold text-foreground">{t(`settings.copilot.${subNav}Heading`)}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t(introKey)}</p>
      </div>

      {subNav === 'engine' ? (
        <div className="space-y-1.5 rounded-md border border-border/50 bg-secondary/[0.03] px-3 py-2.5">
          <p className="text-xs font-medium text-foreground">
            {t('settings.copilot.defaultEngineLabel')}
          </p>
          <p className="text-2xs text-muted-foreground">
            {t('settings.copilot.defaultEngineHint')}
          </p>
          <select
            className="mt-1 w-full max-w-xs rounded-md border border-border/60 bg-background px-2 py-1.5 text-xs text-foreground"
            value={defaultEnginePref ?? 'auto'}
            onChange={(e): void => {
              const v = e.target.value
              if (v === 'auto') {
                persistDefaultCopilotEnginePref(null)
                return
              }
              persistDefaultCopilotEnginePref(normalizeCopilotChatEngine(v))
            }}
          >
            {DEFAULT_ENGINE_CHOICES.map((c) => (
              <option key={c.value} value={c.value}>
                {t(c.labelKey)}
              </option>
            ))}
          </select>
          <p className="text-2xs text-muted-foreground">
            {defaultEnginePref
              ? t('settings.copilot.defaultEngineActive', {
                  engine: t(
                    DEFAULT_ENGINE_CHOICES.find((c) => c.value === defaultEnginePref)?.labelKey ??
                      'copilot.assist.engineGraph'
                  )
                })
              : t('settings.copilot.defaultEngineIsAuto')}
          </p>
          {readDefaultCopilotEnginePref() != null ? (
            <button
              type="button"
              className="rounded-md border border-border/60 bg-background px-2 py-1 text-2xs font-medium text-foreground hover:bg-secondary/40"
              onClick={(): void => persistDefaultCopilotEnginePref(null)}
            >
              {t('settings.copilot.defaultEngineReset')}
            </button>
          ) : null}
        </div>
      ) : null}

      {subNav === 'engine' && msAccounts.length > 0 ? (
        <div className="space-y-1.5 rounded-md border border-border/50 bg-secondary/[0.03] px-3 py-2.5">
          <p className="text-xs font-medium text-foreground">
            {t('settings.copilot.workIqEnableLabel')}
          </p>
          <p className="text-2xs text-muted-foreground">
            {t('settings.copilot.workIqEnableHint')}
          </p>
          {msAccounts.length > 1 ? (
            <select
              className="mt-1 w-full max-w-xs rounded-md border border-border/60 bg-background px-2 py-1.5 text-xs text-foreground"
              value={workIqAccountId}
              onChange={(e): void => setWorkIqAccountId(e.target.value)}
            >
              {msAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.email || a.displayName || a.id}
                </option>
              ))}
            </select>
          ) : null}
          <p className="text-2xs text-muted-foreground">
            {workIqReady
              ? t('settings.copilot.workIqEnableReady')
              : t('settings.copilot.workIqEnableMissing')}
          </p>
          <button
            type="button"
            disabled={workIqBusy || !workIqAccountId}
            className="rounded-md border border-border/60 bg-background px-2 py-1 text-2xs font-medium text-foreground hover:bg-secondary/40 disabled:opacity-40"
            onClick={(): void => {
              if (!workIqAccountId) return
              setWorkIqBusy(true)
              setWorkIqMessage(null)
              void enableWorkIqAvailability(workIqAccountId)
                .then((res) => {
                  setWorkIqTick((n) => n + 1)
                  setWorkIqMessage(
                    res.available
                      ? t('settings.copilot.workIqEnableOk')
                      : res.errorMessage || t('settings.copilot.workIqEnableFail')
                  )
                })
                .finally(() => setWorkIqBusy(false))
            }}
          >
            {workIqBusy
              ? t('settings.copilot.workIqEnableBusy')
              : t('settings.copilot.workIqEnableAction')}
          </button>
          {workIqMessage ? (
            <p className="text-2xs text-muted-foreground whitespace-pre-line">{workIqMessage}</p>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-3">
        {rows.map((row) => {
          const defaultText = t(COPILOT_PROMPT_DEFAULT_I18N_KEY[row.id])
          const custom = drafts[row.id] ?? ''
          return (
            <PromptEditor
              key={row.id}
              id={row.id}
              label={t(row.labelKey)}
              hint={t(row.hintKey)}
              defaultText={defaultText}
              value={custom}
              onChange={(next): void => {
                const equal = next.trim() === defaultText.trim()
                setDrafts((prev) => {
                  const n = { ...prev }
                  if (equal) delete n[row.id]
                  else n[row.id] = next
                  return n
                })
                setCopilotPromptPref(row.id, equal ? null : next)
              }}
              onReset={(): void => {
                resetCopilotPromptPref(row.id)
                setDrafts((prev) => {
                  const n = { ...prev }
                  delete n[row.id]
                  return n
                })
              }}
            />
          )
        })}
      </div>

      {subNav === 'engine' ? (
        <button
          type="button"
          className="rounded-md border border-border/60 bg-background px-2.5 py-1.5 text-2xs font-medium text-foreground hover:bg-secondary/40"
          onClick={(): void => {
            resetAllCopilotPromptPrefs()
            setDrafts({})
          }}
        >
          {t('settings.copilot.resetAll')}
        </button>
      ) : null}
    </div>
  )
}
