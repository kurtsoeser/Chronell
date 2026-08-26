import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { EntityGraphNode } from '@shared/entity-links'
import type { UserNoteListItem } from '@shared/types'
import {
  buildGraphNodeContextMenuItems,
  type GraphNodeContextAnchor,
  type GraphNodeContextHandlers
} from '@/app/connections/graph-node-context-menu'
import type { ContextMenuItem } from '@/components/ContextMenu'
import { accountSupportsCloudTasks } from '@/lib/cloud-task-accounts'
import {
  createMailSendAsNewNotionPageHandler,
  createMailSendToNotionHandler
} from '@/lib/notion-ui'
import { openEntityRef } from '@/lib/entity-link-nav'
import type { MailContextHandlers } from '@/lib/mail-context-menu'
import { useAccountsStore } from '@/stores/accounts'
import { useAppModeStore } from '@/stores/app-mode'
import { showAppAlert, showAppConfirm } from '@/stores/app-dialog'
import { useComposeStore } from '@/stores/compose'
import { useMailStore } from '@/stores/mail'
import { usePeoplePendingFocusStore } from '@/stores/people-pending-focus'
import { useSnoozeUiStore } from '@/stores/snooze-ui'

export function useGraphNodeContextMenu(refreshGraph: () => void | Promise<void>): {
  nodeContextMenu: { x: number; y: number; items: ContextMenuItem[] } | null
  closeNodeContextMenu: () => void
  openNodeContextMenu: (node: EntityGraphNode, anchor: GraphNodeContextAnchor) => void
} {
  const { t, i18n } = useTranslation()
  const accounts = useAccountsStore((s) => s.accounts)
  const setAppMode = useAppModeStore((s) => s.setMode)
  const openSnoozePicker = useSnoozeUiStore((s) => s.open)
  const openNewTo = useComposeStore((s) => s.openNewTo)
  const openReply = useComposeStore((s) => s.openReply)
  const openForward = useComposeStore((s) => s.openForward)

  const setMessageRead = useMailStore((s) => s.setMessageRead)
  const toggleMessageFlag = useMailStore((s) => s.toggleMessageFlag)
  const archiveMessage = useMailStore((s) => s.archiveMessage)
  const deleteMessage = useMailStore((s) => s.deleteMessage)
  const setTodoForMessage = useMailStore((s) => s.setTodoForMessage)
  const completeTodoForMessage = useMailStore((s) => s.completeTodoForMessage)
  const setWaitingForMessage = useMailStore((s) => s.setWaitingForMessage)
  const clearWaitingForMessage = useMailStore((s) => s.clearWaitingForMessage)
  const [nodeContextMenu, setNodeContextMenu] = useState<{
    x: number
    y: number
    items: ContextMenuItem[]
  } | null>(null)

  const mailHandlers = useMemo<MailContextHandlers>(
    () => ({
      openReply,
      openForward,
      setMessageRead,
      toggleMessageFlag,
      archiveMessage,
      deleteMessage: async (messageId: number): Promise<void> => {
        await deleteMessage(messageId)
        await refreshGraph()
      },
      setTodoForMessage: async (messageId: number, dueKind): Promise<void> => {
        await setTodoForMessage(messageId, dueKind)
        await refreshGraph()
      },
      completeTodoForMessage: async (messageId: number): Promise<void> => {
        await completeTodoForMessage(messageId)
        await refreshGraph()
      },
      setWaitingForMessage,
      clearWaitingForMessage,
      openSnoozePicker,
      refreshNow: refreshGraph,
      sendToNotion: createMailSendToNotionHandler(),
      sendToNotionAsNewPage: createMailSendAsNewNotionPageHandler()
    }),
    [
      openReply,
      openForward,
      setMessageRead,
      toggleMessageFlag,
      archiveMessage,
      deleteMessage,
      setTodoForMessage,
      completeTodoForMessage,
      setWaitingForMessage,
      clearWaitingForMessage,
      openSnoozePicker,
      refreshGraph
    ]
  )

  const handlers = useMemo<GraphNodeContextHandlers>(
    () => ({
      t,
      accounts,
      localeCode: i18n.language.startsWith('de') ? 'de' : 'en',
      calendarCollatorLocale: i18n.language.startsWith('de') ? 'de' : 'en',
      peopleSortBy: 'displayName',
      mailHandlers,
      openInModule: (ref): Promise<void> => openEntityRef(ref, setAppMode),
      refreshGraph,
      onComposeTo: (accountId, to): void => {
        openNewTo(accountId, to)
      },
      onEditContact: async (contact): Promise<void> => {
        usePeoplePendingFocusStore.getState().setPendingContactFocus(contact.id, { startEdit: true })
        setAppMode('people')
      },
      onDeleteContact: async (contact): Promise<void> => {
        const name =
          contact.displayName?.trim() || contact.primaryEmail?.trim() || String(contact.id)
        const ok = await showAppConfirm(
          t('people.shell.deleteContactConfirm', { name }),
          {
            title: t('people.shell.deleteContactTitle'),
            variant: 'danger',
            confirmLabel: t('people.shell.deleteContact')
          }
        )
        if (!ok) return
        await window.mailClient.people.deleteContact(contact.id)
        await refreshGraph()
      },
      onToggleContactFavorite: async (contact): Promise<void> => {
        await window.mailClient.people.setFavorite({
          accountId: contact.accountId,
          provider: contact.provider,
          remoteId: contact.remoteId,
          isFavorite: !contact.isFavorite
        })
        await refreshGraph()
      },
      onCopyText: async (text): Promise<void> => {
        try {
          await navigator.clipboard.writeText(text)
        } catch {
          await showAppAlert(t('calendar.errors.clipboardWriteFailed'))
        }
      },
      onDeleteNote: async (note): Promise<void> => {
        const title = note.title?.trim() || t('notes.shell.untitled')
        const ok = await showAppConfirm(t('notes.shell.deleteConfirm', { title }), {
          title: t('notes.shell.deleteTitle'),
          variant: 'danger',
          confirmLabel: t('common.delete')
        })
        if (!ok) return
        await window.mailClient.notes.delete(note.id)
        await refreshGraph()
      },
      onMoveNote: async (note, sectionId): Promise<void> => {
        await window.mailClient.notes.moveToSection({ noteId: note.id, sectionId })
        await refreshGraph()
      },
      onCopyNote: async (note): Promise<void> => {
        const full = (await window.mailClient.notes.getById(note.id)) ?? note
        const text = [full.title?.trim(), full.body?.trim()].filter(Boolean).join('\n\n')
        try {
          await navigator.clipboard.writeText(text)
        } catch {
          await showAppAlert(t('calendar.errors.clipboardWriteFailed'))
        }
      },
      onOpenNoteLinks: (note): void => {
        void openEntityRef({ kind: 'note', noteId: note.id }, setAppMode)
      },
      onRemoveEntityLink: async (linkId, anchor): Promise<void> => {
        await window.mailClient.entityLinks.remove({ linkId, anchor })
        await refreshGraph()
      },
      canCreateCloudTask: (accountId): boolean =>
        accountSupportsCloudTasks(accounts.find((a) => a.id === accountId))
    }),
    [t, accounts, i18n.language, mailHandlers, refreshGraph, setAppMode, openNewTo]
  )

  const closeNodeContextMenu = useCallback((): void => {
    setNodeContextMenu(null)
  }, [])

  const openNodeContextMenu = useCallback(
    (node: EntityGraphNode, anchor: GraphNodeContextAnchor): void => {
      void (async (): Promise<void> => {
        const items = await buildGraphNodeContextMenuItems(node, anchor, handlers)
        setNodeContextMenu({ x: anchor.x, y: anchor.y, items })
      })()
    },
    [handlers]
  )

  return { nodeContextMenu, closeNodeContextMenu, openNodeContextMenu }
}
