import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Sparkles } from 'lucide-react'
import type { ComposeDraft } from '@/stores/compose'
import { ComposeCopilotDraftDialog } from '@/components/copilot/ComposeCopilotDraftDialog'
import { listCopilotEngineOptions } from '@/lib/copilot-engine-options'
import { useAiConnectionsSettings } from '@/lib/use-ai-connections-settings'
import { useWorkIqAvailable } from '@/lib/use-workiq-available'
import { cn } from '@/lib/utils'

export function ComposeCopilotDraftButton({
  draft,
  disabled,
  inEditorSurface,
  compact
}: {
  draft: ComposeDraft
  disabled?: boolean
  inEditorSurface?: boolean
  compact?: boolean
}): JSX.Element | null {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const { settings: aiSettings } = useAiConnectionsSettings()
  const microsoftAccount = draft.accountId.startsWith('ms:')
  const workIqAvailable = useWorkIqAvailable(microsoftAccount ? draft.accountId : null)
  const engines = listCopilotEngineOptions({ microsoftAccount, aiSettings, workIqAvailable })

  if (engines.length === 0) return null

  const buttonClass = cn(
    'inline-flex items-center gap-1 rounded-md border font-medium disabled:opacity-50',
    compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-2xs',
    inEditorSurface
      ? 'border-primary/40 bg-primary/10 text-foreground hover:bg-primary/15'
      : 'border-primary/30 bg-primary/5 text-foreground hover:bg-primary/10'
  )

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        title={t('copilot.compose.buttonTitle')}
        aria-label={t('copilot.compose.buttonTitle')}
        onClick={(): void => setOpen(true)}
        className={buttonClass}
      >
        <Sparkles className="h-3 w-3 text-primary" />
        {t('copilot.compose.button')}
      </button>
      <ComposeCopilotDraftDialog open={open} draft={draft} onClose={(): void => setOpen(false)} />
    </>
  )
}
