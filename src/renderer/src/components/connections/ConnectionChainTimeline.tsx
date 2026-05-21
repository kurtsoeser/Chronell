import type { EntityLinkSuggestionChain } from '@shared/entity-links'
import { entityRefKindIcon } from '@/lib/entity-ref-ui'
import { cn } from '@/lib/utils'

export function ConnectionChainTimeline({
  chain,
  className,
  compact = false
}: {
  chain: EntityLinkSuggestionChain
  className?: string
  compact?: boolean
}): JSX.Element {
  return (
    <div className={cn('space-y-0.5', className)}>
      <div className="flex flex-wrap items-center gap-0.5">
        {chain.steps.map((step, i) => {
          const Icon = entityRefKindIcon(step.ref.kind)
          return (
            <span key={`${step.ref.kind}-${i}`} className="inline-flex items-center gap-0.5">
              {i > 0 ? <span className="text-[9px] text-muted-foreground">→</span> : null}
              <span
                className={cn(
                  'inline-flex max-w-[8rem] items-center gap-0.5 truncate rounded-md bg-muted/30 px-1 py-0.5',
                  compact ? 'text-[9px]' : 'text-[10px]'
                )}
                title={step.title}
              >
                <Icon className="h-2.5 w-2.5 shrink-0 text-primary" />
                <span className="truncate font-medium">{step.title}</span>
              </span>
            </span>
          )
        })}
        {chain.providerConsensus ? (
          <span className="ml-1 text-[8px] text-primary">✓✓</span>
        ) : null}
        {chain.confidence != null ? (
          <span className="ml-1 text-[8px] text-muted-foreground">
            {Math.round(chain.confidence * 100)}%
          </span>
        ) : null}
      </div>
      {chain.reasonText ? (
        <p className={cn('text-muted-foreground', compact ? 'text-[8px]' : 'text-[9px]')}>
          {chain.reasonText}
        </p>
      ) : null}
    </div>
  )
}
