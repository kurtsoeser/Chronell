import { Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { EntityLinkSuggestionCountSource } from '@shared/entity-link-ai-payload'
import { cn } from '@/lib/utils'

export function EntityLinkSuggestionBadge({
  count,
  source = 'heuristic',
  className
}: {
  count: number
  source?: EntityLinkSuggestionCountSource
  className?: string
}): JSX.Element | null {
  const { t } = useTranslation()
  if (count <= 0) return null
  const label = count > 9 ? '9+' : String(count)
  const titleKey =
    source === 'ai_scan'
      ? 'connections.hints.badgeAiScan'
      : source === 'ai_panel'
        ? 'connections.hints.badgeAiPanel'
        : 'connections.hints.badgeHeuristic'

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-0.5 rounded-full bg-primary/15 px-1 py-px text-[9px] font-medium text-primary',
        className
      )}
      title={t(titleKey, { count })}
    >
      <Sparkles className="h-2.5 w-2.5" />
      {label}
    </span>
  )
}
