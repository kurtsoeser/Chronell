import { ExternalLink } from 'lucide-react'
import type { CopilotChatMessageAttribution } from '@shared/types'
import { useTranslation } from 'react-i18next'
import { openExternalUrl } from '@/lib/open-external'
import { buildCopilotSourcePills } from '@/components/copilot/copilot-sources'
import { cn } from '@/lib/utils'

export function CopilotSourcePills({
  attributions,
  replyText,
  className
}: {
  attributions: CopilotChatMessageAttribution[]
  replyText?: string | null
  className?: string
}): JSX.Element | null {
  const { t } = useTranslation()
  const pills = buildCopilotSourcePills(attributions, replyText)
  if (pills.length === 0) return null

  return (
    <div className={cn('space-y-1.5', className)}>
      <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t('copilot.assist.sources')}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {pills.map((pill) => {
          const label = (
            <>
              <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary/15 px-1 text-[10px] font-semibold text-primary">
                {pill.index}
              </span>
              <span className="max-w-[14rem] truncate">{pill.label}</span>
              {pill.url ? <ExternalLink className="h-3 w-3 shrink-0 opacity-60" aria-hidden /> : null}
            </>
          )
          const pillClass =
            'inline-flex max-w-full items-center gap-1.5 rounded-full border border-border/70 bg-background px-2 py-1 text-2xs text-foreground transition-colors hover:bg-secondary/40'

          if (pill.url) {
            return (
              <button
                key={`cite-${pill.index}-${pill.url}`}
                id={`copilot-cite-${pill.index}`}
                type="button"
                title={pill.url}
                className={pillClass}
                onClick={(): void => {
                  void openExternalUrl(pill.url!).catch(() => undefined)
                }}
              >
                {label}
              </button>
            )
          }

          return (
            <span
              key={`cite-${pill.index}-${pill.label}`}
              id={`copilot-cite-${pill.index}`}
              className={pillClass}
            >
              {label}
            </span>
          )
        })}
      </div>
    </div>
  )
}
