import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarEventDialog } from '@/app/calendar/CalendarEventDialog'
import { PopoutWindowChrome } from '@/app/panel-popout/PopoutWindowChrome'
import { parsePanelPopoutRoute } from '@/app/panel-popout/panel-popout-route'
import { requestPanelPopoutDock } from '@/lib/request-panel-popout-dock'
import type { CalendarEventDialogStash } from '@/app/panel-popout/panel-popout-stash-types'
import { useAccountsStore } from '@/stores/accounts'
import { useZoomShortcuts } from '@/hooks/use-zoom-shortcuts'

export function CalendarEventPopoutShell(): JSX.Element {
  const route = parsePanelPopoutRoute()
  const accounts = useAccountsStore((s) => s.accounts)
  const [stash, setStash] = useState<CalendarEventDialogStash | null>(null)

  useZoomShortcuts()

  useEffect(() => {
    void useAccountsStore.getState().initialize()
  }, [])

  useEffect(() => {
    const key = route?.params.get('stashKey')?.trim()
    if (!key) return
    void window.mailClient.panelPopout.takePayload(key).then((raw) => {
      setStash((raw as CalendarEventDialogStash | null) ?? null)
    })
  }, [route])

  const close = useCallback((): void => {
    if (!route) return
    void window.mailClient.panelPopout.close({ panel: route.panel, instanceKey: route.instanceKey || undefined })
  }, [route])

  const taskAccounts = useMemo(
    () => accounts.filter((a) => a.provider === 'microsoft' || a.provider === 'google'),
    [accounts]
  )

  const loadListsForAccount = useCallback(async (accountId: string) => {
    return window.mailClient.tasks.listLists({ accountId })
  }, [])

  if (!stash) {
    return <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">…</div>
  }

  const initialRange =
    stash.mode === 'create' && stash.range
      ? {
          start: new Date(stash.range.start),
          end: new Date(stash.range.end),
          allDay: stash.range.allDay
        }
      : undefined

  const title =
    stash.mode === 'edit'
      ? stash.event.title?.trim() || 'Termin'
      : stash.createPrefill?.subject?.trim() || 'Termin'

  const popIn = (): void => {
    if (!route || !stash) return
    void requestPanelPopoutDock({
      panel: 'calendar-event',
      instanceKey: route.instanceKey,
      stashPayload: stash
    })
  }

  return (
    <PopoutWindowChrome title={title} onClose={close} onPopIn={popIn}>
    <CalendarEventDialog
      open
      surface="osWindow"
      mode={stash.mode === 'edit' ? 'edit' : 'create'}
      accounts={accounts}
      defaultAccountId={
        stash.mode === 'create' ? stash.createAccountId : stash.event.accountId
      }
      initialRange={initialRange ?? null}
      createPrefill={stash.mode === 'create' ? stash.createPrefill : undefined}
      initialCreateKind={stash.mode === 'create' ? stash.createKind : undefined}
      initialGraphCalendarId={stash.mode === 'create' ? stash.createGraphCalendarId : undefined}
      initialTaskListId={stash.mode === 'create' ? stash.createTaskListId : undefined}
      initialEvent={stash.mode === 'edit' ? stash.event : null}
      taskAccounts={taskAccounts}
      loadListsForAccount={loadListsForAccount}
      onClose={close}
      onSaved={close}
    />
    </PopoutWindowChrome>
  )
}
