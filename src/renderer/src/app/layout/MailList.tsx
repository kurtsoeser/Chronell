import { memo, useCallback, useEffect, useMemo, useState, type Ref } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { GroupedVirtuoso } from 'react-virtuoso'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { motionListItemExit } from '@/lib/motion'
import { useExitingIds } from '@/lib/use-exiting-ids'
import { outlookCategoryDotClass } from '@/lib/outlook-category-colors'
import { useMailStore, type MailFilter, type MailListKind, mailListUsesCrossAccountThreadScope } from '@/stores/mail'
import { showAppConfirm } from '@/stores/app-dialog'
import { useAccountsStore } from '@/stores/accounts'
import { useComposeStore } from '@/stores/compose'
import { useSnoozeUiStore } from '@/stores/snooze-ui'
import { openMailReadingPopout } from '@/lib/open-mail-reading-popout'
import { isMailClientRuntimeComplete } from '@/lib/mail-client-runtime'
import {
  getVisibleMailListHoverActions,
  type MailListHoverActionId,
  type MailListHoverBuiltinActionId
} from '@/lib/mail-list-hover-actions'
import { useMailListHoverActionPrefs } from '@/lib/use-mail-list-hover-action-prefs'
import { useUndoStore } from '@/stores/undo'
import { indexMessagesByThread, type ThreadGroup } from '@/lib/thread-group'
import {
  messageListDateIso,
  pickThreadLatestMessage,
  pickThreadRootMessage
} from '@/lib/thread-display-pick'
import {
  buildMailboxFlagExcludedFolderIds,
  threadMatchesMailboxFlaggedFilter
} from '@/lib/mail-flagged-mailbox-view'
import {
  dedupeMailListThreadMessagesById,
  MAIL_LIST_UNIFIED_INBOX_STRIPE_BAR
} from '@/lib/mail-list-ui'
import { MIME_THREAD_IDS } from '@/lib/workflow-dnd'
import {
  computeMailListLayout,
  filterMailListLayoutForCollapsedGroups,
  mailListGroupCollapseKey
} from '@/lib/mail-list-arrange'
import { ContextMenu, type ContextMenuItem } from '@/components/ContextMenu'
import {
  buildMailContextItems,
  buildMailCategorySubmenuItems,
  type MailContextHandlers
} from '@/lib/mail-context-menu'
import { accountSupportsCloudTasks } from '@/lib/cloud-task-accounts'
import {
  createMailSendAsNewNotionPageHandler,
  createMailSendToNotionHandler
} from '@/lib/notion-ui'
import { MailMoveSubmenuPanel } from '@/components/MailMoveSubmenuPanel'
import { MailDestinationFolderDialog } from '@/components/MailDestinationFolderDialog'
import { ObjectNoteDialog, type ObjectNoteTarget } from '@/components/ObjectNoteEditor'
import { Avatar } from '@/components/Avatar'
import { AccountColorStripe } from '@/components/AccountColorStripe'
import { resolvedAccountColorCss } from '@/lib/avatar-color'
import { combineSenderAvatarImageSrc, profilePhotoSrcForEmail } from '@/lib/contact-avatar'
import { useSenderContactPhoto } from '@/lib/use-sender-contact-photo'
import { normalizeMailSenderEmail } from '@shared/mail-sender-email'
import { useCreateContactFromMailStore } from '@/stores/create-contact-from-mail'
import { StatusDot } from '@/components/StatusDot'
import { MailListViewMenu } from '@/components/MailListViewMenu'
import { moduleColumnHeaderMailListRowClass } from '@/components/ModuleColumnHeader'
import { TodoDueBucketBadge } from '@/components/TodoDueBucketBadge'
import { parseOpenTodoDueKind } from '@/lib/todo-due-bucket'
import type { ChronellEntityRef } from '@shared/entity-ref'
import { entityRefKey } from '@shared/entity-ref'
import type { EntityLinkSuggestionCountEntry } from '@shared/entity-link-ai-payload'
import type {
  ConnectedAccount,
  MailFolder,
  MailListItem,
  MailQuickStep,
  TodoDueKindList
} from '@shared/types'
import { EntityLinkSuggestionBadge } from '@/components/connections/EntityLinkSuggestionBadge'
import { useEntityLinkSuggestionCounts } from '@/hooks/use-entity-link-suggestion-counts'
import { fetchAiConnectionsSettings } from '@/lib/entity-links-client'
import i18n from '@/i18n'
import {
  Paperclip,
  Star,
  Loader2,
  ChevronRight,
  ChevronDown,
  MessagesSquare,
  Reply,
  Archive,
  Trash2,
  Clock,
  PictureInPicture2,
  Forward,
  MailOpen,
  Mail,
  CheckSquare,
  Columns3
} from 'lucide-react'
import { resolveQuickStepHoverIcon } from '@/lib/mail-quickstep-hover-icon'
import { runMailQuickStep } from '@/lib/run-mail-quickstep'
import { QUICKSTEPS_CHANGED_EVENT } from '@/lib/quicksteps-changed'
import { useContainerWidth } from '@/hooks/useContainerWidth'
import { MailListTableColumnsDialog } from '@/components/MailListTableColumnsDialog'
import {
  MAIL_LIST_TABLE_BREAKPOINT_PX,
  buildMailListTableGridTemplate,
  readMailListTableColumns,
  type MailListTableColumnId
} from '@/lib/mail-list-table-columns'
import { formatMailListDate, threadSubFirstToDisplay } from '@/lib/mail-list-format'
import {
  MailListTableCell,
  MailListTableHeader,
  MailListTableRowIcons,
  type MailTableCellCtx
} from '@/app/layout/mail-list-table-parts'
import { useMailListBulkSelection, messageIdFromMailListRow } from '@/lib/mail-list-bulk-selection'
import { MailListRowCheckbox } from '@/components/MailListRowCheckbox'
import { MailListSelectableCheckbox } from '@/components/MailListSelectableCheckbox'
import { MailListBulkActionBar } from '@/components/MailListBulkActionBar'
import type { TodoDueKindOpen } from '@shared/types'

interface MailContextState {
  x: number
  y: number
  items: ContextMenuItem[]
}

type MailListContextOpts = {
  applyToMessageIds?: number[]
  threadMessagesForContext?: MailListItem[]
}

function resolveContextTargetIds(message: MailListItem, applyToMessageIds?: number[]): number[] {
  const raw = applyToMessageIds?.filter((id) => Number.isFinite(id)) ?? []
  if (raw.length === 0) return [message.id]
  return [...new Set(raw)]
}

function resolveContextMsgs(
  message: MailListItem,
  threadMessagesForContext?: MailListItem[]
): MailListItem[] {
  if (threadMessagesForContext && threadMessagesForContext.length > 0) return threadMessagesForContext
  return [message]
}

interface MailRowHandlers {
  onReply: (e: React.MouseEvent, msg: MailListItem) => void
  onArchive: (e: React.MouseEvent, msg: MailListItem, bulkThread?: MailListItem[]) => void
  onDelete: (e: React.MouseEvent, msg: MailListItem, bulkThread?: MailListItem[]) => void
  onToggleFlag: (e: React.MouseEvent, msg: MailListItem, bulkThread?: MailListItem[]) => void
  onPopout: (e: React.MouseEvent, msg: MailListItem) => void
  onForward: (e: React.MouseEvent, msg: MailListItem) => void
  onSnooze: (e: React.MouseEvent, msg: MailListItem) => void
  onMarkRead: (e: React.MouseEvent, msg: MailListItem, bulkThread?: MailListItem[]) => void
  onMarkUnread: (e: React.MouseEvent, msg: MailListItem, bulkThread?: MailListItem[]) => void
  onTodo: (e: React.MouseEvent, msg: MailListItem) => void
  onQuickStep: (
    e: React.MouseEvent,
    msg: MailListItem,
    quickStepId: number,
    bulkThread?: MailListItem[]
  ) => void
}

export function MailList(): JSX.Element {
  const { t } = useTranslation()
  const { ref: listPanelRef, width: listPanelWidth } = useContainerWidth<HTMLElement>()
  const tableMode = listPanelWidth >= MAIL_LIST_TABLE_BREAKPOINT_PX
  const [tableColumns, setTableColumns] = useState<MailListTableColumnId[]>(() =>
    readMailListTableColumns()
  )
  const [columnsDialogOpen, setColumnsDialogOpen] = useState(false)
  const tableGridTemplate = useMemo(
    () => buildMailListTableGridTemplate(tableColumns),
    [tableColumns]
  )
  const showPreviewInSubject = !tableColumns.includes('preview')
  const {
    messages,
    selectedMessageId,
    selectedFolderId: selectFolderId,
    selectedFolderAccountId: selectFolderAccountId,
    listKind,
    todoDueKind,
    loading,
    expandedThreads,
    foldersByAccount,
    syncByAccount,
    metaFolders,
    selectedMetaFolderId,
    selectedCategoryName
  } = useMailStore(
    useShallow((s) => ({
      messages: s.messages,
      selectedMessageId: s.selectedMessageId,
      selectedFolderId: s.selectedFolderId,
      selectedFolderAccountId: s.selectedFolderAccountId,
      listKind: s.listKind,
      todoDueKind: s.todoDueKind,
      loading: s.loading,
      expandedThreads: s.expandedThreads,
      foldersByAccount: s.foldersByAccount,
      syncByAccount: s.syncByAccount,
      metaFolders: s.metaFolders,
      selectedMetaFolderId: s.selectedMetaFolderId,
      selectedCategoryName: s.selectedCategoryName
    }))
  )
  const [aiHintsEnabled, setAiHintsEnabled] = useState(false)
  useEffect(() => {
    void fetchAiConnectionsSettings()
      .then((s) => setAiHintsEnabled(s.enabled && s.hasActiveApiKey))
      .catch(() => setAiHintsEnabled(false))
  }, [])

  const mailAnchors = useMemo((): ChronellEntityRef[] => {
    const seen = new Set<number>()
    const out: ChronellEntityRef[] = []
    for (const m of messages) {
      if (seen.has(m.id)) continue
      seen.add(m.id)
      out.push({ kind: 'mail', messageId: m.id })
      if (out.length >= 150) break
    }
    return out
  }, [messages])

  const suggestionHints = useEntityLinkSuggestionCounts(mailAnchors, aiHintsEnabled)

  const threadMessages = useMailStore(useShallow((s) => s.threadMessages))
  const {
    selectMessage,
    toggleThreadExpanded,
    setMessageRead,
    toggleMessageFlag,
    archiveMessage,
    deleteMessage,
    removeMailTodoRecordsForMessage,
    moveMessagesToFolder,
    setWaitingForMessage,
    clearWaitingForMessage,
    setTodoForMessage,
    completeTodoForMessage,
    refreshNow,
    emptyTrashFolder
  } = useMailStore(
    useShallow((s) => ({
      selectMessage: s.selectMessage,
      toggleThreadExpanded: s.toggleThreadExpanded,
      setMessageRead: s.setMessageRead,
      toggleMessageFlag: s.toggleMessageFlag,
      archiveMessage: s.archiveMessage,
      deleteMessage: s.deleteMessage,
      removeMailTodoRecordsForMessage: s.removeMailTodoRecordsForMessage,
      moveMessagesToFolder: s.moveMessagesToFolder,
      setWaitingForMessage: s.setWaitingForMessage,
      clearWaitingForMessage: s.clearWaitingForMessage,
      setTodoForMessage: s.setTodoForMessage,
      completeTodoForMessage: s.completeTodoForMessage,
      refreshNow: s.refreshNow,
      emptyTrashFolder: s.emptyTrashFolder
    }))
  )
  const { accounts, profilePhotoDataUrls } = useAccountsStore(
    useShallow((s) => ({ accounts: s.accounts, profilePhotoDataUrls: s.profilePhotoDataUrls }))
  )
  const openReply = useComposeStore((s) => s.openReply)
  const openForward = useComposeStore((s) => s.openForward)
  const openSnoozePicker = useSnoozeUiStore((s) => s.open)
  const [quickSteps, setQuickSteps] = useState<MailQuickStep[]>([])
  const hoverPrefs = useMailListHoverActionPrefs(quickSteps)
  const visibleHoverActions = useMemo(
    () => getVisibleMailListHoverActions(hoverPrefs),
    [hoverPrefs]
  )

  const reloadQuickSteps = useCallback((): void => {
    if (!isMailClientRuntimeComplete()) return
    void window.mailClient.mail
      .listQuickSteps()
      .then(setQuickSteps)
      .catch(() => setQuickSteps([]))
  }, [])

  useEffect(() => {
    reloadQuickSteps()
    const onChanged = (): void => reloadQuickSteps()
    window.addEventListener(QUICKSTEPS_CHANGED_EVENT, onChanged)
    return (): void => window.removeEventListener(QUICKSTEPS_CHANGED_EVENT, onChanged)
  }, [reloadQuickSteps])

  const [contextMenu, setContextMenu] = useState<MailContextState | null>(null)
  const [moveFolderPicker, setMoveFolderPicker] = useState<{
    accountId: string
    messageIds: number[]
  } | null>(null)
  const [noteTarget, setNoteTarget] = useState<ObjectNoteTarget | null>(null)
  const [emptyingTrash, setEmptyingTrash] = useState(false)
  const filter = useMailStore((s) => s.mailFilter)
  const flaggedFilterExcludeDeletedJunk = useMailStore((s) => s.flaggedFilterExcludeDeletedJunk)
  const setFilter = useMailStore((s) => s.setMailFilter)
  const mailListArrangeBy = useMailStore((s) => s.mailListArrangeBy)
  const mailListChronoOrder = useMailStore((s) => s.mailListChronoOrder)
  const setMailListArrangeBy = useMailStore((s) => s.setMailListArrangeBy)
  const setMailListChronoOrder = useMailStore((s) => s.setMailListChronoOrder)
  const collapsedMailListGroupKeys = useMailStore((s) => s.collapsedMailListGroupKeys)
  const toggleMailListGroupCollapsed = useMailStore((s) => s.toggleMailListGroupCollapsed)

  async function withFullMessage<T>(
    messageId: number,
    fn: (msg: import('@shared/types').MailFull) => Promise<T> | T
  ): Promise<T | void> {
    const full = await window.mailClient.mail.getMessage(messageId)
    if (!full) return
    return fn(full)
  }

  function openReplyForMessage(messageId: number): void {
    void withFullMessage(messageId, (full) => openReply('reply', full))
  }

  function openForwardForMessage(messageId: number): void {
    void withFullMessage(messageId, (full) => openForward(full))
  }

  const deleteMessageOrRemoveTodoEntry = useCallback(
    async (messageId: number): Promise<void> => {
      if (listKind === 'todo') {
        await removeMailTodoRecordsForMessage(messageId)
      } else {
        await deleteMessage(messageId)
      }
    },
    [listKind, deleteMessage, removeMailTodoRecordsForMessage]
  )

  const mailContextHandlers = useMemo<MailContextHandlers>(
    () => ({
      openReply,
      openForward,
      openNote: (message): void => {
        void selectMessage(message.id)
        setNoteTarget({
          kind: 'mail',
          messageId: message.id,
          title: message.subject || t('common.noSubject')
        })
      },
      setMessageRead,
      toggleMessageFlag,
      archiveMessage,
      deleteMessage: deleteMessageOrRemoveTodoEntry,
      setTodoForMessage,
      completeTodoForMessage,
      setWaitingForMessage,
      clearWaitingForMessage,
      openSnoozePicker,
      refreshNow,
      sendToNotion: createMailSendToNotionHandler(),
      sendToNotionAsNewPage: createMailSendAsNewNotionPageHandler(),
      createContactFromSender: (message): void => {
        useCreateContactFromMailStore.getState().openFromMessage(message)
      },
      openSenderContact: (contactId): void => {
        useCreateContactFromMailStore.getState().openContactInPeople(contactId)
      }
    }),
    [
      openReply,
      openForward,
      selectMessage,
      t,
      setMessageRead,
      toggleMessageFlag,
      archiveMessage,
      deleteMessageOrRemoveTodoEntry,
      setTodoForMessage,
      completeTodoForMessage,
      setWaitingForMessage,
      clearWaitingForMessage,
      openSnoozePicker,
      refreshNow
    ]
  )

  const { isExiting, markExiting } = useExitingIds<number>()

  const rowActions: MailRowHandlers = {
    onReply: (e, m): void => {
      e.stopPropagation()
      openReplyForMessage(m.id)
    },
    onArchive: (e, m, bulk): void => {
      e.stopPropagation()
      const targets =
        bulk && bulk.length > 1 ? dedupeMailListThreadMessagesById(bulk) : [m]
      void (async (): Promise<void> => {
        for (const x of targets) await archiveMessage(x.id)
      })()
    },
    onDelete: (e, m, bulk): void => {
      e.stopPropagation()
      const targets =
        bulk && bulk.length > 1 ? dedupeMailListThreadMessagesById(bulk) : [m]
      const ids = targets.map((x) => x.id)
      markExiting(ids, () => {
        void (async (): Promise<void> => {
          for (const x of targets) await deleteMessageOrRemoveTodoEntry(x.id)
        })()
      })
    },
    onToggleFlag: (e, m, bulk): void => {
      e.stopPropagation()
      const targets =
        bulk && bulk.length > 1 ? dedupeMailListThreadMessagesById(bulk) : [m]
      if (targets.length === 1) {
        void toggleMessageFlag(m.id)
        return
      }
      const allFlagged = targets.every((x) => x.isFlagged)
      void (async (): Promise<void> => {
        for (const x of targets) {
          if (allFlagged && x.isFlagged) await toggleMessageFlag(x.id)
          if (!allFlagged && !x.isFlagged) await toggleMessageFlag(x.id)
        }
      })()
    },
    onPopout: (e, m): void => {
      e.stopPropagation()
      openMailReadingPopout(m.id, { osWindow: e.shiftKey })
    },
    onForward: (e, m): void => {
      e.stopPropagation()
      openForwardForMessage(m.id)
    },
    onSnooze: (e, m): void => {
      e.stopPropagation()
      openSnoozePicker(m.id, { x: e.clientX, y: e.clientY })
    },
    onMarkRead: (e, m, bulk): void => {
      e.stopPropagation()
      const targets =
        bulk && bulk.length > 1 ? dedupeMailListThreadMessagesById(bulk) : [m]
      void (async (): Promise<void> => {
        for (const x of targets) await setMessageRead(x.id, true)
      })()
    },
    onMarkUnread: (e, m, bulk): void => {
      e.stopPropagation()
      const targets =
        bulk && bulk.length > 1 ? dedupeMailListThreadMessagesById(bulk) : [m]
      void (async (): Promise<void> => {
        for (const x of targets) await setMessageRead(x.id, false)
      })()
    },
    onTodo: (e, m): void => {
      e.stopPropagation()
      void setTodoForMessage(m.id, 'today')
    },
    onQuickStep: (e, m, quickStepId, bulk): void => {
      e.stopPropagation()
      void runMailQuickStep(quickStepId, m, bulk).catch((err) =>
        console.warn('[MailList] QuickStep:', err)
      )
    }
  }

  const account =
    listKind === 'folder'
      ? accounts.find((a) => a.id === selectFolderAccountId)
      : mailListUsesCrossAccountThreadScope(listKind)
        ? null
        : (accounts.find((a) => a.id === messages[0]?.accountId) ?? accounts[0])
  const folder =
    listKind === 'folder' && account
      ? foldersByAccount[account.id]?.find((f) => f.id === selectFolderId)
      : null

  const sync =
    mailListUsesCrossAccountThreadScope(listKind)
      ? (Object.values(syncByAccount).find((s) => s.state.startsWith('syncing')) ??
        Object.values(syncByAccount).find((s) => s.state === 'error') ??
        null)
      : account
        ? syncByAccount[account.id]
        : null

  const metaFolderTitle = useMemo((): string => {
    if (listKind !== 'meta_folder' || selectedMetaFolderId == null) return t('mail.list.metaFolder')
    return metaFolders.find((m) => m.id === selectedMetaFolderId)?.name ?? t('mail.list.metaFolder')
  }, [listKind, selectedMetaFolderId, metaFolders, t])

  const folderTitle =
    listKind === 'waiting'
      ? t('mail.list.waitingTitle')
      : listKind === 'snoozed'
        ? t('mail.list.snoozedTitle')
        : listKind === 'unified_inbox'
          ? t('mail.list.unifiedInbox')
          : listKind === 'category'
            ? selectedCategoryName?.trim() || 'Kategorie'
          : listKind === 'meta_folder'
            ? metaFolderTitle
            : listKind === 'todo'
              ? todoDueKind
                ? t(`mail.todoViewTitle.${todoDueKind}`)
                : t('mail.todoViewTitle.unified')
              : folder
                ? folder.wellKnown === 'inbox'
                  ? t('mail.list.wellKnownInbox')
                  : folder.name
                : t('mail.list.noSelection')

  const unifiedInboxUnread = useMemo(() => {
    if (listKind !== 'unified_inbox') return 0
    return Object.values(foldersByAccount)
      .flat()
      .filter((f) => f.wellKnown === 'inbox')
      .reduce((sum, f) => sum + (f.unreadCount ?? 0), 0)
  }, [listKind, foldersByAccount])

  const { threads, messagesByThread } = useMemo(
    () =>
      indexMessagesByThread(messages, threadMessages, mailListUsesCrossAccountThreadScope(listKind)),
    [messages, threadMessages, listKind]
  )

  const mailboxFlagExcludedFolderIds = useMemo(
    () => buildMailboxFlagExcludedFolderIds(foldersByAccount),
    [foldersByAccount]
  )

  const filterCounts = useMemo(() => {
    let unread = 0
    let flagged = 0
    let withTodo = 0
    for (const t of threads) {
      if (t.unreadCount > 0) unread++
      if (
        threadMatchesMailboxFlaggedFilter(
          t,
          messagesByThread,
          mailboxFlagExcludedFolderIds,
          flaggedFilterExcludeDeletedJunk
        )
      ) {
        flagged++
      }
      if (t.openTodoDueKind != null) withTodo++
    }
    return { all: threads.length, unread, flagged, withTodo }
  }, [threads, messagesByThread, mailboxFlagExcludedFolderIds, flaggedFilterExcludeDeletedJunk])

  const filteredThreads = useMemo(() => {
    if (filter === 'all') return threads
    if (filter === 'unread') return threads.filter((t) => t.unreadCount > 0)
    if (filter === 'flagged')
      return threads.filter((t) =>
        threadMatchesMailboxFlaggedFilter(
          t,
          messagesByThread,
          mailboxFlagExcludedFolderIds,
          flaggedFilterExcludeDeletedJunk
        )
      )
    if (filter === 'with_todo') return threads.filter((t) => t.openTodoDueKind != null)
    return threads
  }, [threads, filter, messagesByThread, mailboxFlagExcludedFolderIds, flaggedFilterExcludeDeletedJunk])

  const accountById = useMemo(
    () => new Map(accounts.map((a) => [a.id, a] as const)),
    [accounts]
  )

  const arrangeCtx = useMemo(
    () => ({
      folderWellKnown:
        listKind === 'folder' && folder ? (folder.wellKnown ?? null) : null,
      accountLabel: (id: string): string => {
        const a = accountById.get(id)
        return a?.email ?? a?.displayName ?? id
      },
      todoDueBucketLabel: (kind: TodoDueKindList): string => t(`mail.todoBucket.${kind}`),
      noOpenTodoLabel: t('mail.noOpenTodo')
    }),
    [listKind, folder, accountById, t]
  )

  const { groupLabels, groupCounts, groupTodoDueKinds, flatRows } = useMemo(
    () =>
      computeMailListLayout(
        filteredThreads,
        messagesByThread,
        expandedThreads,
        mailListArrangeBy,
        mailListChronoOrder,
        arrangeCtx
      ),
    [
      filteredThreads,
      messagesByThread,
      expandedThreads,
      mailListArrangeBy,
      mailListChronoOrder,
      arrangeCtx
    ]
  )

  const { visibleGroupCounts, visibleFlatRows } = useMemo(
    () =>
      filterMailListLayoutForCollapsedGroups(
        groupLabels,
        groupCounts,
        flatRows,
        mailListArrangeBy,
        collapsedMailListGroupKeys
      ),
    [
      groupLabels,
      groupCounts,
      flatRows,
      mailListArrangeBy,
      collapsedMailListGroupKeys
    ]
  )

  const listScopeKey = `${listKind}:${selectFolderId ?? ''}:${selectFolderAccountId ?? ''}:${selectedMetaFolderId ?? ''}:${selectedCategoryName ?? ''}:${todoDueKind ?? ''}:${filter}`
  const bulkSelection = useMailListBulkSelection(visibleFlatRows, listScopeKey)
  const bulkSelectionMode = bulkSelection.selectionUiActive

  const messageById = useMemo((): Map<number, MailListItem> => {
    const map = new Map<number, MailListItem>()
    for (const m of messages) map.set(m.id, m)
    for (const list of Object.values(threadMessages)) {
      for (const m of list) map.set(m.id, m)
    }
    return map
  }, [messages, threadMessages])

  const bulkSelectedMessages = useMemo((): MailListItem[] => {
    const out: MailListItem[] = []
    for (const id of bulkSelection.selectedIds) {
      const m = messageById.get(id)
      if (m) out.push(m)
    }
    return out
  }, [bulkSelection.selectedIds, messageById])

  const resolveBulkContextIds = useCallback(
    (message: MailListItem, opts?: MailListContextOpts): number[] => {
      if (bulkSelection.selectedCount > 0 && bulkSelection.isSelected(message.id)) {
        return [...bulkSelection.selectedIds]
      }
      return resolveContextTargetIds(message, opts?.applyToMessageIds)
    },
    [bulkSelection]
  )

  const runBulkArchive = useCallback((): void => {
    const ids = [...bulkSelection.selectedIds]
    markExiting(ids, () => {
      void (async (): Promise<void> => {
        for (const id of ids) await archiveMessage(id)
        bulkSelection.clear()
      })()
    })
  }, [bulkSelection, archiveMessage, markExiting])

  const runBulkDelete = useCallback((): void => {
    const ids = [...bulkSelection.selectedIds]
    markExiting(ids, () => {
      void (async (): Promise<void> => {
        for (const id of ids) await deleteMessageOrRemoveTodoEntry(id)
        bulkSelection.clear()
      })()
    })
  }, [bulkSelection, deleteMessageOrRemoveTodoEntry, markExiting])

  const runBulkMarkRead = useCallback((): void => {
    void (async (): Promise<void> => {
      for (const id of bulkSelection.selectedIds) await setMessageRead(id, true)
    })()
  }, [bulkSelection.selectedIds, setMessageRead])

  const runBulkMarkUnread = useCallback((): void => {
    void (async (): Promise<void> => {
      for (const id of bulkSelection.selectedIds) await setMessageRead(id, false)
    })()
  }, [bulkSelection.selectedIds, setMessageRead])

  const runBulkToggleFlag = useCallback((): void => {
    const listed = bulkSelectedMessages
    if (listed.length === 0) return
    const allFlagged = listed.every((m) => m.isFlagged)
    void (async (): Promise<void> => {
      for (const m of listed) {
        if (allFlagged && m.isFlagged) await toggleMessageFlag(m.id)
        if (!allFlagged && !m.isFlagged) await toggleMessageFlag(m.id)
      }
    })()
  }, [bulkSelectedMessages, toggleMessageFlag])

  const runBulkTodo = useCallback(
    (dueKind: TodoDueKindOpen): void => {
      void (async (): Promise<void> => {
        for (const id of bulkSelection.selectedIds) await setTodoForMessage(id, dueKind)
      })()
    },
    [bulkSelection.selectedIds, setTodoForMessage]
  )

  const runBulkMove = useCallback((): void => {
    const listed = bulkSelectedMessages
    if (listed.length === 0) return
    const accountIds = new Set(listed.map((m) => m.accountId))
    if (accountIds.size !== 1) return
    setMoveFolderPicker({
      accountId: listed[0]!.accountId,
      messageIds: [...bulkSelection.selectedIds]
    })
  }, [bulkSelectedMessages, bulkSelection.selectedIds])

  const runBulkSnooze = useCallback(
    (anchor: { x: number; y: number }): void => {
      const ids = [...bulkSelection.selectedIds]
      if (ids.length === 0) return
      openSnoozePicker(ids[0]!, anchor, ids)
    },
    [bulkSelection.selectedIds, openSnoozePicker]
  )

  const openMailContext = useCallback(
    async (
      e: React.MouseEvent,
      message: MailListItem,
      opts?: MailListContextOpts
    ): Promise<void> => {
      e.preventDefault()
      e.stopPropagation()
      const anchor = { x: e.clientX, y: e.clientY }
      const targetIds = resolveBulkContextIds(message, opts)
      const useBulkCtx =
        bulkSelection.selectedCount > 0 && bulkSelection.isSelected(message.id)
      const ctxMsgs = useBulkCtx
        ? bulkSelectedMessages
        : resolveContextMsgs(message, opts?.threadMessagesForContext)
      const ui = {
        snoozeAnchor: anchor,
        applyToMessageIds: targetIds,
        threadMessagesForContext:
          ctxMsgs.length > 1 ? ctxMsgs : opts?.threadMessagesForContext
      }
      const cat = await buildMailCategorySubmenuItems(message, ui, refreshNow)
      const ctxAccountIds = new Set(ctxMsgs.map((m) => m.accountId))
      const primaryAcc = accounts.find((a) => a.id === message.accountId)
      const canMoveToFolder =
        ctxAccountIds.size === 1 &&
        (primaryAcc?.provider === 'microsoft' || primaryAcc?.provider === 'google')

      const moveSubmenuContent =
        canMoveToFolder && primaryAcc
          ? (
              <MailMoveSubmenuPanel
                messageIds={targetIds}
                accountId={message.accountId}
                folders={foldersByAccount[message.accountId] ?? []}
                isGmail={primaryAcc.provider === 'google'}
                onCloseRoot={(): void => setContextMenu(null)}
                onBrowseOther={(): void =>
                  setMoveFolderPicker({
                    accountId: message.accountId,
                    messageIds: targetIds
                  })
                }
              />
            )
          : undefined

      let senderContactId: number | null = null
      if (normalizeMailSenderEmail(message.fromAddr)) {
        try {
          const hit = await window.mailClient.people.findByEmail({
            email: message.fromAddr!,
            accountId: message.accountId
          })
          senderContactId = hit?.id ?? null
        } catch {
          senderContactId = null
        }
      }

      const items = buildMailContextItems(message, mailContextHandlers, {
        ...ui,
        categorySubmenu: cat.length > 0 ? cat : undefined,
        deletedItemsFolder: listKind === 'folder' && folder?.wellKnown === 'deleteditems',
        removeMailTodoOnly: listKind === 'todo',
        moveSubmenuContent,
        allowsCloudTaskCreate: accountSupportsCloudTasks(primaryAcc),
        senderContactId,
        t
      })
      setContextMenu({ x: anchor.x, y: anchor.y, items })
    },
    [
      resolveBulkContextIds,
      bulkSelection,
      bulkSelectedMessages,
      mailContextHandlers,
      refreshNow,
      listKind,
      folder,
      t,
      accounts,
      foldersByAccount
    ]
  )

  return (
    <section
      ref={listPanelRef as Ref<HTMLElement>}
      className="flex h-full w-full flex-col"
    >
      <div className={moduleColumnHeaderMailListRowClass}>
        <div className="flex min-w-0 shrink-0 items-center gap-2">
          {bulkSelectionMode ? (
            <MailListRowCheckbox
              checked={bulkSelection.allVisibleSelected}
              indeterminate={
                bulkSelection.someVisibleSelected && !bulkSelection.allVisibleSelected
              }
              ariaLabel={
                bulkSelection.allVisibleSelected
                  ? t('mail.list.deselectAllVisible')
                  : t('mail.list.selectAllVisible')
              }
              onChange={(): void => {
                if (bulkSelection.allVisibleSelected) bulkSelection.clear()
                else bulkSelection.selectAllVisible()
              }}
            />
          ) : null}
          {mailListUsesCrossAccountThreadScope(listKind) ? (
            <span className="flex shrink-0 -space-x-0.5" title={t('mail.list.accountColorsTitle')}>
              {accounts.map((a) => (
                <span
                  key={a.id}
                  className="inline-block h-2 w-2 shrink-0 rounded-full ring-1 ring-card"
                  style={{ backgroundColor: resolvedAccountColorCss(a.color) }}
                  title={a.email}
                />
              ))}
            </span>
          ) : account ? (
            <span
              className="inline-block h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: resolvedAccountColorCss(account.color) }}
              title={account.email}
            />
          ) : null}
          <span className="shrink-0 font-semibold text-foreground">{folderTitle}</span>
          {listKind === 'unified_inbox' && unifiedInboxUnread > 0 && (
            <span className="shrink-0 rounded-full bg-primary/15 px-1.5 text-[10px] font-semibold tabular-nums text-primary">
              {unifiedInboxUnread > 999 ? '999+' : unifiedInboxUnread}
            </span>
          )}
          {sync && sync.state.startsWith('syncing') && (
            <Loader2 className="h-3 w-3 shrink-0 animate-spin text-muted-foreground" />
          )}
          {listKind === 'folder' && folder?.wellKnown === 'deleteditems' && selectFolderId != null ? (
            <button
              type="button"
              disabled={loading || emptyingTrash || filteredThreads.length === 0}
              className={cn(
                'ml-1 shrink-0 rounded border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive',
                'hover:bg-destructive/20 disabled:pointer-events-none disabled:opacity-40'
              )}
              onClick={(): void => {
                void (async (): Promise<void> => {
                  const ok = await showAppConfirm(
                    t('mail.list.emptyTrashConfirm'),
                    {
                      title: t('mail.list.emptyTrashTitle'),
                      variant: 'danger',
                      confirmLabel: t('mail.list.emptyTrashConfirmLabel')
                    }
                  )
                  if (!ok) return
                  setEmptyingTrash(true)
                  void emptyTrashFolder(selectFolderId)
                    .then((r) => {
                      useUndoStore.getState().pushToast({
                        label:
                          r.deletedRemote === 0
                            ? t('mail.list.emptyTrashAlreadyEmpty')
                            : r.deletedRemote === 1
                              ? t('mail.list.emptyTrashDoneOne')
                              : t('mail.list.emptyTrashDoneMany', { count: r.deletedRemote }),
                        variant: 'success'
                      })
                    })
                    .catch((err: unknown) => {
                      const msg =
                        err instanceof Error ? err.message : String(err)
                      useUndoStore.getState().pushToast({
                        label: msg || t('mail.list.emptyTrashFailed'),
                        variant: 'error'
                      })
                    })
                    .finally(() => setEmptyingTrash(false))
                })()
              }}
            >
              {emptyingTrash ? (
                <span className="inline-flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {t('mail.list.emptyTrashBusy')}
                </span>
              ) : (
                t('mail.list.emptyTrashButton')
              )}
            </button>
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <MailListViewMenu
            arrange={mailListArrangeBy}
            chrono={mailListChronoOrder}
            filter={filter}
            filterCounts={filterCounts}
            onArrangeChange={setMailListArrangeBy}
            onChronoChange={setMailListChronoOrder}
            onFilterChange={setFilter}
            disabled={loading}
          />
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={(): void => setColumnsDialogOpen(true)}
            className="rounded-md border border-border/60 p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
            title={t('mail.listTableColumns.configureTitle')}
            aria-label={t('mail.listTableColumns.configureTitle')}
          >
            <Columns3 className="h-3.5 w-3.5" />
          </button>
          <span className="text-[10px] text-muted-foreground">
            {filteredThreads.length}{' '}
            {filteredThreads.length === 1
              ? t('mail.list.conversation_one')
              : t('mail.list.conversation_other')}
          </span>
        </div>
      </div>

      {bulkSelection.selectedCount > 0 ? (
        <MailListBulkActionBar
          selectedCount={bulkSelection.selectedCount}
          selectedMessages={bulkSelectedMessages}
          listKind={listKind}
          onClear={bulkSelection.clear}
          onArchive={runBulkArchive}
          onDelete={runBulkDelete}
          onMarkRead={runBulkMarkRead}
          onMarkUnread={runBulkMarkUnread}
          onToggleFlag={runBulkToggleFlag}
          onMove={runBulkMove}
          onTodo={runBulkTodo}
          onSnooze={runBulkSnooze}
        />
      ) : null}

      {tableMode && flatRows.length > 0 && !loading && (
        <MailListTableHeader columns={tableColumns} gridTemplate={tableGridTemplate} />
      )}

      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="flex h-32 items-center justify-center text-xs text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t('mail.list.loadingMails')}
          </div>
        ) : flatRows.length === 0 ? (
          <EmptyHint
            sync={sync}
            hasFolder={Boolean(folder) || mailListUsesCrossAccountThreadScope(listKind)}
            filter={filter}
            totalThreads={threads.length}
            listKind={listKind}
          />
        ) : (
          <GroupedVirtuoso
            style={{ height: '100%' }}
            groupCounts={visibleGroupCounts}
            computeItemKey={(index): string => visibleFlatRows[index]?.key ?? `idx:${index}`}
            groupContent={(groupIndex): JSX.Element => {
              const todoKind =
                mailListArrangeBy === 'todo_bucket' ? groupTodoDueKinds[groupIndex] : null
              const label = groupLabels[groupIndex] ?? ''
              const collapseKey = mailListGroupCollapseKey(mailListArrangeBy, groupIndex, label)
              const collapsed = collapsedMailListGroupKeys.has(collapseKey)
              return (
                <button
                  type="button"
                  aria-expanded={!collapsed}
                  className="flex w-full items-center gap-1.5 bg-card/95 px-2 py-1.5 text-left backdrop-blur hover:bg-muted/20"
                  onClick={(e): void => {
                    e.preventDefault()
                    e.stopPropagation()
                    toggleMailListGroupCollapsed(collapseKey)
                  }}
                >
                  {collapsed ? (
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  )}
                  {todoKind != null ? (
                    <TodoDueBucketBadge kind={todoKind} />
                  ) : (
                    <span className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {label}
                    </span>
                  )}
                </button>
              )
            }}
            itemContent={(index): JSX.Element => {
              const row = visibleFlatRows[index]
              if (!row) return <div />
              const rowMessageId = messageIdFromMailListRow(row)
              const bulkChecked = bulkSelection.isSelected(rowMessageId)
              if (row.kind === 'thread-head') {
                const t = row.thread
                const isExpanded = expandedThreads.has(t.threadKey)
                const threadSelected = row.threadMessages.some(
                  (m) => m.id === selectedMessageId
                )
                return (
                  <ThreadHeadRow
                    thread={t}
                    threadMessages={row.threadMessages}
                    account={accountById.get(t.accountId) ?? null}
                    accounts={accounts}
                    profilePhotoDataUrls={profilePhotoDataUrls}
                    showInboxAccountStripe={mailListUsesCrossAccountThreadScope(listKind)}
                    expanded={isExpanded}
                    threadSelected={threadSelected}
                    headSelected={t.latestMessage.id === selectedMessageId}
                    bulkChecked={bulkChecked}
                    bulkSelectionMode={bulkSelectionMode}
                    onBulkToggle={(): void => bulkSelection.toggle(rowMessageId)}
                    onBulkPointerDown={(modifiers): void =>
                      bulkSelection.handleRowPointerDown(rowMessageId, modifiers)
                    }
                    onToggleExpand={(): void => toggleThreadExpanded(t.threadKey)}
                    onSelectMessage={(id): void => {
                      void selectMessage(id)
                    }}
                    onOpenPopout={(id, e): void => {
                      openMailReadingPopout(id, { osWindow: e.shiftKey })
                    }}
                    onContextMail={openMailContext}
                    rowActions={rowActions}
                    visibleHoverActions={visibleHoverActions}
                    quickSteps={quickSteps}
                    suggestionHint={suggestionHints.get(
                      entityRefKey({ kind: 'mail', messageId: t.latestMessage.id })
                    )}
                    isRowExiting={row.threadMessages.some((m) => isExiting(m.id))}
                    tableMode={tableMode}
                    tableColumns={tableColumns}
                    tableGridTemplate={tableGridTemplate}
                    showPreviewInSubject={showPreviewInSubject}
                  />
                )
              }
              // thread-sub
                return (
                  <ThreadSubRow
                    message={row.message}
                    accounts={accounts}
                    foldersByAccount={foldersByAccount}
                    showInboxAccountStripe={mailListUsesCrossAccountThreadScope(listKind)}
                    selected={row.message.id === selectedMessageId}
                    bulkChecked={bulkChecked}
                    bulkSelectionMode={bulkSelectionMode}
                    onBulkToggle={(): void => bulkSelection.toggle(rowMessageId)}
                    onBulkPointerDown={(modifiers): void =>
                      bulkSelection.handleRowPointerDown(rowMessageId, modifiers)
                    }
                    onSelectMessage={(id): void => {
                      void selectMessage(id)
                    }}
                    onOpenPopout={(id, e): void => {
                      openMailReadingPopout(id, { osWindow: e.shiftKey })
                    }}
                    onContextMail={openMailContext}
                    rowActions={rowActions}
                    visibleHoverActions={visibleHoverActions}
                    quickSteps={quickSteps}
                    isRowExiting={isExiting(row.message.id)}
                    tableMode={tableMode}
                    tableColumns={tableColumns}
                    tableGridTemplate={tableGridTemplate}
                    showPreviewInSubject={showPreviewInSubject}
                  />
                )
            }}
          />
        )}
      </div>

      <MailListTableColumnsDialog
        open={columnsDialogOpen}
        columns={tableColumns}
        onClose={(): void => setColumnsDialogOpen(false)}
        onApply={setTableColumns}
      />

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenu.items}
          onClose={(): void => setContextMenu(null)}
        />
      )}
      <ObjectNoteDialog target={noteTarget} onClose={(): void => setNoteTarget(null)} />
      <MailDestinationFolderDialog
        open={moveFolderPicker != null}
        folders={moveFolderPicker ? foldersByAccount[moveFolderPicker.accountId] ?? [] : []}
        onClose={(): void => setMoveFolderPicker(null)}
        onPick={async (folderId): Promise<void> => {
          const pick = moveFolderPicker
          if (!pick) return
          await moveMessagesToFolder(pick.messageIds, folderId)
          bulkSelection.clear()
        }}
      />
    </section>
  )
}

function findFolderForMessage(
  message: MailListItem,
  foldersByAccount: Record<string, MailFolder[]>
): MailFolder | null {
  const fid = message.folderId
  if (fid == null) return null
  return foldersByAccount[message.accountId]?.find((f) => f.id === fid) ?? null
}

function wellKnownFolderTitle(wellKnown: string | null, fallbackName: string, tr: (k: string) => string): string {
  const w = (wellKnown ?? '').toLowerCase()
  if (w === 'inbox') return tr('topbar.folderInbox')
  if (w === 'sentitems') return tr('topbar.folderSent')
  if (w === 'drafts') return tr('topbar.folderDrafts')
  if (w === 'deleteditems') return tr('topbar.folderDeleted')
  if (w === 'junkemail') return tr('mail.list.folderJunk')
  if (w === 'archive') return tr('topbar.folderArchive')
  return fallbackName
}

const ThreadHeadRow = memo(function ThreadHeadRow({
  thread,
  threadMessages,
  account,
  accounts,
  profilePhotoDataUrls,
  showInboxAccountStripe,
  expanded,
  threadSelected,
  headSelected,
  bulkChecked,
  bulkSelectionMode,
  onBulkToggle,
  onBulkPointerDown,
  onToggleExpand,
  onSelectMessage,
  onOpenPopout,
  onContextMail,
  rowActions,
  visibleHoverActions,
  quickSteps,
  isRowExiting = false,
  tableMode = false,
  tableColumns = [],
  tableGridTemplate = '',
  showPreviewInSubject = true,
  suggestionHint
}: {
  thread: ThreadGroup
  threadMessages: MailListItem[]
  account: ConnectedAccount | null
  accounts: ConnectedAccount[]
  profilePhotoDataUrls: Record<string, string>
  showInboxAccountStripe: boolean
  expanded: boolean
  threadSelected: boolean
  headSelected: boolean
  bulkChecked: boolean
  bulkSelectionMode: boolean
  onBulkToggle: () => void
  onBulkPointerDown: (modifiers: {
    shiftKey: boolean
    ctrlKey: boolean
    metaKey: boolean
  }) => void
  onToggleExpand: () => void
  onSelectMessage: (id: number) => void
  onOpenPopout: (id: number, e: React.MouseEvent) => void
  onContextMail: (e: React.MouseEvent, msg: MailListItem, opts?: MailListContextOpts) => void
  rowActions: MailRowHandlers
  visibleHoverActions: MailListHoverActionId[]
  quickSteps: MailQuickStep[]
  isRowExiting?: boolean
  tableMode?: boolean
  tableColumns?: MailListTableColumnId[]
  tableGridTemplate?: string
  showPreviewInSubject?: boolean
  suggestionHint?: EntityLinkSuggestionCountEntry
}): JSX.Element {
  const { t } = useTranslation()
  const displayMessages = useMemo((): MailListItem[] => {
    const deduped = dedupeMailListThreadMessagesById(threadMessages)
    return deduped.length > 0 ? deduped : [thread.rootMessage]
  }, [threadMessages, thread.rootMessage])
  const root = useMemo(() => pickThreadRootMessage(displayMessages), [displayMessages])
  const latest = useMemo(() => pickThreadLatestMessage(displayMessages), [displayMessages])
  const accountSenderPhoto = profilePhotoSrcForEmail(accounts, profilePhotoDataUrls, root.fromAddr)
  const contactSenderPhoto = useSenderContactPhoto(root.fromAddr, root.accountId)
  const senderPhoto = combineSenderAvatarImageSrc(accountSenderPhoto, contactSenderPhoto)
  const hasMultiple = thread.messageCount > 1
  const outlookExpandHeader = !tableMode && hasMultiple && expanded
  const dateIso = messageListDateIso(latest)
  const date = dateIso ? formatDate(dateIso) : ''
  const isUnread = thread.unreadCount > 0
  const senderLabel =
    hasMultiple && thread.participantNames.length > 1
      ? formatParticipants(thread.participantNames)
      : root.fromName || root.fromAddr || t('common.unknown')

  const threadBulkMsgs = useMemo((): MailListItem[] | undefined => {
    if (!hasMultiple) return undefined
    const deduped = dedupeMailListThreadMessagesById(threadMessages)
    return deduped.length > 1 ? deduped : undefined
  }, [hasMultiple, threadMessages])

  const threadContextOpts = useMemo((): MailListContextOpts | undefined => {
    if (!threadBulkMsgs) return undefined
    return {
      applyToMessageIds: threadBulkMsgs.map((m) => m.id),
      threadMessagesForContext: threadBulkMsgs
    }
  }, [threadBulkMsgs])

  const conversationDragIds = useMemo((): number[] => {
    const deduped = dedupeMailListThreadMessagesById(threadMessages)
    return deduped.map((m) => m.id)
  }, [threadMessages])

  const tableCellCtx = useMemo(
    (): MailTableCellCtx => ({
      message: latest,
      root,
      senderLabel,
      isUnread,
      showPreviewInSubject,
      account
    }),
    [latest, root, senderLabel, isUnread, showPreviewInSubject, account]
  )

  function handleHeaderClick(e: React.MouseEvent): void {
    onBulkPointerDown({
      shiftKey: e.shiftKey,
      ctrlKey: e.ctrlKey,
      metaKey: e.metaKey
    })
    const hasModifier = e.shiftKey || e.ctrlKey || e.metaKey
    if (hasModifier) {
      onSelectMessage(latest.id)
      return
    }
    if (hasMultiple) {
      onToggleExpand()
      if (!expanded && !threadSelected) {
        onSelectMessage(latest.id)
      }
    } else {
      onSelectMessage(latest.id)
    }
  }

  return (
    <div
      draggable
      onDragStart={(e): void => {
        const payload = JSON.stringify(conversationDragIds)
        e.dataTransfer.setData(MIME_THREAD_IDS, payload)
        e.dataTransfer.setData('text/plain', conversationDragIds.join(','))
        e.dataTransfer.setData('text/mailclient-message-id', String(latest.id))
        e.dataTransfer.setData('application/x-mailclient-message-id', String(latest.id))
        e.dataTransfer.effectAllowed = 'move'
      }}
      onContextMenu={(e): void => {
        void onContextMail(e, latest, threadContextOpts)
      }}
      className={cn(
        'chronell-list-row group/row relative flex w-full items-start gap-2.5 px-3',
        outlookExpandHeader ? 'py-1.5' : 'py-2.5',
        latest.isVipSender && 'ring-1 ring-amber-500/35 ring-inset',
        (headSelected || (threadSelected && !headSelected)) && 'chronell-list-row--selected',
        bulkChecked && 'bg-primary/10 ring-1 ring-primary/25 ring-inset',
        'cursor-grab active:cursor-grabbing',
        isRowExiting && motionListItemExit
      )}
      title={
        showInboxAccountStripe && account
          ? t('mail.list.inboxStripeTitle', { name: account.displayName, email: account.email })
          : undefined
      }
    >
      {showInboxAccountStripe && account && (
        <AccountColorStripe color={account.color} className={MAIL_LIST_UNIFIED_INBOX_STRIPE_BAR} />
      )}
      <MailListSelectableCheckbox
        checked={bulkChecked}
        bulkSelectionMode={bulkSelectionMode}
        hoverGroup="row"
        ariaLabel={t('mail.list.selectRow')}
        onChange={onBulkToggle}
        className={outlookExpandHeader ? 'mt-0.5' : 'mt-2'}
      />
      <button
        type="button"
        onClick={(e): void => {
          e.stopPropagation()
          if (hasMultiple) onToggleExpand()
        }}
        className={cn(
          'flex h-4 w-3.5 shrink-0 items-center justify-center text-muted-foreground/70',
          outlookExpandHeader ? 'mt-0.5' : 'mt-2',
          !hasMultiple && 'pointer-events-none opacity-0'
        )}
        aria-label={expanded ? t('mail.list.expandThreadCollapse') : t('mail.list.expandThreadExpand')}
      >
        {hasMultiple &&
          (expanded ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          ))}
      </button>

      {!tableMode && !outlookExpandHeader && (
        <Avatar
          name={root.fromName}
          email={root.fromAddr}
          accountColor={account?.color}
          imageSrc={senderPhoto}
          useGravatar={Boolean(root.fromAddr?.trim())}
          size="md"
          className="mt-0.5"
        />
      )}

      {tableMode ? (
        <button
          type="button"
          onClick={(e): void => handleHeaderClick(e)}
          onDoubleClick={(e): void => {
            e.stopPropagation()
            onOpenPopout(latest.id, e)
          }}
          className="grid min-w-0 flex-1 items-center gap-x-1 py-1.5 text-left"
          style={{ gridTemplateColumns: tableGridTemplate }}
        >
          {tableColumns.map((col) => (
            <MailListTableCell
              key={col}
              columnId={col}
              ctx={tableCellCtx}
              compactCategories
            />
          ))}
        </button>
      ) : (
      <button
        type="button"
        onClick={(e): void => handleHeaderClick(e)}
        onDoubleClick={(e): void => {
          e.stopPropagation()
          onOpenPopout(latest.id, e)
        }}
        className={cn(
          'flex min-w-0 flex-1 text-left',
          outlookExpandHeader ? 'flex-row items-center gap-2 py-0.5' : 'flex-col gap-0.5'
        )}
      >
        {outlookExpandHeader ? (
          <>
            <StatusDot
              variant={isUnread ? 'unread' : 'read'}
              size="sm"
              className="shrink-0"
              title={isUnread ? t('mail.list.unread') : t('mail.list.read')}
            />
            <span
              className={cn(
                'min-w-0 flex-1 truncate text-xs',
                isUnread ? 'font-semibold text-foreground' : 'font-semibold text-foreground/95'
              )}
            >
              {root.subject || t('common.noSubject')}
            </span>
            {suggestionHint ? (
              <EntityLinkSuggestionBadge
                count={suggestionHint.count}
                source={suggestionHint.source}
              />
            ) : null}
            {hasMultiple && (
              <span
                className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-muted px-1.5 py-px text-2xs font-medium text-muted-foreground"
                title={t('mail.list.messagesInThread', { count: thread.messageCount })}
              >
                <MessagesSquare className="h-2.5 w-2.5" />
                {thread.messageCount}
              </span>
            )}
            {thread.isFlagged && (
              <Star className="h-3 w-3 shrink-0 fill-status-flagged text-status-flagged group-hover/row:opacity-0" />
            )}
            {thread.hasAttachments && (
              <Paperclip className="h-3 w-3 shrink-0 text-muted-foreground group-hover/row:opacity-0" />
            )}
            {thread.openTodoDueKind != null && (
              <TodoDueBucketBadge kind={thread.openTodoDueKind} className="shrink-0" />
            )}
            {latest.snoozedUntil ? (
              <span
                className="inline-flex shrink-0 items-center gap-1 rounded-md bg-status-unread/15 px-1.5 py-0.5 text-2xs font-medium text-status-unread transition-opacity group-hover/row:opacity-0"
                title={t('mail.list.snoozeUntilTitle', { when: formatSnoozeWake(latest.snoozedUntil) })}
              >
                <Clock className="h-2.5 w-2.5" />
                <span className="tabular-nums">{formatSnoozeWake(latest.snoozedUntil)}</span>
              </span>
            ) : (
              <span className="shrink-0 text-2xs text-muted-foreground tabular-nums transition-opacity group-hover/row:opacity-0">
                {date}
              </span>
            )}
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <StatusDot
                variant={isUnread ? 'unread' : 'read'}
                size="sm"
                className="shrink-0"
                title={isUnread ? t('mail.list.unread') : t('mail.list.read')}
              />
              <span
                className={cn(
                  'flex-1 truncate text-xs',
                  isUnread ? 'font-semibold text-foreground' : 'text-muted-foreground'
                )}
              >
                {senderLabel}
              </span>
              {hasMultiple && (
                <span
                  className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-muted px-1.5 py-px text-2xs font-medium text-muted-foreground"
                  title={t('mail.list.messagesInThread', { count: thread.messageCount })}
                >
                  <MessagesSquare className="h-2.5 w-2.5" />
                  {thread.messageCount}
                </span>
              )}
              {thread.isFlagged && (
                <Star className="h-3 w-3 shrink-0 fill-status-flagged text-status-flagged group-hover/row:opacity-0" />
              )}
              {thread.hasAttachments && (
                <Paperclip className="h-3 w-3 shrink-0 text-muted-foreground group-hover/row:opacity-0" />
              )}
              {thread.openTodoDueKind != null && (
                <TodoDueBucketBadge kind={thread.openTodoDueKind} className="shrink-0" />
              )}
              {latest.snoozedUntil ? (
                <span
                  className="inline-flex shrink-0 items-center gap-1 rounded-md bg-status-unread/15 px-1.5 py-0.5 text-2xs font-medium text-status-unread transition-opacity group-hover/row:opacity-0"
                  title={t('mail.list.snoozeUntilTitle', { when: formatSnoozeWake(latest.snoozedUntil) })}
                >
                  <Clock className="h-2.5 w-2.5" />
                  <span className="tabular-nums">{formatSnoozeWake(latest.snoozedUntil)}</span>
                </span>
              ) : (
                <span className="shrink-0 text-2xs text-muted-foreground tabular-nums transition-opacity group-hover/row:opacity-0">
                  {date}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  'min-w-0 flex-1 truncate text-xs',
                  isUnread ? 'font-semibold text-foreground' : 'text-foreground/85'
                )}
              >
                {root.subject || t('common.noSubject')}
              </span>
              {suggestionHint ? (
                <EntityLinkSuggestionBadge
                  count={suggestionHint.count}
                  source={suggestionHint.source}
                />
              ) : null}
            </div>
            <MailCategoryBadges categories={latest.categories} />
            {latest.snippet && (
              <div className="line-clamp-1 text-2xs text-muted-foreground/85">
                {latest.snippet}
              </div>
            )}
          </>
        )}
      </button>
      )}

      {tableMode && (
        <MailListTableRowIcons flagged={thread.isFlagged} hasAttachments={thread.hasAttachments} />
      )}

      <MailRowActions
        message={latest}
        bulkThreadMessages={threadBulkMsgs}
        handlers={rowActions}
        visibleHoverActions={visibleHoverActions}
        quickSteps={quickSteps}
        alwaysVisible={false}
        position="top"
      />
    </div>
  )
})

const ThreadSubRow = memo(function ThreadSubRow({
  message,
  accounts,
  foldersByAccount,
  showInboxAccountStripe,
  selected,
  bulkChecked,
  bulkSelectionMode,
  onBulkToggle,
  onBulkPointerDown,
  onSelectMessage,
  onOpenPopout,
  onContextMail,
  rowActions,
  visibleHoverActions,
  quickSteps,
  isRowExiting = false,
  tableMode = false,
  tableColumns = [],
  tableGridTemplate = '',
  showPreviewInSubject = true
}: {
  message: MailListItem
  accounts: ConnectedAccount[]
  foldersByAccount: Record<string, MailFolder[]>
  showInboxAccountStripe: boolean
  selected: boolean
  bulkChecked: boolean
  bulkSelectionMode: boolean
  onBulkToggle: () => void
  onBulkPointerDown: (modifiers: {
    shiftKey: boolean
    ctrlKey: boolean
    metaKey: boolean
  }) => void
  onSelectMessage: (id: number) => void
  onOpenPopout: (id: number, e: React.MouseEvent) => void
  onContextMail: (e: React.MouseEvent, msg: MailListItem, opts?: MailListContextOpts) => void
  rowActions: MailRowHandlers
  visibleHoverActions: MailListHoverActionId[]
  quickSteps: MailQuickStep[]
  isRowExiting?: boolean
  tableMode?: boolean
  tableColumns?: MailListTableColumnId[]
  tableGridTemplate?: string
  showPreviewInSubject?: boolean
}): JSX.Element {
  const { t } = useTranslation()
  const folder = findFolderForMessage(message, foldersByAccount)
  const wk = (folder?.wellKnown ?? '').toLowerCase()
  const sentLike = wk === 'sentitems' || wk === 'drafts'
  const folderLabel = folder ? wellKnownFolderTitle(folder.wellKnown, folder.name, t) : ''
  const dateIso = messageListDateIso(message)
  const dateStr = dateIso ? formatDate(dateIso) : ''
  const primaryLabel = message.fromName || message.fromAddr || t('common.unknown')
  const toLine = threadSubFirstToDisplay(message.toAddrs)
  const subTodoKind =
    message.todoId != null ? parseOpenTodoDueKind(message.todoDueKind) : null
  const stripeAccount = showInboxAccountStripe
    ? accounts.find((a) => a.id === message.accountId)
    : undefined

  const subTableCtx = useMemo(
    (): MailTableCellCtx => ({
      message,
      root: message,
      senderLabel: primaryLabel,
      isUnread: !message.isRead,
      showPreviewInSubject,
      account: stripeAccount ?? null
    }),
    [message, primaryLabel, showPreviewInSubject, stripeAccount]
  )

  function handleSubRowClick(e: React.MouseEvent): void {
    onBulkPointerDown({
      shiftKey: e.shiftKey,
      ctrlKey: e.ctrlKey,
      metaKey: e.metaKey
    })
    onSelectMessage(message.id)
  }

  return (
    <div
      draggable
      onDragStart={(e): void => {
        const id = String(message.id)
        e.dataTransfer.setData(MIME_THREAD_IDS, JSON.stringify([message.id]))
        e.dataTransfer.setData('text/plain', id)
        e.dataTransfer.setData('text/mailclient-message-id', id)
        e.dataTransfer.setData('application/x-mailclient-message-id', id)
        e.dataTransfer.effectAllowed = 'move'
      }}
      className={cn(
        'group/subrow relative ml-7 flex cursor-grab items-start gap-1 active:cursor-grabbing',
        message.isVipSender && 'ring-1 ring-amber-500/25 ring-inset',
        bulkChecked && 'bg-primary/10',
        isRowExiting && motionListItemExit
      )}
      title={
        stripeAccount
          ? t('mail.list.inboxStripeTitle', {
              name: stripeAccount.displayName,
              email: stripeAccount.email
            })
          : undefined
      }
    >
      {stripeAccount && (
        <AccountColorStripe color={stripeAccount.color} className={MAIL_LIST_UNIFIED_INBOX_STRIPE_BAR} />
      )}
      <MailListSelectableCheckbox
        checked={bulkChecked}
        bulkSelectionMode={bulkSelectionMode}
        hoverGroup="subrow"
        ariaLabel={t('mail.list.selectRow')}
        onChange={onBulkToggle}
        className="mt-2 ml-1"
      />
      <button
        type="button"
        onClick={handleSubRowClick}
        onDoubleClick={(e): void => {
          e.stopPropagation()
          onOpenPopout(message.id, e)
        }}
        onContextMenu={(e): void => onContextMail(e, message)}
        className={cn(
          'min-w-0 flex-1',
          tableMode
            ? 'grid w-full items-center gap-x-1 py-1 pl-2 pr-2 text-left transition-colors'
            : 'flex w-full flex-col gap-0.5 py-1.5 pl-2 pr-2 text-left transition-colors',
          selected
            ? 'chronell-list-row chronell-list-row--selected'
            : 'chronell-list-row'
        )}
        style={tableMode ? { gridTemplateColumns: tableGridTemplate } : undefined}
      >
        {tableMode ? (
          tableColumns.map((col) => (
            <MailListTableCell
              key={col}
              columnId={col}
              ctx={subTableCtx}
              compactCategories
            />
          ))
        ) : sentLike ? (
          <>
            <div className="flex w-full items-center justify-between gap-2 text-2xs italic text-muted-foreground">
              <span className="min-w-0 truncate">{primaryLabel}</span>
              <span className="shrink-0 text-right tabular-nums">{folderLabel}</span>
            </div>
            <div className="flex w-full items-start justify-between gap-2 text-xs">
              <div className="flex min-w-0 flex-1 items-center gap-1.5">
                <StatusDot
                  variant={!message.isRead ? 'unread' : 'read'}
                  size="xs"
                  className="shrink-0"
                />
                <span
                  className={cn(
                    'min-w-0 flex-1 truncate',
                    message.isRead ? 'text-foreground/90' : 'font-semibold text-foreground'
                  )}
                >
                  {toLine || t('mail.list.noRecipient')}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {message.hasAttachments && (
                  <Paperclip className="h-3 w-3 text-muted-foreground group-hover/subrow:opacity-0" />
                )}
                {subTodoKind != null && (
                  <TodoDueBucketBadge kind={subTodoKind} compact className="shrink-0" />
                )}
                <MailCategoryDots categories={message.categories} />
                <span className="text-2xs text-muted-foreground tabular-nums transition-opacity group-hover/subrow:opacity-0">
                  {dateStr}
                </span>
              </div>
            </div>
          </>
        ) : (
          <div className="flex w-full items-center justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-1.5">
              <StatusDot
                variant={!message.isRead ? 'unread' : 'read'}
                size="xs"
                className="shrink-0"
              />
              <span
                className={cn(
                  'min-w-0 flex-1 truncate text-xs',
                  message.isRead ? 'text-foreground/90' : 'font-semibold text-foreground'
                )}
              >
                {primaryLabel}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {message.hasAttachments && (
                <Paperclip className="h-3 w-3 text-muted-foreground group-hover/subrow:opacity-0" />
              )}
              {subTodoKind != null && (
                <TodoDueBucketBadge kind={subTodoKind} compact className="shrink-0" />
              )}
              <MailCategoryDots categories={message.categories} />
              <span className="text-2xs text-muted-foreground tabular-nums transition-opacity group-hover/subrow:opacity-0">
                {dateStr}
              </span>
            </div>
          </div>
        )}
      </button>
      <MailRowActions
        message={message}
        handlers={rowActions}
        visibleHoverActions={visibleHoverActions}
        quickSteps={quickSteps}
        alwaysVisible={false}
        position="center"
        groupName="subrow"
      />
    </div>
  )
})

function MailCategoryBadges({ categories }: { categories?: string[] }): JSX.Element | null {
  const cats = (categories ?? []).map((c) => c.trim()).filter((c) => c.length > 0)
  if (cats.length === 0) return null
  const max = 4
  const shown = cats.slice(0, max)
  const extra = cats.length - shown.length
  return (
    <div className="flex flex-wrap items-center gap-1">
      {shown.map((c, i) => (
        <span
          key={`${c}:${i}`}
          title={c}
          className="inline-flex max-w-[6rem] items-center gap-0.5 rounded border border-border/50 bg-secondary/30 px-1 py-px text-[9px] font-medium text-foreground/90"
        >
          <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', outlookCategoryDotClass(null))} />
          <span className="truncate">{c}</span>
        </span>
      ))}
      {extra > 0 && (
        <span className="text-[9px] text-muted-foreground" title={cats.slice(max).join(', ')}>
          +{extra}
        </span>
      )}
    </div>
  )
}

function MailCategoryDots({ categories }: { categories?: string[] }): JSX.Element | null {
  const { t } = useTranslation()
  const cats = (categories ?? []).map((c) => c.trim()).filter((c) => c.length > 0)
  if (cats.length === 0) return null
  const max = 6
  const shown = cats.slice(0, max)
  return (
    <span
      className="inline-flex shrink-0 items-center gap-px"
      title={cats.join(', ')}
      aria-label={t('mail.list.categoriesDotsAria', { list: cats.join(', ') })}
    >
      {shown.map((c, i) => (
        <span
          key={`${c}:${i}`}
          className={cn('h-1.5 w-1.5 rounded-full', outlookCategoryDotClass(null))}
        />
      ))}
      {cats.length > max && <span className="text-[8px] leading-none text-muted-foreground">+</span>}
    </span>
  )
}

function MailRowActions({
  message,
  bulkThreadMessages,
  handlers,
  visibleHoverActions,
  quickSteps,
  alwaysVisible,
  position,
  groupName = 'row'
}: {
  message: MailListItem
  bulkThreadMessages?: MailListItem[]
  handlers: MailRowHandlers
  visibleHoverActions: MailListHoverActionId[]
  quickSteps: MailQuickStep[]
  alwaysVisible: boolean
  position: 'top' | 'center'
  groupName?: 'row' | 'subrow'
}): JSX.Element | null {
  const { t } = useTranslation()
  const bulk =
    bulkThreadMessages && bulkThreadMessages.length > 1 ? bulkThreadMessages : undefined
  const n = bulk?.length ?? 0
  const allFlagged = Boolean(bulk && bulk.every((m) => m.isFlagged))
  const starHighlight = bulk ? allFlagged : message.isFlagged
  const starTitle = bulk
    ? allFlagged
      ? t('mail.list.starRemoveBulk', { count: n })
      : t('mail.list.starAddBulk', { count: n })
    : message.isFlagged
      ? t('mail.list.starRemove')
      : t('mail.list.starAdd')
  const archiveTitle = bulk ? t('mail.list.archiveTitleBulk', { count: n }) : t('mail.list.archiveTitle')
  const deleteTitle = bulk ? t('mail.list.deleteTitleBulk', { count: n }) : t('mail.list.deleteTitle')

  const showClass =
    groupName === 'subrow'
      ? 'opacity-0 group-hover/subrow:opacity-100 focus-within:opacity-100'
      : 'opacity-0 group-hover/row:opacity-100 focus-within:opacity-100'

  const baseTop = position === 'top' ? 'top-2' : 'top-1/2 -translate-y-1/2'

  if (visibleHoverActions.length === 0) return null

  return (
    <div
      className={cn(
        'chronell-acrylic-popover absolute right-1 flex items-center gap-0.5 px-1 py-0.5 transition-opacity',
        baseTop,
        alwaysVisible ? 'opacity-100' : showClass
      )}
    >
      {visibleHoverActions.map((actionId) => {
        if (actionId.startsWith('quickstep:')) {
          const qid = Number.parseInt(actionId.slice('quickstep:'.length), 10)
          const qs = quickSteps.find((q) => q.id === qid)
          if (!qs) return null
          return (
            <RowActionButton
              key={actionId}
              title={qs.name}
              icon={resolveQuickStepHoverIcon(qs)}
              onClick={(e): void => handlers.onQuickStep(e, message, qid, bulk)}
            />
          )
        }
        const builtin = actionId as MailListHoverBuiltinActionId
        switch (builtin) {
          case 'reply':
            return (
              <RowActionButton
                key={actionId}
                title={t('mail.list.rowReplyTitle')}
                icon={Reply}
                onClick={(e): void => handlers.onReply(e, message)}
              />
            )
          case 'flag':
            return (
              <RowActionButton
                key={actionId}
                title={starTitle}
                icon={Star}
                highlight={starHighlight}
                onClick={(e): void => handlers.onToggleFlag(e, message, bulk)}
              />
            )
          case 'archive':
            return (
              <RowActionButton
                key={actionId}
                title={archiveTitle}
                icon={Archive}
                onClick={(e): void => handlers.onArchive(e, message, bulk)}
              />
            )
          case 'delete':
            return (
              <RowActionButton
                key={actionId}
                title={deleteTitle}
                icon={Trash2}
                destructive
                onClick={(e): void => handlers.onDelete(e, message, bulk)}
              />
            )
          case 'popout':
            return (
              <RowActionButton
                key={actionId}
                title={t('mail.list.rowPopoutTitle')}
                icon={PictureInPicture2}
                onClick={(e): void => handlers.onPopout(e, message)}
              />
            )
          case 'forward':
            return (
              <RowActionButton
                key={actionId}
                title={t('mail.list.rowForwardTitle')}
                icon={Forward}
                onClick={(e): void => handlers.onForward(e, message)}
              />
            )
          case 'snooze':
            return (
              <RowActionButton
                key={actionId}
                title={t('mail.list.rowSnoozeTitle')}
                icon={Clock}
                onClick={(e): void => handlers.onSnooze(e, message)}
              />
            )
          case 'markRead':
            return (
              <RowActionButton
                key={actionId}
                title={bulk ? t('mail.list.markReadBulk', { count: n }) : t('mail.list.markRead')}
                icon={MailOpen}
                onClick={(e): void => handlers.onMarkRead(e, message, bulk)}
              />
            )
          case 'markUnread':
            return (
              <RowActionButton
                key={actionId}
                title={bulk ? t('mail.list.markUnreadBulk', { count: n }) : t('mail.list.markUnread')}
                icon={Mail}
                onClick={(e): void => handlers.onMarkUnread(e, message, bulk)}
              />
            )
          case 'todo':
            return (
              <RowActionButton
                key={actionId}
                title={t('mail.list.rowTodoTitle')}
                icon={CheckSquare}
                onClick={(e): void => handlers.onTodo(e, message)}
              />
            )
          default:
            return null
        }
      })}
    </div>
  )
}

function RowActionButton({
  title,
  icon: Icon,
  highlight,
  destructive,
  onClick
}: {
  title: string
  icon: React.ComponentType<{ className?: string }>
  highlight?: boolean
  destructive?: boolean
  onClick: (e: React.MouseEvent) => void
}): JSX.Element {
  const [animate, setAnimate] = useState(false)

  function handleClick(e: React.MouseEvent): void {
    setAnimate(true)
    window.setTimeout(() => setAnimate(false), 240)
    onClick(e)
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      title={title}
      className={cn(
        'flex h-6 w-6 shrink-0 items-center justify-center rounded transition-colors',
        destructive
          ? 'text-muted-foreground hover:bg-destructive/20 hover:text-destructive'
          : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
        highlight && 'text-status-flagged'
      )}
    >
      <Icon
        className={cn(
          'h-3.5 w-3.5 transition-transform',
          highlight && 'fill-status-flagged text-status-flagged',
          animate && 'animate-star-pop'
        )}
      />
    </button>
  )
}

function formatParticipants(names: string[]): string {
  const short = names.map((n) => n.split(' ')[0] ?? n)
  if (short.length <= 3) return short.join(', ')
  return `${short.slice(0, 2).join(', ')}, +${short.length - 2}`
}

function EmptyHint({
  sync,
  hasFolder,
  filter,
  totalThreads,
  listKind
}: {
  sync: { state: string; message?: string } | undefined | null
  hasFolder: boolean
  filter?: MailFilter
  totalThreads?: number
  listKind?: MailListKind
}): JSX.Element {
  const { t } = useTranslation()
  if (!hasFolder) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center">
        <div className="space-y-2 text-xs text-muted-foreground">{t('mail.list.connectOrSelectFolder')}</div>
      </div>
    )
  }
  if (filter && filter !== 'all' && (totalThreads ?? 0) > 0) {
    const place = mailListUsesCrossAccountThreadScope(listKind ?? 'folder')
      ? t('mail.list.inThisView')
      : t('mail.list.noTodoInFolder')
    if (filter === 'with_todo') {
      return (
        <div className="flex h-full items-center justify-center px-6 text-center">
          <div className="text-xs text-muted-foreground">{t('mail.list.noOpenTodoWithPlace', { place })}</div>
        </div>
      )
    }
    const labelMsg =
      filter === 'unread'
        ? t('mail.list.noUnreadMailsPlace', { place })
        : t('mail.list.noFlaggedMailsPlace', { place })
    return (
      <div className="flex h-full items-center justify-center px-6 text-center">
        <div className="text-xs text-muted-foreground">{labelMsg}</div>
      </div>
    )
  }
  if (sync?.state === 'error') {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center">
        <div className="space-y-2">
          <div className="text-sm font-medium text-destructive">{t('mail.list.syncFailed')}</div>
          <div className="text-xs text-muted-foreground">{sync.message}</div>
        </div>
      </div>
    )
  }
  if (sync?.state.startsWith('syncing')) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center">
        <Loader2 className="mr-2 h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-xs text-muted-foreground">{t('mail.list.syncing')}</span>
      </div>
    )
  }
  return (
    <div className="flex h-full items-center justify-center px-6 text-center">
      <div className="text-xs text-muted-foreground">
        {listKind === 'unified_inbox'
          ? t('mail.list.emptyUnifiedInboxes')
          : listKind === 'meta_folder'
            ? t('mail.list.emptyMeta')
            : listKind === 'category'
              ? 'Keine Mails in dieser Kategorie.'
            : t('mail.list.emptyFolder')}
      </div>
    </div>
  )
}

function formatSnoozeWake(iso: string): string {
  const localeTag = i18n.language?.startsWith('de') ? 'de-DE' : 'en-GB'
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    const now = new Date()
    const sameDay =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    if (sameDay) {
      return d.toLocaleTimeString(localeTag, { hour: '2-digit', minute: '2-digit' })
    }
    const tomorrow = new Date(now)
    tomorrow.setDate(now.getDate() + 1)
    const isTomorrow =
      d.getFullYear() === tomorrow.getFullYear() &&
      d.getMonth() === tomorrow.getMonth() &&
      d.getDate() === tomorrow.getDate()
    if (isTomorrow) {
      return `${d.toLocaleDateString(localeTag, { weekday: 'short' })} ${d.toLocaleTimeString(localeTag, { hour: '2-digit', minute: '2-digit' })}`
    }
    return d.toLocaleString(localeTag, {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return iso
  }
}

function formatDate(iso: string): string {
  const localeTag = i18n.language?.startsWith('de') ? 'de-DE' : 'en-GB'
  try {
    const d = new Date(iso)
    const now = new Date()
    const sameDay =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    if (sameDay) {
      return d.toLocaleTimeString(localeTag, { hour: '2-digit', minute: '2-digit' })
    }
    const sameYear = d.getFullYear() === now.getFullYear()
    if (sameYear) {
      return d.toLocaleDateString(localeTag, { day: '2-digit', month: '2-digit' })
    }
    return d.toLocaleDateString(localeTag, { day: '2-digit', month: '2-digit', year: '2-digit' })
  } catch {
    return ''
  }
}