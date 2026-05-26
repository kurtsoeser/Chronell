import { useTranslation } from 'react-i18next'
import { Loader2, PanelRightClose, RefreshCw, SquareArrowOutUpRight } from 'lucide-react'
import type { WorkItem } from '@shared/work-item'
import { cn } from '@/lib/utils'
import {
  ModuleColumnHeaderIconButton,
  moduleColumnHeaderDockBarRowClass,
  moduleColumnHeaderIconGlyphClass,
  moduleColumnHeaderLabelWithIconClass
} from '@/components/ModuleColumnHeader'
import { CalendarTimelinePane } from '@/app/calendar/CalendarTimelinePane'

export interface CalendarRightZeitlistePanelProps {
  open: boolean
  /** Parent erhöht den Zähler → Zeitliste lädt neu (z. B. nach Kalender-Zug). */
  reloadSignal?: number
  reloadRef: React.MutableRefObject<(() => void) | null>
  onWorkItemFocused: (item: WorkItem) => void
  onTimelineLoadingChange?: (loading: boolean) => void
  /** True während initialem Reload oder Refresh der Liste. */
  listRefreshing?: boolean
  onRequestClose: () => void
  className?: string
  onRequestUndock?: () => void
  hideChrome?: boolean
}

/**
 * Rechte Kalender-Spalte: Zeitliste (Mails, Termine, Cloud-Aufgaben) mit Kopfzeile in der Spalte.
 */
export function CalendarRightZeitlistePanel({
  open,
  reloadSignal,
  reloadRef,
  onWorkItemFocused,
  onTimelineLoadingChange,
  listRefreshing,
  onRequestClose,
  className,
  onRequestUndock,
  hideChrome
}: CalendarRightZeitlistePanelProps): JSX.Element | null {
  const { t } = useTranslation()

  if (!open) return null

  return (
    <div
      className={cn(
        'flex h-full min-h-0 w-full shrink-0 flex-col overflow-hidden',
        className
      )}
    >
      {!hideChrome ? (
        <div className="calendar-shell-column-header flex shrink-0 flex-col justify-center border-b border-border/30 px-2 py-1">
          <div className={moduleColumnHeaderDockBarRowClass}>
            <div className={moduleColumnHeaderLabelWithIconClass}>
              <span className="truncate font-medium">{t('mega.shell.title')}</span>
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              <ModuleColumnHeaderIconButton
                title={t('mega.shell.refresh')}
                disabled={Boolean(listRefreshing)}
                onClick={(): void => reloadRef.current?.()}
              >
                {listRefreshing ? (
                  <Loader2 className={cn(moduleColumnHeaderIconGlyphClass, 'animate-spin')} />
                ) : (
                  <RefreshCw className={moduleColumnHeaderIconGlyphClass} />
                )}
              </ModuleColumnHeaderIconButton>
              {onRequestUndock ? (
                <ModuleColumnHeaderIconButton
                  title={t('calendar.shell.undockPreviewTitle')}
                  onClick={onRequestUndock}
                >
                  <SquareArrowOutUpRight className={moduleColumnHeaderIconGlyphClass} />
                </ModuleColumnHeaderIconButton>
              ) : null}
              <ModuleColumnHeaderIconButton
                title={t('calendar.posteingangUi.hideColumn')}
                onClick={onRequestClose}
              >
                <PanelRightClose className={moduleColumnHeaderIconGlyphClass} />
              </ModuleColumnHeaderIconButton>
            </div>
          </div>
        </div>
      ) : null}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <CalendarTimelinePane
          variant="dock"
          reloadSignal={reloadSignal}
          onLoadingChange={onTimelineLoadingChange}
          reloadRef={reloadRef}
          onWorkItemFocused={onWorkItemFocused}
        />
      </div>
    </div>
  )
}
