import { entityRefKey, type ChronellEntityRef } from '@shared/entity-ref'
import type { CalendarPreviewPopoutStash } from '@/app/panel-popout/panel-popout-stash-types'
import type { ComposeDraft } from '@/stores/compose'
import { openPanelPopout, panelPopoutStashKey } from '@/lib/open-panel-popout'

export async function openMailCalendarSidebarOsPopout(title: string): Promise<void> {
  await openPanelPopout({ panel: 'mail-calendar', title })
}

export async function openCalendarZeitlisteOsPopout(title: string): Promise<void> {
  await openPanelPopout({ panel: 'calendar-zeitliste', title })
}

export async function openCalendarPreviewOsPopout(
  stash: CalendarPreviewPopoutStash,
  title: string
): Promise<void> {
  let instanceKey = 'empty'
  if (stash.focus === 'event') instanceKey = `${stash.accountId}:${stash.graphEventId}`
  else if (stash.focus === 'task') instanceKey = `${stash.accountId}:${stash.listId}:${stash.taskId}`
  else if (stash.focus === 'mail') instanceKey = String(stash.messageId)
  else if (stash.focus === 'scheduling') instanceKey = 'scheduling'

  const stashKey = panelPopoutStashKey('calendar-preview', instanceKey)
  await openPanelPopout(
    {
      panel: 'calendar-preview',
      instanceKey,
      title,
      stashKey
    },
    stash
  )
}

export async function openConnectionsPreviewOsPopout(
  ref: ChronellEntityRef,
  title: string
): Promise<void> {
  const refKey = entityRefKey(ref)
  await openPanelPopout({
    panel: 'connections-preview',
    instanceKey: refKey,
    title,
    params: { refKey }
  })
}

export async function openComposeOsPopout(draft: ComposeDraft): Promise<void> {
  const stashKey = panelPopoutStashKey('compose', draft.id)
  const title = draft.subject.trim() || 'Neue E-Mail'
  await openPanelPopout(
    {
      panel: 'compose',
      instanceKey: draft.id,
      title,
      stashKey
    },
    draft
  )
}
