import { PanelLeft, PanelLeftClose } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { CalendarShellColumnTopbarToggle } from '@/app/calendar/CalendarShellColumnTopbarToggle'
import { moduleColumnHeaderIconGlyphClass } from '@/components/ModuleColumnHeader'
import { useCalendarPanelLayoutStore } from '@/stores/calendar-panel-layout'
import { topbarColumnToggleButtonClass } from '@/app/calendar/CalendarShellColumnTopbarToggle'

/** Dock-Spalten + linke Nav (Mini-Kalender/Konten) in der globalen Topbar. */
export function CalendarShellTopbarToggles(): JSX.Element {
  const { t } = useTranslation()
  const leftSidebarCollapsed = useCalendarPanelLayoutStore((s) => s.leftSidebarCollapsed)
  const setLeftSidebarCollapsed = useCalendarPanelLayoutStore((s) => s.setLeftSidebarCollapsed)
  const rightInboxOpen = useCalendarPanelLayoutStore((s) => s.rightInboxOpen)
  const setRightInboxOpen = useCalendarPanelLayoutStore((s) => s.setRightInboxOpen)
  const calendarColumnOpen = useCalendarPanelLayoutStore((s) => s.calendarColumnOpen)
  const setCalendarColumnOpen = useCalendarPanelLayoutStore((s) => s.setCalendarColumnOpen)
  const rightPreviewOpen = useCalendarPanelLayoutStore((s) => s.rightPreviewOpen)
  const setRightPreviewOpen = useCalendarPanelLayoutStore((s) => s.setRightPreviewOpen)
  const rightContextOpen = useCalendarPanelLayoutStore((s) => s.contextOpen)
  const setRightContextOpen = useCalendarPanelLayoutStore((s) => s.setContextOpen)
  const setContextPlacement = useCalendarPanelLayoutStore((s) => s.setContextPlacement)
  const setInboxPlacement = useCalendarPanelLayoutStore((s) => s.setInboxPlacement)
  const setPreviewPlacement = useCalendarPanelLayoutStore((s) => s.setPreviewPlacement)

  return (
    <>
      <button
        type="button"
        title={
          leftSidebarCollapsed
            ? t('calendar.shell.leftSidebarExpand')
            : t('calendar.shell.leftSidebarCollapse')
        }
        aria-label={
          leftSidebarCollapsed
            ? t('calendar.shell.leftSidebarExpand')
            : t('calendar.shell.leftSidebarCollapse')
        }
        aria-pressed={!leftSidebarCollapsed}
        onClick={(): void => setLeftSidebarCollapsed(!leftSidebarCollapsed)}
        className={topbarColumnToggleButtonClass(!leftSidebarCollapsed)}
      >
        {leftSidebarCollapsed ? (
          <PanelLeft className={moduleColumnHeaderIconGlyphClass} aria-hidden />
        ) : (
          <PanelLeftClose className={moduleColumnHeaderIconGlyphClass} aria-hidden />
        )}
      </button>
      <CalendarShellColumnTopbarToggle
        columnId="zeitliste"
        open={rightInboxOpen}
        onOpenChange={(next): void => {
          setRightInboxOpen(next)
          if (next) setInboxPlacement('dock')
        }}
      />
      <CalendarShellColumnTopbarToggle
        columnId="calendar"
        open={calendarColumnOpen}
        onOpenChange={setCalendarColumnOpen}
      />
      <CalendarShellColumnTopbarToggle
        columnId="preview"
        open={rightPreviewOpen}
        onOpenChange={(next): void => {
          setRightPreviewOpen(next)
          if (next) setPreviewPlacement('dock')
        }}
      />
      <CalendarShellColumnTopbarToggle
        columnId="context"
        open={rightContextOpen}
        onOpenChange={(next): void => {
          setRightContextOpen(next)
          if (next) setContextPlacement('dock')
        }}
      />
    </>
  )
}
