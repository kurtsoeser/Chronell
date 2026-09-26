import { useCallback, useEffect, useRef } from 'react'
import { ReadingPaneCompose } from '@/components/ReadingPaneCompose'
import { PopoutWindowChrome } from '@/app/panel-popout/PopoutWindowChrome'
import { parsePanelPopoutRoute } from '@/app/panel-popout/panel-popout-route'
import { requestPanelPopoutDock } from '@/lib/request-panel-popout-dock'
import type { ComposePopoutStash } from '@/app/panel-popout/panel-popout-stash-types'
import { useComposeStore } from '@/stores/compose'
import { useAccountsStore } from '@/stores/accounts'
import { useZoomShortcuts } from '@/hooks/use-zoom-shortcuts'

export function ComposePopoutShell(): JSX.Element {
  const route = parsePanelPopoutRoute()
  const panel = route?.panel
  const instanceKey = route?.instanceKey ?? ''
  const stashKey = route?.params.get('stashKey')?.trim() ?? ''
  const hadDraftRef = useRef(false)

  useZoomShortcuts()

  useEffect(() => {
    void useAccountsStore.getState().initialize()
  }, [])

  // Stash nur einmal laden. `takePayload` peekt (löscht nicht) — bei `[route]` als
  // Dependency würde jeder Re-Render den Entwurf mit dem Initialzustand überschreiben
  // (An-Feld: erstes Zeichen tippen → sofort wieder weg).
  useEffect(() => {
    if (!stashKey) return
    let cancelled = false
    void window.mailClient.panelPopout.takePayload(stashKey).then((raw) => {
      if (cancelled) return
      const draft = raw as ComposePopoutStash | null
      if (!draft?.id) return
      const existing = useComposeStore.getState().drafts.find((d) => d.id === draft.id)
      if (existing) return
      useComposeStore.setState({
        drafts: [{ ...draft, busy: false, error: null }],
        activeId: draft.id
      })
    })
    return (): void => {
      cancelled = true
    }
  }, [stashKey])

  const draft = useComposeStore((s) =>
    instanceKey ? s.drafts.find((d) => d.id === instanceKey) : undefined
  )
  const title = draft?.subject?.trim() || 'Neue E-Mail'

  const close = useCallback((): void => {
    if (!panel) return
    void window.mailClient.panelPopout.close({
      panel,
      instanceKey: instanceKey || undefined
    })
  }, [panel, instanceKey])

  // Nach Senden/Verwerfen ist der Draft weg — Floating-Fenster schließen
  // (nicht beim initialen Laden, solange der Stash noch fehlt).
  useEffect(() => {
    if (draft) {
      hadDraftRef.current = true
      return
    }
    if (!hadDraftRef.current) return
    close()
  }, [draft, close])

  const popIn = (): void => {
    if (!panel || !draft) return
    void requestPanelPopoutDock({
      panel: 'compose',
      instanceKey: draft.id,
      stashPayload: draft
    })
  }

  return (
    <PopoutWindowChrome title={title} onClose={close} onPopIn={popIn}>
      {draft ? (
        <ReadingPaneCompose draft={draft} hidePopOutButton />
      ) : (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          …
        </div>
      )}
    </PopoutWindowChrome>
  )
}
