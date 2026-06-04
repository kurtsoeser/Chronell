import type { LayoutStudioPanelId } from '@/app/layout-studio/layout-studio-panel-ids'
import { parseDashboardTileIdFromPanel } from '@/app/layout-studio/layout-studio-panel-ids'
import { cn } from '@/lib/utils'

export type LayoutStudioPanelPreviewKind =
  | 'dayGrid'
  | 'dayTimeline'
  | 'weekMini'
  | 'weekFull'
  | 'monthMini'
  | 'monthFull'
  | 'agendaList'
  | 'nextEvents'
  | 'zeitliste'
  | 'deadlines'
  | 'onlineMeeting'
  | 'generic'

export function layoutStudioPanelPreviewKind(id: LayoutStudioPanelId): LayoutStudioPanelPreviewKind {
  const tile = parseDashboardTileIdFromPanel(id)
  if (tile === 'calendar') return 'nextEvents'
  if (tile === 'week') return 'weekMini'
  if (tile === 'month') return 'monthMini'
  if (tile === 'today_timeline') return 'dayTimeline'
  if (tile === 'deadlines') return 'deadlines'
  if (tile === 'next_online_meeting') return 'onlineMeeting'

  switch (id) {
    case 'calendarDay':
    case 'calendarMain':
      return 'dayGrid'
    case 'calendarToday':
      return 'dayTimeline'
    case 'calendarWeek':
      return 'weekMini'
    case 'calendarWeekFull':
      return 'weekFull'
    case 'calendarMonth':
      return 'monthMini'
    case 'calendarMonthFull':
      return 'monthFull'
    case 'agenda':
      return 'agendaList'
    case 'zeitliste':
      return 'zeitliste'
    default:
      return 'generic'
  }
}

export function layoutStudioPanelPreviewKey(id: LayoutStudioPanelId): string | null {
  const tile = parseDashboardTileIdFromPanel(id)
  if (tile) return `layoutStudio.panelPreview.tile.${tile}`
  if (id === 'calendarMain') return 'layoutStudio.panelPreview.calendarDay'
  const core = id as string
  if (
    [
      'calendarDay',
      'calendarToday',
      'calendarWeek',
      'calendarWeekFull',
      'calendarMonth',
      'calendarMonthFull',
      'agenda',
      'zeitliste'
    ].includes(core)
  ) {
    return `layoutStudio.panelPreview.${core}`
  }
  return null
}

function Block({ className }: { className?: string }): JSX.Element {
  return <div className={cn('rounded-sm bg-primary/25', className)} aria-hidden />
}

export function LayoutStudioPanelPreviewIllustration({
  kind
}: {
  kind: LayoutStudioPanelPreviewKind
}): JSX.Element {
  return (
    <div
      className="flex h-[4.5rem] w-[7.5rem] shrink-0 items-stretch justify-center rounded-md border border-border/60 bg-secondary/30 p-1.5"
      aria-hidden
    >
      {kind === 'dayGrid' && (
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="h-1 w-full rounded-sm bg-muted-foreground/20" />
          <div className="relative min-h-0 flex-1">
            <Block className="absolute left-[18%] top-[8%] h-[35%] w-[28%]" />
            <Block className="absolute left-[52%] top-[42%] h-[40%] w-[32%] bg-primary/40" />
            <Block className="absolute left-[8%] top-[58%] h-[22%] w-[22%] bg-muted-foreground/15" />
          </div>
        </div>
      )}
      {kind === 'dayTimeline' && (
        <div className="flex min-w-0 flex-1 gap-1">
          <div className="flex w-2 flex-col justify-between py-0.5">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-px w-full bg-muted-foreground/25" />
            ))}
          </div>
          <div className="relative min-w-0 flex-1">
            <div className="absolute left-0 right-0 top-[38%] h-px bg-primary/50" />
            <Block className="absolute left-[10%] top-[12%] h-[18%] w-[75%]" />
            <Block className="absolute left-[20%] top-[48%] h-[28%] w-[65%] bg-primary/40" />
          </div>
        </div>
      )}
      {kind === 'weekMini' && (
        <div className="grid min-w-0 flex-1 grid-cols-7 gap-px">
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="flex flex-col gap-px">
              <div className="h-1 rounded-sm bg-muted-foreground/20" />
              <Block className={cn('min-h-[1.25rem] flex-1', i === 3 && 'bg-primary/45')} />
            </div>
          ))}
        </div>
      )}
      {kind === 'weekFull' && (
        <div className="grid min-w-0 flex-1 grid-cols-7 gap-px">
          {Array.from({ length: 7 }, (_, col) => (
            <div key={col} className="relative min-h-0 bg-background/40">
              {col === 2 ? <Block className="absolute inset-x-0 top-[20%] h-[45%] bg-primary/40" /> : null}
              {col === 5 ? <Block className="absolute inset-x-0 top-[55%] h-[25%]" /> : null}
            </div>
          ))}
        </div>
      )}
      {kind === 'monthMini' && (
        <div className="grid min-w-0 flex-1 grid-cols-7 grid-rows-4 gap-px">
          {Array.from({ length: 28 }, (_, i) => (
            <div
              key={i}
              className={cn(
                'rounded-[1px] bg-muted-foreground/12',
                i === 10 && 'bg-primary/40',
                i === 16 && 'bg-primary/25'
              )}
            />
          ))}
        </div>
      )}
      {kind === 'monthFull' && (
        <div className="grid min-w-0 flex-1 grid-cols-7 grid-rows-4 gap-px">
          {Array.from({ length: 28 }, (_, i) => (
            <div key={i} className="relative rounded-[1px] bg-background/50">
              {(i === 4 || i === 11) && (
                <Block className="absolute bottom-0 left-0 right-0 top-[40%] bg-primary/35" />
              )}
            </div>
          ))}
        </div>
      )}
      {kind === 'agendaList' && (
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
          {[0.9, 0.7, 0.55].map((w, i) => (
            <div key={i} className="flex items-center gap-1">
              <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary/50" />
              <div className="h-1 flex-1 rounded-sm bg-muted-foreground/25" style={{ maxWidth: `${w * 100}%` }} />
            </div>
          ))}
        </div>
      )}
      {kind === 'nextEvents' && (
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 px-0.5">
          <Block className="h-2 w-full bg-primary/40" />
          <Block className="h-1.5 w-[85%]" />
          <Block className="h-1.5 w-[70%] bg-muted-foreground/15" />
        </div>
      )}
      {kind === 'zeitliste' && (
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="h-1 w-[40%] rounded-sm bg-muted-foreground/20" />
          <Block className="h-2 w-full" />
          <Block className="h-2 w-[90%] bg-primary/35" />
          <Block className="h-2 w-[75%]" />
        </div>
      )}
      {kind === 'deadlines' && (
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
          <div className="flex items-center gap-1">
            <div className="h-1.5 w-1.5 rounded-full bg-amber-500/70" />
            <Block className="h-1 flex-1 max-w-[80%]" />
          </div>
          <div className="flex items-center gap-1">
            <div className="h-1.5 w-1.5 rounded-full bg-primary/50" />
            <Block className="h-1 flex-1 max-w-[65%]" />
          </div>
        </div>
      )}
      {kind === 'onlineMeeting' && (
        <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1">
          <Block className="h-3 w-[85%] bg-primary/45" />
          <div className="h-1.5 w-[50%] rounded-sm bg-muted-foreground/25" />
        </div>
      )}
      {kind === 'generic' && (
        <div className="flex min-w-0 flex-1 items-center justify-center">
          <div className="h-8 w-8 rounded-md border border-dashed border-muted-foreground/30" />
        </div>
      )}
    </div>
  )
}
