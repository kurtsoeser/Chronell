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
  const [stashError, setStashError] = useState<string | null>(null)
  const [stashLoaded, setStashLoaded] = useState(false)

  useZoomShortcuts()

  useEffect(() => {
    void useAccountsStore.getState().initialize()
  }, [])

  const stashKey = route?.params.get('stashKey')?.trim() ?? ''
  const panel = route?.panel
  const instanceKey = route?.instanceKey ?? ''

  useEffect(() => {
    if (!stashKey) {
      setStash(null)
      setStashError('Kein Termin-Kontext (stashKey fehlt).')
      setStashLoaded(true)
      return
    }
    let cancelled = false
    setStashLoaded(false)
    setStashError(null)
    void window.mailClient.panelPopout
      .takePayload(stashKey)
      .then((raw) => {
        if (cancelled) return
        const next = (raw as CalendarEventDialogStash | null) ?? null
        setStash(next)
        if (!next) {
          setStashError('Termindaten konnten nicht geladen werden. Bitte erneut als Fenster öffnen.')
        }
      })
      .catch((e) => {
        if (cancelled) return
        setStash(null)
        setStashError(e instanceof Error ? e.message : String(e))
      })
      .finally(() => {
        if (!cancelled) setStashLoaded(true)
      })
    return (): void => {
      cancelled = true
    }
  }, [stashKey])

  const close = useCallback((): void => {
    if (!panel) return
    void window.mailClient.panelPopout.close({ panel, instanceKey: instanceKey || undefined })
  }, [panel, instanceKey])

  const taskAccounts = useMemo(
    () => accounts.filter((a) => a.provider === 'microsoft' || a.provider === 'google'),
    [accounts]
  )

  const loadListsForAccount = useCallback(async (accountId: string) => {
    return window.mailClient.tasks.listLists({ accountId })
  }, [])

  if (!stashLoaded) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Termin wird geladen…
      </div>
    )
  }

  if (!stash) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-background px-6 text-center">
        <p className="text-sm text-foreground">{stashError ?? 'Kein Termin geladen.'}</p>
        <button
          type="button"
          onClick={close}
          className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary"
        >
          Schließen
        </button>
      </div>
    )
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
    if (!panel || !stash) return
    void requestPanelPopoutDock({
      panel: 'calendar-event',
      instanceKey,
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
        createPrefill={stash.mode === 'create' ? stash.createPrefill ?? null : null}
        initialCreateKind={stash.mode === 'create' ? stash.createKind : undefined}
        initialGraphCalendarId={stash.mode === 'create' ? stash.createGraphCalendarId : undefined}
        initialTaskListId={stash.mode === 'create' ? stash.createTaskListId : undefined}
        initialEvent={stash.mode === 'edit' ? stash.event : null}
        taskAccounts={taskAccounts}
        loadListsForAccount={loadListsForAccount}
        onClose={close}
        onSaved={(): void => close()}
      />
    </PopoutWindowChrome>
  )
}
