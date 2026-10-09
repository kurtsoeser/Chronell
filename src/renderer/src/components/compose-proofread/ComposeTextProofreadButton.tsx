import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, SpellCheck, Sparkles } from 'lucide-react'
import { ComposeCopilotProofreadDialog } from '@/components/compose-proofread/ComposeCopilotProofreadDialog'
import { ComposeLanguageToolProofreadDialog } from '@/components/compose-proofread/ComposeLanguageToolProofreadDialog'
import { listCopilotEngineOptions } from '@/lib/copilot-engine-options'
import { useAiConnectionsSettings } from '@/lib/use-ai-connections-settings'
import { useWorkIqAvailable } from '@/lib/use-workiq-available'
import { cn } from '@/lib/utils'

type ProofreadMode = 'languagetool' | 'copilot' | null

export function ComposeTextProofreadButton({
  accountId,
  disabled,
  getBodyHtml,
  onReplaceBody,
  inEditorSurface,
  compact
}: {
  accountId: string
  disabled?: boolean
  getBodyHtml: () => string
  onReplaceBody: (html: string) => void
  inEditorSurface?: boolean
  compact?: boolean
}): JSX.Element {
  const { t } = useTranslation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [mode, setMode] = useState<ProofreadMode>(null)
  const [bodySnapshot, setBodySnapshot] = useState('')
  const anchorRef = useRef<HTMLDivElement | null>(null)
  const { settings: aiSettings } = useAiConnectionsSettings()
  const microsoftAccount = accountId.startsWith('ms:')
  const workIqAvailable = useWorkIqAvailable(microsoftAccount ? accountId : null)
  const copilotAvailable =
    listCopilotEngineOptions({ microsoftAccount, aiSettings, workIqAvailable }).length > 0

  const buttonClass = cn(
    'inline-flex items-center gap-1 rounded-md border font-medium disabled:opacity-50',
    compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-2xs',
    inEditorSurface
      ? 'border-[hsl(var(--compose-surface-border)/0.55)] text-foreground hover:bg-[hsl(var(--compose-surface-border)/0.18)]'
      : 'border-border text-foreground hover:bg-secondary'
  )

  const openMode = useCallback(
    (next: ProofreadMode): void => {
      setBodySnapshot(getBodyHtml())
      setMode(next)
      setMenuOpen(false)
    },
    [getBodyHtml]
  )

  useEffect(() => {
    if (!menuOpen) return
    const onDoc = (e: MouseEvent): void => {
      const el = anchorRef.current
      if (!el || el.contains(e.target as Node)) return
      setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return (): void => document.removeEventListener('mousedown', onDoc)
  }, [menuOpen])

  return (
    <>
      <div ref={anchorRef} className="relative inline-flex">
        <button
          type="button"
          disabled={disabled}
          title={t('mail.compose.proofread.buttonTitle')}
          aria-label={t('mail.compose.proofread.buttonTitle')}
          aria-expanded={menuOpen}
          onClick={(): void => setMenuOpen((v) => !v)}
          className={cn(buttonClass, 'gap-1')}
        >
          <SpellCheck className="h-3 w-3" />
          {t('mail.compose.proofread.button')}
          <ChevronDown className="h-3 w-3 opacity-70" />
        </button>
        {menuOpen ? (
          <div
            className={cn(
              'absolute bottom-full left-0 z-50 mb-1 min-w-[11rem] rounded-md border p-1 shadow-lg',
              inEditorSurface
                ? 'border-[hsl(var(--compose-surface-border)/0.55)] bg-[hsl(var(--compose-surface))]'
                : 'border-border bg-card'
            )}
            role="menu"
          >
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-2xs hover:bg-secondary/80"
              onClick={(): void => openMode('languagetool')}
            >
              <SpellCheck className="h-3 w-3 shrink-0" />
              {t('mail.compose.proofread.menuLanguageTool')}
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={!copilotAvailable}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-2xs hover:bg-secondary/80 disabled:opacity-50"
              onClick={(): void => openMode('copilot')}
            >
              <Sparkles className="h-3 w-3 shrink-0 text-primary" />
              {t('mail.compose.proofread.menuCopilot')}
            </button>
          </div>
        ) : null}
      </div>

      <ComposeLanguageToolProofreadDialog
        open={mode === 'languagetool'}
        bodyHtml={bodySnapshot}
        onApply={onReplaceBody}
        onClose={(): void => setMode(null)}
      />
      <ComposeCopilotProofreadDialog
        open={mode === 'copilot'}
        accountId={accountId}
        bodyHtml={bodySnapshot}
        onApply={onReplaceBody}
        onClose={(): void => setMode(null)}
      />
    </>
  )
}
