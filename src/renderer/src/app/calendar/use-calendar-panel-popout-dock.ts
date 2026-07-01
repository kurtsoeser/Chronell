import { useEffect, useRef } from 'react'
import type { PanelPopoutDockPayload } from '@shared/panel-popout'
import type { CalendarEventDialogStash } from '@/app/panel-popout/panel-popout-stash-types'
import type { SetCalendarShellEventDialog } from '@/app/calendar/calendar-shell-event-dialog-state'
import type { CalendarPreviewPopoutStash } from '@/app/panel-popout/panel-popout-stash-types'
import {
  applyCalendarPreviewPopoutStash,
  type ApplyCalendarPreviewPopoutStashHandlers
} from '@/lib/apply-calendar-preview-popout-stash'
import { CALENDAR_PANEL_POPOUT_DOCK_EVENT } from '@/lib/panel-popout-dock-handlers'
import { loadCalendarEventDialogStashFromDock } from '@/lib/panel-popout-dock-handlers'
import {
  persistRightInboxOpen,
  persistRightPreviewOpen
} from '@/app/calendar/calendar-shell-storage'
import { useAppModeStore } from '@/stores/app-mode'

export function useCalendarPanelPopoutDock(handlers: ApplyCalendarPreviewPopoutStashHandlers & {
  setRightInboxOpen: (open: boolean) => void
  setInboxPlacement: (p: 'dock' | 'float') => void
  setRightPreviewOpen: (open: boolean) => void
  setPreviewPlacement: (p: 'dock' | 'float') => void
  setEventDialog: SetCalendarShellEventDialog
}): void {
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => {
    const onDock = (e: Event): void => {
      const payload = (e as CustomEvent<PanelPopoutDockPayload>).detail
      if (!payload?.panel) return
      const h = handlersRef.current

      useAppModeStore.getState().setMode('calendar')

      if (payload.panel === 'calendar-zeitliste') {
        persistRightInboxOpen(true)
        h.setRightInboxOpen(true)
        h.setInboxPlacement('dock')
        return
      }

      if (payload.panel === 'calendar-preview') {
        const key = payload.stashKey?.trim()
        if (!key) return
        void (async (): Promise<void> => {
          const raw = await window.mailClient.panelPopout.takePayload(key)
          const stash = raw as CalendarPreviewPopoutStash | null
          if (!stash) return
          await applyCalendarPreviewPopoutStash(stash, h)
          persistRightPreviewOpen(true)
          h.setRightPreviewOpen(true)
          h.setPreviewPlacement('dock')
        })()
        return
      }

      if (payload.panel === 'calendar-event') {
        const key = payload.stashKey?.trim()
        if (!key) return
        void (async (): Promise<void> => {
          const stash = await loadCalendarEventDialogStashFromDock(key)
          if (!stash) return
          if (stash.mode === 'edit') {
            h.setEventDialog({ mode: 'edit', event: stash.event })
            return
          }
          const prefill = stash.createPrefill
          h.setEventDialog({
            mode: 'create',
            range: stash.range
              ? {
                  start: new Date(stash.range.start),
                  end: new Date(stash.range.end),
                  allDay: stash.range.allDay
                }
              : null,
            createPrefill:
              prefill?.subject != null || prefill?.location != null
                ? {
                    subject: prefill?.subject?.trim() ?? '',
                    location: prefill?.location?.trim() ?? ''
                  }
                : undefined,
            createAccountId: stash.createAccountId,
            createKind: stash.createKind,
            createGraphCalendarId: stash.createGraphCalendarId,
            createTaskListId: stash.createTaskListId
          })
        })()
      }
    }

    window.addEventListener(CALENDAR_PANEL_POPOUT_DOCK_EVENT, onDock)
    return (): void => window.removeEventListener(CALENDAR_PANEL_POPOUT_DOCK_EVENT, onDock)
  }, [])
}
