import { cn } from '@/lib/utils'
import type { LayoutZoneNode } from '@/app/layout-studio/layout-zone-model'

export type LayoutZoneThumbnailSize = 'sm' | 'lg'

const THUMB_HEIGHT: Record<LayoutZoneThumbnailSize, string> = {
  sm: 'h-14',
  lg: 'h-20'
}

/** Schematische Vorschau eines Zonenbaums (FancyZones-Stil). */
export function LayoutZoneThumbnail({
  root,
  size = 'sm',
  className
}: {
  root: LayoutZoneNode
  size?: LayoutZoneThumbnailSize
  className?: string
}): JSX.Element {
  return (
    <div
      className={cn(
        'flex w-full min-w-0 overflow-hidden rounded-md border border-border/80 bg-muted/30 p-0.5',
        THUMB_HEIGHT[size],
        className
      )}
      aria-hidden
    >
      <ThumbNode node={root} />
    </div>
  )
}

function ThumbNode({ node }: { node: LayoutZoneNode }): JSX.Element {
  if (node.type === 'leaf') {
    return <div className="min-h-0 min-w-0 flex-1 rounded-sm bg-foreground/15" />
  }
  const row = node.direction === 'vertical'
  return (
    <div className={cn('flex min-h-0 min-w-0 flex-1 gap-px', row ? 'flex-row' : 'flex-col')}>
      <div className="flex min-h-0 min-w-0" style={{ flex: node.ratio }}>
        <ThumbNode node={node.first} />
      </div>
      <div className={cn('shrink-0 bg-border/60', row ? 'w-px' : 'h-px')} />
      <div className="flex min-h-0 min-w-0" style={{ flex: 1 - node.ratio }}>
        <ThumbNode node={node.second} />
      </div>
    </div>
  )
}
