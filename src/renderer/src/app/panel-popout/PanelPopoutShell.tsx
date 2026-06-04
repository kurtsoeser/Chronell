import { parsePanelPopoutRoute } from '@/app/panel-popout/panel-popout-route'
import { CalendarEventPopoutShell } from '@/app/panel-popout/shells/CalendarEventPopoutShell'
import { CalendarPreviewPopoutShell } from '@/app/panel-popout/shells/CalendarPreviewPopoutShell'
import { CalendarZeitlistePopoutShell } from '@/app/panel-popout/shells/CalendarZeitlistePopoutShell'
import { ComposePopoutShell } from '@/app/panel-popout/shells/ComposePopoutShell'
import { ConnectionsPreviewPopoutShell } from '@/app/panel-popout/shells/ConnectionsPreviewPopoutShell'
import { CustomViewZonePopoutShell } from '@/app/panel-popout/shells/CustomViewZonePopoutShell'
import { MailCalendarSidebarPopoutShell } from '@/app/panel-popout/shells/MailCalendarSidebarPopoutShell'

export function PanelPopoutShell(): JSX.Element {
  const route = parsePanelPopoutRoute()
  if (!route) {
    return <div className="p-4 text-sm text-muted-foreground">Ungültiges Panel-Fenster.</div>
  }

  switch (route.panel) {
    case 'mail-calendar':
      return <MailCalendarSidebarPopoutShell />
    case 'calendar-zeitliste':
      return <CalendarZeitlistePopoutShell />
    case 'calendar-preview':
      return <CalendarPreviewPopoutShell />
    case 'calendar-event':
      return <CalendarEventPopoutShell />
    case 'connections-preview':
      return <ConnectionsPreviewPopoutShell />
    case 'compose':
      return <ComposePopoutShell />
    case 'custom-view-zone':
      return <CustomViewZonePopoutShell />
    default:
      return <div className="p-4 text-sm text-muted-foreground">Unbekanntes Panel.</div>
  }
}
