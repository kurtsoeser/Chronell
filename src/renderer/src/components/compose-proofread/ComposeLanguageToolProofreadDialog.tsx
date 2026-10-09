import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, SpellCheck, X } from 'lucide-react'
import {
  applyLanguageToolReplacements,
  languageToolMatchSnippet,
  type LanguageToolMatch
} from '@shared/languagetool'
import {
  composeEditorHtmlToPlainText,
  composePlainTextToEditorHtml
} from '@shared/compose-proofread-text'
import { ModalPanel, ModalRoot } from '@/components/motion/Modal'
import { isComposeBodyEffectivelyEmpty } from '@/lib/compose-default-body'
import { readComposeSettingsPrefs, resolvedLanguageToolApiBaseUrl } from '@/lib/compose-settings-prefs'
import { cn } from '@/lib/utils'

function defaultSelectedKeys(matches: LanguageToolMatch[]): Set<string> {
  const keys = new Set<string>()
  for (const m of matches) {
    if (m.replacements[0]?.value) keys.add(`${m.offset}:${m.length}:${m.rule.id}`)
  }
  return keys
}

function matchKey(m: LanguageToolMatch): string {
  return `${m.offset}:${m.length}:${m.rule.id}`
}

export function ComposeLanguageToolProofreadDialog({
  open,
  bodyHtml,
  onApply,
  onClose
}: {
  open: boolean
  bodyHtml: string
  onApply: (html: string) => void
  onClose: () => void
}): JSX.Element | null {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sourceText, setSourceText] = useState('')
  const [matches, setMatches] = useState<LanguageToolMatch[]>([])
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set())
  const [hadRichFormatting, setHadRichFormatting] = useState(false)

  const selectedMatches = useMemo(
    () => matches.filter((m) => selectedKeys.has(matchKey(m))),
    [matches, selectedKeys]
  )

  const correctedText = useMemo(
    () =>
      sourceText && selectedMatches.length > 0
        ? applyLanguageToolReplacements(sourceText, selectedMatches)
        : sourceText,
    [selectedMatches, sourceText]
  )

  const runCheck = useCallback(async (): Promise<void> => {
    const plain = composeEditorHtmlToPlainText(bodyHtml)
    if (!plain || isComposeBodyEffectivelyEmpty(bodyHtml)) {
      setError(t('mail.compose.proofread.emptyBody'))
      return
    }
    const rich =
      bodyHtml.replace(/<[^>]+>/g, '').trim().length < bodyHtml.trim().length - 20 &&
      /<(?:b|strong|i|em|u|span|font|table|ul|ol|img)\b/i.test(bodyHtml)
    setHadRichFormatting(rich)
    setBusy(true)
    setError(null)
    setMatches([])
    setSelectedKeys(new Set())
    setSourceText(plain)
    try {
      const check = window.mailClient?.languageTool?.check
      if (typeof check !== 'function') {
        setError(t('copilot.assist.preloadStale'))
        return
      }
      const prefs = readComposeSettingsPrefs()
      const res = await check({
        text: plain,
        language: 'de-DE',
        apiBaseUrl: resolvedLanguageToolApiBaseUrl(prefs),
        username: prefs.languageToolUsername.trim() || undefined
      })
      if (res.status === 'error') {
        setError(res.errorMessage || t('mail.compose.proofread.error'))
        return
      }
      setMatches(res.matches)
      setSelectedKeys(defaultSelectedKeys(res.matches))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [bodyHtml, t])

  useEffect(() => {
    if (!open) return
    setError(null)
    setMatches([])
    setSourceText('')
    setSelectedKeys(new Set())
    void runCheck()
  }, [open, bodyHtml, runCheck])

  const toggleMatch = useCallback((key: string): void => {
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const selectAllWithReplacement = useCallback((): void => {
    setSelectedKeys(defaultSelectedKeys(matches))
  }, [matches])

  const adopt = useCallback((): void => {
    const nextPlain = (correctedText.trim() || sourceText.trim())
    const html = composePlainTextToEditorHtml(nextPlain)
    if (!html.trim()) {
      setError(t('mail.compose.proofread.emptyBody'))
      return
    }
    onApply(html)
    onClose()
  }, [correctedText, onApply, onClose, sourceText, t])

  const canAdopt =
    selectedMatches.length > 0 && correctedText.trim() !== sourceText.trim()

  if (!open) return null

  return (
    <ModalRoot open zIndex={220} onBackdropClick={onClose}>
      <ModalPanel
        className="app-dialog-panel flex max-h-[min(90vh,40rem)] w-full max-w-[34rem] flex-col gap-3 overflow-hidden rounded-xl border border-border bg-card p-4 text-foreground shadow-2xl"
        aria-labelledby="compose-lt-proofread-title"
        onClick={(e): void => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <SpellCheck className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            <h2 id="compose-lt-proofread-title" className="truncate text-sm font-semibold">
              {t('mail.compose.proofread.languageToolTitle')}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
            aria-label={t('common.close')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-xs text-muted-foreground">{t('mail.compose.proofread.languageToolHint')}</p>

        {hadRichFormatting ? (
          <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-2xs text-amber-200">
            {t('mail.compose.proofread.formattingWarning')}
          </p>
        ) : null}

        {error ? (
          <p className="text-xs text-destructive" role="alert">{error}</p>
        ) : null}

        {busy ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('mail.compose.proofread.checking')}
          </div>
        ) : null}

        {!busy && sourceText ? (
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-2xs text-muted-foreground">
                {matches.length === 0
                  ? t('mail.compose.proofread.noIssues')
                  : t('mail.compose.proofread.issueCount', { count: matches.length })}
              </p>
              {matches.length > 0 ? (
                <button
                  type="button"
                  onClick={selectAllWithReplacement}
                  className="text-2xs text-primary hover:underline"
                >
                  {t('mail.compose.proofread.selectAll')}
                </button>
              ) : null}
            </div>
            {matches.length > 0 ? (
              <ul className="space-y-2 text-2xs">
                {matches.slice(0, 20).map((m, i) => {
                  const key = matchKey(m)
                  const snippet = languageToolMatchSnippet(sourceText, m)
                  const replacement = m.replacements[0]?.value
                  const canToggle = Boolean(replacement)
                  return (
                    <li
                      key={`${key}-${i}`}
                      className="rounded-md border border-border/60 bg-background/50 px-2 py-1.5"
                    >
                      <label className="flex cursor-pointer items-start gap-2">
                        <input
                          type="checkbox"
                          className="mt-0.5 h-3.5 w-3.5 accent-primary"
                          checked={selectedKeys.has(key)}
                          disabled={!canToggle}
                          onChange={(): void => toggleMatch(key)}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="font-medium text-foreground">
                            {snippet ? `«${snippet}» — ` : ''}
                            {m.shortMessage || m.message}
                          </span>
                          {replacement ? (
                            <span className="mt-0.5 block text-muted-foreground">
                              → {replacement}
                            </span>
                          ) : (
                            <span className="mt-0.5 block text-muted-foreground">
                              {t('mail.compose.proofread.noAutoReplacement')}
                            </span>
                          )}
                        </span>
                      </label>
                    </li>
                  )
                })}
                {matches.length > 20 ? (
                  <li className="text-muted-foreground">
                    {t('mail.compose.proofread.moreIssues', { count: matches.length - 20 })}
                  </li>
                ) : null}
              </ul>
            ) : null}
            {correctedText && correctedText !== sourceText ? (
              <div>
                <p className="mb-1 text-2xs font-medium text-muted-foreground">
                  {t('mail.compose.proofread.preview')}
                </p>
                <pre
                  className={cn(
                    'max-h-40 overflow-y-auto whitespace-pre-wrap rounded-md border border-border/60',
                    'bg-background/60 p-2 text-xs text-foreground'
                  )}
                >
                  {correctedText}
                </pre>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap justify-end gap-2 border-t border-border/60 pt-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-secondary"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            disabled={busy || !sourceText}
            onClick={(): void => void runCheck()}
            className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-secondary disabled:opacity-50"
          >
            {t('mail.compose.proofread.recheck')}
          </button>
          <button
            type="button"
            disabled={busy || !sourceText || !canAdopt}
            onClick={adopt}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
          >
            {t('mail.compose.proofread.adoptSelected')}
          </button>
        </div>
      </ModalPanel>
    </ModalRoot>
  )
}
