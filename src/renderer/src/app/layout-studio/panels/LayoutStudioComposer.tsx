import { DashboardComposeTile } from '@/app/home/DashboardComposeTile'

/** Eingebetteter Mail-Editor (wie Start-Kachel „Composer“). */
export function LayoutStudioComposer(): JSX.Element {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden p-2">
      <DashboardComposeTile />
    </div>
  )
}
