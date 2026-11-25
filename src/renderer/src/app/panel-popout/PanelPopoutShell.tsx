import type { ReactNode } from 'react'
import { parsePanelPopoutRoute } from '@/app/panel-popout/panel-popout-route'
import { AppDialogHost } from '@/components/AppDialogHost'
import { ToastStack } from '@/components/ToastStack'
import { CalendarEventPopoutShell } from '@/app/panel-popout/shells/CalendarEventPopoutShell'
import { CalendarPreviewPopoutShell } from '@/app/panel-popout/shells/CalendarPreviewPopoutShell'
import { CalendarZeitlistePopoutShell } from '@/app/panel-popout/shells/CalendarZeitlistePopoutShell'
import { ComposePopoutShell } from '@/app/panel-popout/shells/ComposePopoutShell'
import { ConnectionsPreviewPopoutShell } from '@/app/panel-popout/shells/ConnectionsPreviewPopoutShell'
import { CustomViewZonePopoutShell } from '@/app/panel-popout/shells/CustomViewZonePopoutShell'
import { MailCalendarSidebarPopoutShell } from '@/app/panel-popout/shells/MailCalendarSidebarPopoutShell'

function PanelPopoutFrame({ children }: { children: ReactNode }): JSX.Element {
  return (
    <>
      {children}
      <ToastStack />
      <AppDialogHost />
    </>
  )
}

export function PanelPopoutShell(): JSX.Element {
  const route = parsePanelPopoutRoute()
  if (!route) {
    return (
      <PanelPopoutFrame>
        <div className="p-4 text-sm text-muted-foreground">Ungültiges Panel-Fenster.</div>
      </PanelPopoutFrame>
    )
  }

  let body: JSX.Element
  switch (route.panel) {
    case 'mail-calendar':
      body = <MailCalendarSidebarPopoutShell />
      break
    case 'calendar-zeitliste':
      body = <CalendarZeitlistePopoutShell />
      break
    case 'calendar-preview':
      body = <CalendarPreviewPopoutShell />
      break
    case 'calendar-event':
      body = <CalendarEventPopoutShell />
      break
    case 'connections-preview':
      body = <ConnectionsPreviewPopoutShell />
      break
    case 'compose':
      body = <ComposePopoutShell />
      break
    case 'custom-view-zone':
      body = <CustomViewZonePopoutShell />
      break
    default:
      body = <div className="p-4 text-sm text-muted-foreground">Unbekanntes Panel.</div>
      break
  }

  return <PanelPopoutFrame>{body}</PanelPopoutFrame>
}
