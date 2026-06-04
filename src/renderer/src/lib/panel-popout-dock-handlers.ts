import { parseEntityRefKey } from '@shared/entity-ref'
import type { PanelPopoutDockPayload } from '@shared/panel-popout'
import type { CalendarEventDialogStash } from '@/app/panel-popout/panel-popout-stash-types'
import type { ComposePopoutStash } from '@/app/panel-popout/panel-popout-stash-types'
import { useAppModeStore } from '@/stores/app-mode'
import { useComposeStore } from '@/stores/compose'
import { useMailWorkspaceLayoutStore } from '@/stores/mail-workspace-layout'
import { parseCustomViewZonePopoutInstanceKey } from '@/lib/custom-view-zone-popout'
import { useCustomViewZonePopoutStore } from '@/stores/custom-view-zone-popout'
import { useCustomViewsStore } from '@/stores/custom-views'

export const PANEL_POPOUT_DOCK_EVENT = 'chronell:panel-popout-dock'

export const CALENDAR_PANEL_POPOUT_DOCK_EVENT = 'chronell:calendar-panel-popout-dock'

export const CONNECTIONS_PANEL_POPOUT_DOCK_EVENT = 'chronell:connections-panel-popout-dock'

export async function handlePanelPopoutDock(payload: PanelPopoutDockPayload): Promise<void> {
  switch (payload.panel) {
    case 'mail-calendar': {
      useAppModeStore.getState().setMode('mail')
      const layout = useMailWorkspaceLayoutStore.getState()
      layout.setCalendarOpen(true)
      layout.setCalendarPlacement('dock')
      return
    }
    case 'compose': {
      if (!payload.stashKey?.trim()) return
      const raw = await window.mailClient.panelPopout.takePayload(payload.stashKey.trim())
      const draft = raw as ComposePopoutStash | null
      if (!draft?.id) return
      const store = useComposeStore.getState()
      const existing = store.drafts.find((d) => d.id === draft.id)
      if (existing) {
        store.update(draft.id, { ...draft, busy: false, error: null, embedInReadingPane: false })
        store.focus(draft.id)
      } else {
        useComposeStore.setState({
          drafts: [...store.drafts, { ...draft, busy: false, error: null, embedInReadingPane: false }],
          activeId: draft.id
        })
      }
      useAppModeStore.getState().setMode('mail')
      return
    }
    case 'connections-preview':
      window.dispatchEvent(
        new CustomEvent<PanelPopoutDockPayload>(CONNECTIONS_PANEL_POPOUT_DOCK_EVENT, {
          detail: payload
        })
      )
      return
    case 'calendar-zeitliste':
    case 'calendar-preview':
    case 'calendar-event':
      window.dispatchEvent(
        new CustomEvent<PanelPopoutDockPayload>(CALENDAR_PANEL_POPOUT_DOCK_EVENT, {
          detail: payload
        })
      )
      return
    case 'custom-view-zone': {
      const viewId = payload.params?.viewId?.trim()
      const leafId = payload.params?.leafId?.trim()
      const parsed =
        viewId && leafId
          ? { viewId, leafId }
          : parseCustomViewZonePopoutInstanceKey(payload.instanceKey)
      if (!parsed) return
      useCustomViewZonePopoutStore.getState().clearPopped(parsed.viewId, parsed.leafId)
      useCustomViewsStore.getState().focusCustomView(parsed.viewId)
      return
    }
    default:
      return
  }
}

export async function handleMailReadingPopoutDock(messageId: number): Promise<void> {
  useAppModeStore.getState().setMode('mail')
  const layout = useMailWorkspaceLayoutStore.getState()
  layout.setReadingOpen(true)
  layout.setReadingPlacement('dock')
  const { useMailStore } = await import('@/stores/mail')
  await useMailStore.getState().selectMessageWithThreadPreview(messageId)
}


export function parseConnectionsDockRefKey(payload: PanelPopoutDockPayload): string | null {
  const fromParams = payload.params?.refKey?.trim()
  if (fromParams) return fromParams
  const ik = payload.instanceKey?.trim()
  return ik || null
}

export async function loadCalendarEventDialogStashFromDock(
  stashKey: string
): Promise<CalendarEventDialogStash | null> {
  const raw = await window.mailClient.panelPopout.takePayload(stashKey)
  return (raw as CalendarEventDialogStash | null) ?? null
}

export function entityRefFromDockPayload(payload: PanelPopoutDockPayload) {
  const refKey = parseConnectionsDockRefKey(payload)
  if (!refKey) return null
  return parseEntityRefKey(refKey)
}
