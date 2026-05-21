import { de, enUS } from 'date-fns/locale'
import type { TFunction } from 'i18next'
import { ExternalLink, Link2, ListTodo, Sparkles } from 'lucide-react'
import type { EntityLinkedItem } from '@shared/entity-links'
import type { ChronellEntityRef } from '@shared/entity-ref'
import type { EntityGraphNode } from '@shared/entity-links'
import type {
  CalendarEventView,
  ConnectedAccount,
  MailListItem,
  NoteSection,
  PeopleContactView,
  PeopleListSort,
  UserNoteListItem
} from '@shared/types'
import type { ContextMenuItem } from '@/components/ContextMenu'
import { peopleListPrimaryLabel } from '@/app/people/people-display-label'
import { confirmDeleteCloudTasks } from '@/app/tasks/confirm-delete-cloud-task'
import type { TaskItemWithContext } from '@/app/tasks/tasks-types'
import {
  mailListItemToWorkItem,
  taskItemToWorkItem
} from '@/app/work-items/work-item-mapper'
import {
  buildWorkItemContextMenuItems,
  type WorkItemContextHandlers
} from '@/app/work-items/work-item-context-menu'
import {
  buildCalendarEventCategorySubmenuItems,
  buildCalendarEventContextItems,
  formatCalendarEventClipboardText
} from '@/lib/calendar-event-context-menu'
import { deleteCalendarEventIpc } from '@/lib/calendar-ipc'
import { accountSupportsCloudTasks } from '@/lib/cloud-task-accounts'
import {
  buildMailCategorySubmenuItems,
  buildMailContextItems,
  type MailContextHandlers
} from '@/lib/mail-context-menu'
import { openExternalUrl } from '@/lib/open-external'
import {
  buildPeopleContactContextMenuItems,
  formatPeopleContactClipboardText
} from '@/lib/people-contact-context-menu'
import { buildNotesPageContextMenuItems } from '@/lib/notes-page-context-menu'
import { openGraphNodeAiSuggestLinks } from '@/lib/open-connections-graph'
import { useCreateCloudTaskUiStore } from '@/stores/create-cloud-task-ui'
import { showAppAlert, showAppConfirm } from '@/stores/app-dialog'

export type GraphNodeContextAnchor = { x: number; y: number }

export interface GraphNodeContextHandlers {
  t: TFunction
  accounts: readonly ConnectedAccount[]
  localeCode: 'de' | 'en'
  calendarCollatorLocale: string
  peopleSortBy: PeopleListSort
  mailHandlers: MailContextHandlers
  openInModule: (ref: ChronellEntityRef) => void | Promise<void>
  refreshGraph: () => void | Promise<void>
  onComposeTo: (accountId: string, to: string) => void
  onEditContact: (contact: PeopleContactView) => void | Promise<void>
  onDeleteContact: (contact: PeopleContactView) => void | Promise<void>
  onToggleContactFavorite: (contact: PeopleContactView) => void | Promise<void>
  onCopyText: (text: string) => void | Promise<void>
  onDeleteNote: (note: UserNoteListItem) => void | Promise<void>
  onMoveNote: (note: UserNoteListItem, sectionId: number | null) => void | Promise<void>
  onCopyNote: (note: UserNoteListItem) => void | Promise<void>
  onOpenNoteLinks: (note: UserNoteListItem) => void
  onRemoveEntityLink: (linkId: number, anchor: ChronellEntityRef) => void | Promise<void>
  canCreateCloudTask: (accountId: string) => boolean
}

function openModuleItem(h: GraphNodeContextHandlers, ref: ChronellEntityRef): ContextMenuItem {
  return {
    id: 'graph-open-module',
    label: h.t('connections.graph.context.openInModule'),
    icon: ExternalLink,
    onSelect: (): void => {
      void h.openInModule(ref)
    }
  }
}

function aiSuggestLinksItem(h: GraphNodeContextHandlers, node: EntityGraphNode): ContextMenuItem {
  return {
    id: 'graph-ai-suggest-links',
    label: h.t('connections.graph.context.aiSuggestLinks'),
    icon: Sparkles,
    onSelect: (): void => {
      openGraphNodeAiSuggestLinks(node.ref, node.title)
    }
  }
}

/** Mail-Kontextmenü enthält einen ähnlichen Eintrag – im Graph nur einmal anzeigen. */
function stripDuplicateAiMenuItems(items: ContextMenuItem[]): ContextMenuItem[] {
  return items.filter((item) => item.id !== 'ai-connections')
}

function linkRemoveMenuLabel(item: EntityLinkedItem, h: GraphNodeContextHandlers): string {
  const title = item.title?.trim()
  if (title) {
    return h.t('connections.graph.context.removeConnectionTo', { title })
  }
  return h.t('connections.graph.context.removeConnectionKind', {
    kind: h.t(`connections.kind.${item.peer.kind}`)
  })
}

async function buildConnectionRemoveMenuItems(
  anchor: ChronellEntityRef,
  h: GraphNodeContextHandlers
): Promise<ContextMenuItem[]> {
  try {
    const { links } = await window.mailClient.entityLinks.list(anchor)
    if (links.length === 0) return []

    const submenu: ContextMenuItem[] = links.map((item) => ({
      id: `graph-remove-link-${item.linkId}`,
      label: linkRemoveMenuLabel(item, h),
      destructive: true,
      onSelect: (): void => {
        void h.onRemoveEntityLink(item.linkId, anchor)
      }
    }))

    return [
      { id: 'graph-sep-connections', label: '', separator: true },
      {
        id: 'graph-connections-remove',
        label: h.t('connections.graph.context.removeConnections'),
        icon: Link2,
        submenu
      }
    ]
  } catch {
    return []
  }
}

async function loadCalendarEvent(ref: Extract<ChronellEntityRef, { kind: 'calendar_event' }>): Promise<CalendarEventView | null> {
  const now = new Date()
  const start = new Date(now)
  start.setMonth(start.getMonth() - 6)
  const end = new Date(now)
  end.setMonth(end.getMonth() + 12)
  const events = await window.mailClient.calendar.listEvents({
    startIso: start.toISOString(),
    endIso: end.toISOString()
  })
  return (
    events.find(
      (row) => row.accountId === ref.accountId && row.graphEventId === ref.graphEventId
    ) ?? null
  )
}

async function buildMailMenuItems(
  msg: MailListItem,
  anchor: GraphNodeContextAnchor,
  h: GraphNodeContextHandlers,
  opts?: { removeMailTodoOnly?: boolean; todoId?: number }
): Promise<ContextMenuItem[]> {
  const ui = { snoozeAnchor: anchor, t: h.t }
  const cat = await buildMailCategorySubmenuItems(msg, ui, h.refreshGraph)
  const account = h.accounts.find((a) => a.id === msg.accountId)
  const items = buildMailContextItems(msg, h.mailHandlers, {
    ...ui,
    categorySubmenu: cat.length > 0 ? cat : undefined,
    removeMailTodoOnly: opts?.removeMailTodoOnly,
    allowsCloudTaskCreate: accountSupportsCloudTasks(account),
    t: h.t
  })
  if (opts?.todoId != null && h.canCreateCloudTask(msg.accountId)) {
    return [
      {
        id: 'graph-promote-cloud',
        label: h.t('mail.promoteCloudTask.menu'),
        icon: ListTodo,
        onSelect: (): void => {
          useCreateCloudTaskUiStore.getState().open(msg, opts.todoId)
        }
      },
      { id: 'graph-sep-promote', label: '', separator: true },
      ...items
    ]
  }
  return items
}

function workItemHandlers(h: GraphNodeContextHandlers): WorkItemContextHandlers {
  return {
    t: h.t,
    mailHandlers: h.mailHandlers,
    canCreateCloudTask: h.canCreateCloudTask,
    onToggleCompleted: async (item): Promise<void> => {
      if (item.kind === 'mail_todo') {
        await h.mailHandlers.completeTodoForMessage(item.messageId)
      } else if (item.kind === 'cloud_task') {
        await window.mailClient.tasks.patchTask({
          accountId: item.accountId,
          listId: item.listId,
          taskId: item.taskId,
          completed: !item.completed
        })
      }
      await h.refreshGraph()
    },
    onShowInCalendar: (item): void => {
      if (item.kind === 'mail_todo') {
        void h.openInModule({ kind: 'mail', messageId: item.messageId })
        return
      }
      if (item.kind === 'cloud_task') {
        void h.openInModule({
          kind: 'cloud_task',
          accountId: item.accountId,
          listId: item.listId,
          taskId: item.taskId
        })
        return
      }
      const graphEventId = item.event.graphEventId?.trim()
      if (!graphEventId) return
      void h.openInModule({
        kind: 'calendar_event',
        accountId: item.event.accountId,
        graphEventId
      })
    },
    onOpenInMail: (item): void => {
      void h.openInModule({ kind: 'mail', messageId: item.messageId })
    },
    onOpenInTasks: (item): void => {
      void h.openInModule({
        kind: 'cloud_task',
        accountId: item.accountId,
        listId: item.listId,
        taskId: item.taskId
      })
    },
    onDeleteCloudTask: async (item): Promise<void> => {
      if (!(await confirmDeleteCloudTasks(h.t, 1))) return
      await window.mailClient.tasks.deleteTask({
        accountId: item.accountId,
        listId: item.listId,
        taskId: item.taskId
      })
      await h.refreshGraph()
    }
  }
}

async function buildCalendarMenuItems(
  ev: CalendarEventView,
  anchor: GraphNodeContextAnchor,
  h: GraphNodeContextHandlers
): Promise<ContextMenuItem[]> {
  const isDe = h.localeCode === 'de'
  const cat = await buildCalendarEventCategorySubmenuItems(
    ev,
    h.refreshGraph,
    h.t,
    h.calendarCollatorLocale
  )
  const hasGraphEvent = Boolean(ev.graphEventId?.trim())
  const canMutateEvent =
    ev.calendarCanEdit !== false &&
    hasGraphEvent &&
    (ev.source === 'microsoft' || ev.source === 'google')

  return buildCalendarEventContextItems(
    ev,
    canMutateEvent,
    false,
    false,
    false,
    {
      onEdit: (): void => {
        const graphEventId = ev.graphEventId?.trim()
        if (!graphEventId) return
        void h.openInModule({
          kind: 'calendar_event',
          accountId: ev.accountId,
          graphEventId
        })
      },
      onDuplicate: (): void => {
        const graphEventId = ev.graphEventId?.trim()
        if (!graphEventId) return
        void h.openInModule({
          kind: 'calendar_event',
          accountId: ev.accountId,
          graphEventId
        })
      },
      onOpenNote: (): void => {
        const graphEventId = ev.graphEventId?.trim()
        if (!graphEventId) return
        void h.openInModule({
          kind: 'calendar_event',
          accountId: ev.accountId,
          graphEventId
        })
      },
      onCopyDetails: (): void => {
        void h.onCopyText(
          formatCalendarEventClipboardText(ev, h.t, isDe ? de : enUS, isDe)
        )
      },
      onCopyWebLink: (): void => {
        const link = ev.webLink?.trim()
        if (link) void h.onCopyText(link)
      },
      onCopyJoinUrl: (): void => {
        const link = ev.joinUrl?.trim()
        if (link) void h.onCopyText(link)
      },
      onOpenWeb: (): void => {
        const link = ev.webLink?.trim()
        if (link) void openExternalUrl(link)
      },
      onOpenTeams: (): void => {
        const link = ev.joinUrl?.trim()
        if (link) void openExternalUrl(link)
      },
      onDelete: (): void => {
        void (async (): Promise<void> => {
          const ok = await showAppConfirm(h.t('calendar.confirm.deleteEventBody'), {
            title: h.t('calendar.confirm.deleteEventTitle'),
            variant: 'danger',
            confirmLabel: h.t('calendar.confirm.deleteEventConfirm')
          })
          if (!ok || !ev.graphEventId?.trim()) return
          try {
            await deleteCalendarEventIpc({
              accountId: ev.accountId,
              graphEventId: ev.graphEventId,
              graphCalendarId: ev.graphCalendarId ?? null
            })
            await h.refreshGraph()
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e)
            await showAppAlert(msg, { title: h.t('calendar.confirm.deleteEventTitle') })
          }
        })()
      }
    },
    h.t,
    { categorySubmenu: cat.length > 0 ? cat : undefined }
  )
}

function noteAsListItem(note: import('@shared/types').UserNote): UserNoteListItem {
  return {
    ...note,
    mailSubject: null,
    mailAccountId: null,
    mailFromAddr: null,
    mailFromName: null,
    mailSnippet: null,
    mailSentAt: null,
    mailReceivedAt: null,
    mailIsRead: null,
    mailHasAttachments: null,
    primaryLinkKind: null
  }
}

export async function buildGraphNodeContextMenuItems(
  node: EntityGraphNode,
  anchor: GraphNodeContextAnchor,
  h: GraphNodeContextHandlers
): Promise<ContextMenuItem[]> {
  const ref = node.ref
  const connectionItems = await buildConnectionRemoveMenuItems(ref, h)
  const head = [openModuleItem(h, ref), aiSuggestLinksItem(h, node), ...connectionItems]

  try {
    switch (ref.kind) {
      case 'mail': {
        const full = await window.mailClient.mail.getMessage(ref.messageId)
        if (!full) {
          return [
            ...head,
            {
              id: 'graph-missing',
              label: h.t('connections.graph.context.notFound'),
              disabled: true,
              onSelect: (): void => undefined
            }
          ]
        }
        const specific = stripDuplicateAiMenuItems(await buildMailMenuItems(full, anchor, h))
        return [...head, { id: 'graph-sep', label: '', separator: true }, ...specific]
      }
      case 'mail_todo': {
        const messageId = await window.mailClient.entityLinks.getMailTodoMessageId(ref.todoId)
        if (messageId == null) {
          return [
            ...head,
            {
              id: 'graph-missing',
              label: h.t('connections.graph.context.mailNotFound'),
              disabled: true,
              onSelect: (): void => undefined
            }
          ]
        }
        const full = await window.mailClient.mail.getMessage(messageId)
        if (!full) {
          return [
            ...head,
            {
              id: 'graph-missing',
              label: h.t('connections.graph.context.notFound'),
              disabled: true,
              onSelect: (): void => undefined
            }
          ]
        }
        const mailItem = { ...full, todoId: ref.todoId }
        const workItem = mailListItemToWorkItem(mailItem)
        const workItems = await buildWorkItemContextMenuItems(
          workItem,
          anchor,
          workItemHandlers(h)
        )
        return [...head, { id: 'graph-sep', label: '', separator: true }, ...workItems]
      }
      case 'calendar_event': {
        const ev = await loadCalendarEvent(ref)
        if (!ev) {
          return [
            ...head,
            {
              id: 'graph-missing',
              label: h.t('connections.graph.context.eventNotFound'),
              disabled: true,
              onSelect: (): void => undefined
            }
          ]
        }
        const specific = await buildCalendarMenuItems(ev, anchor, h)
        return [...head, { id: 'graph-sep', label: '', separator: true }, ...specific]
      }
      case 'cloud_task': {
        const lists = await window.mailClient.tasks.listLists({
          accountId: ref.accountId,
          cacheOnly: true
        })
        const list = lists.find((l) => l.id === ref.listId)
        const rows = await window.mailClient.tasks.listTasks({
          accountId: ref.accountId,
          listId: ref.listId
        })
        const task = rows.find((r) => r.id === ref.taskId)
        if (!task || !list) {
          return [
            ...head,
            {
              id: 'graph-missing',
              label: h.t('connections.graph.context.taskNotFound'),
              disabled: true,
              onSelect: (): void => undefined
            }
          ]
        }
        const ctx: TaskItemWithContext = {
          ...task,
          accountId: ref.accountId,
          listName: list.name
        }
        const workItem = taskItemToWorkItem(ctx)
        const workItems = await buildWorkItemContextMenuItems(
          workItem,
          anchor,
          workItemHandlers(h)
        )
        return [...head, { id: 'graph-sep', label: '', separator: true }, ...workItems]
      }
      case 'note': {
        const note = await window.mailClient.notes.getById(ref.noteId)
        if (!note) {
          return [
            ...head,
            {
              id: 'graph-missing',
              label: h.t('connections.graph.context.noteNotFound'),
              disabled: true,
              onSelect: (): void => undefined
            }
          ]
        }
        let sections: NoteSection[] = []
        try {
          sections = await window.mailClient.notes.sections.list()
        } catch {
          sections = []
        }
        const listItem = noteAsListItem(note)
        const specific = buildNotesPageContextMenuItems({
          t: h.t,
          note: listItem,
          sections,
          onDelete: h.onDeleteNote,
          onCopy: h.onCopyNote,
          onMove: h.onMoveNote,
          onLink: h.onOpenNoteLinks
        })
        return [...head, { id: 'graph-sep', label: '', separator: true }, ...specific]
      }
      case 'people_contact': {
        const contact = await window.mailClient.people.getById(ref.contactId)
        if (!contact) {
          return [
            ...head,
            {
              id: 'graph-missing',
              label: h.t('connections.graph.context.contactNotFound'),
              disabled: true,
              onSelect: (): void => undefined
            }
          ]
        }
        const specific = buildPeopleContactContextMenuItems({
          t: h.t,
          contact,
          sortBy: h.peopleSortBy,
          onEdit: h.onEditContact,
          onEmail: (c): void => {
            const to = c.primaryEmail?.trim()
            if (!to) return
            h.onComposeTo(c.accountId, to)
          },
          onToggleFavorite: h.onToggleContactFavorite,
          onCopyName: async (c): Promise<void> => {
            await h.onCopyText(peopleListPrimaryLabel(c, h.peopleSortBy))
          },
          onCopyEmail: async (c): Promise<void> => {
            const email = c.primaryEmail?.trim()
            if (email) await h.onCopyText(email)
          },
          onCopyDetails: async (c): Promise<void> => {
            await h.onCopyText(
              formatPeopleContactClipboardText(
                c,
                peopleListPrimaryLabel(c, h.peopleSortBy),
                h.peopleSortBy,
                h.t
              )
            )
          },
          onDelete: h.onDeleteContact
        })
        return [...head, { id: 'graph-sep', label: '', separator: true }, ...specific]
      }
      default:
        return head
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return [
      ...head,
      {
        id: 'graph-error',
        label: msg,
        disabled: true,
        onSelect: (): void => undefined
      }
    ]
  }
}
