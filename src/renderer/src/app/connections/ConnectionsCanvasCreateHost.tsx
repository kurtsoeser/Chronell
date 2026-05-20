import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import type { ChronellEntityRef } from '@shared/entity-ref'
import type { PeopleContactView, TaskListRow } from '@shared/types'
import {
  CalendarCreateQuickPopover,
  type CalendarCreateQuickDraft
} from '@/app/calendar/CalendarCreateQuickPopover'
import { CalendarEventDialog } from '@/app/calendar/CalendarEventDialog'
import { ConnectionsNoteCreateDialog } from '@/app/connections/ConnectionsNoteCreateDialog'
import type {
  ConnectionsCanvasCreateAnchor,
  ConnectionsCanvasCreateKind
} from '@/app/connections/connections-canvas-create'
import { defaultConnectionsCanvasCalendarRange } from '@/app/connections/connections-canvas-create'
import type { CalendarCreateRange } from '@/app/tasks/tasks-calendar-create-range'
import { PeopleNewContactDialog } from '@/app/people/PeopleNewContactDialog'
import { CreateCloudTaskDialog } from '@/components/CreateCloudTaskDialog'
import { ContextMenu, type ContextMenuItem } from '@/components/ContextMenu'
import { entityRefKindIcon } from '@/lib/entity-ref-ui'
import { setConnectionsCanvasMailPlacedHandler, useComposeStore } from '@/stores/compose'
import { useAccountsStore } from '@/stores/accounts'

type CalendarDetailDialogState = {
  anchor: ConnectionsCanvasCreateAnchor
  range: CalendarCreateRange
  draft: CalendarCreateQuickDraft
}

export function useConnectionsCanvasCreate({
  onEntityPlaced
}: {
  onEntityPlaced: (payload: {
    ref: ChronellEntityRef
    title: string
    subtitle: string | null
    anchor: ConnectionsCanvasCreateAnchor
    openPreview?: boolean
  }) => void | Promise<void>
}): {
  contextMenuProps: {
    onCanvasContextMenu: (anchor: ConnectionsCanvasCreateAnchor) => void
  }
  dialogs: JSX.Element
} {
  const { t } = useTranslation()
  const accounts = useAccountsStore((s) => s.accounts)
  const openFloatingNew = useComposeStore((s) => s.openFloatingNew)

  const [menu, setMenu] = useState<ConnectionsCanvasCreateAnchor | null>(null)
  const [anchor, setAnchor] = useState<ConnectionsCanvasCreateAnchor | null>(null)
  const [activeKind, setActiveKind] = useState<ConnectionsCanvasCreateKind | null>(null)
  const [quickCreate, setQuickCreate] = useState<{
    anchor: ConnectionsCanvasCreateAnchor
    range: CalendarCreateRange
  } | null>(null)
  const [calendarDetailDialog, setCalendarDetailDialog] =
    useState<CalendarDetailDialogState | null>(null)
  const [listsByAccount, setListsByAccount] = useState<Record<string, TaskListRow[]>>({})

  const taskAccounts = useMemo(
    () => accounts.filter((a) => a.provider === 'microsoft' || a.provider === 'google'),
    [accounts]
  )

  const calendarAccounts = useMemo(
    () => accounts.filter((a) => a.provider === 'microsoft' || a.provider === 'google'),
    [accounts]
  )

  const defaultAccountId = accounts[0]?.id ?? taskAccounts[0]?.id ?? null

  const loadListsForAccount = useCallback(
    async (accountId: string): Promise<TaskListRow[]> => {
      if (listsByAccount[accountId]) return listsByAccount[accountId]!
      const rows = await window.mailClient.tasks.listLists({ accountId })
      setListsByAccount((prev) => ({ ...prev, [accountId]: rows }))
      return rows
    },
    [listsByAccount]
  )

  const openDialog = useCallback(
    (kind: ConnectionsCanvasCreateKind, clickAnchor: ConnectionsCanvasCreateAnchor): void => {
      setMenu(null)
      setAnchor(clickAnchor)
      if (kind === 'mail') {
        if (!defaultAccountId) return
        openFloatingNew(defaultAccountId, { connectionsCanvasAnchor: clickAnchor })
        return
      }
      if (kind === 'calendar_event') {
        setQuickCreate({
          anchor: clickAnchor,
          range: defaultConnectionsCanvasCalendarRange()
        })
        return
      }
      setActiveKind(kind)
    },
    [defaultAccountId, openFloatingNew]
  )

  const finishPlace = useCallback(
    async (
      ref: ChronellEntityRef,
      title: string,
      subtitle: string | null = null,
      options?: { openPreview?: boolean; anchor?: ConnectionsCanvasCreateAnchor }
    ): Promise<void> => {
      const placeAnchor = options?.anchor ?? anchor
      if (!placeAnchor) return
      await onEntityPlaced({
        ref,
        title,
        subtitle,
        anchor: placeAnchor,
        openPreview: options?.openPreview
      })
      setAnchor(null)
      setActiveKind(null)
      setQuickCreate(null)
      setCalendarDetailDialog(null)
    },
    [anchor, onEntityPlaced]
  )

  useEffect(() => {
    setConnectionsCanvasMailPlacedHandler(({ messageId, anchor: canvasAnchor, title }) => {
      void finishPlace({ kind: 'mail', messageId }, title, null, {
        openPreview: false,
        anchor: canvasAnchor
      })
    })
    return (): void => setConnectionsCanvasMailPlacedHandler(null)
  }, [finishPlace])

  const menuItems: ContextMenuItem[] = useMemo(() => {
    const kinds: ConnectionsCanvasCreateKind[] = [
      'mail',
      'calendar_event',
      'task',
      'note',
      'contact'
    ]
    return kinds.map((kind) => {
      const Icon = entityRefKindIcon(kind === 'contact' ? 'people_contact' : kind)
      return {
        id: kind,
        label: t(`connections.canvasCreate.${kind}`),
        icon: Icon,
        disabled:
          (kind === 'mail' || kind === 'contact') && accounts.length === 0
            ? true
            : (kind === 'calendar_event' || kind === 'task') && taskAccounts.length === 0,
        onSelect: (): void => {
          if (!menu) return
          openDialog(kind, menu)
        }
      }
    })
  }, [accounts.length, menu, openDialog, t, taskAccounts.length])

  const dialogs = (
    <>
      {menu ? (
        <ContextMenu
          x={menu.clientX}
          y={menu.clientY}
          items={menuItems}
          onClose={(): void => setMenu(null)}
        />
      ) : null}

      {quickCreate
        ? createPortal(
            <CalendarCreateQuickPopover
              anchor={{
                x: quickCreate.anchor.clientX,
                y: quickCreate.anchor.clientY
              }}
              range={quickCreate.range}
              calendarAccounts={calendarAccounts}
              taskAccounts={taskAccounts}
              defaultAccountId={defaultAccountId ?? undefined}
              loadListsForAccount={loadListsForAccount}
              onClose={(): void => {
                setQuickCreate(null)
                setAnchor(null)
              }}
              onSaved={(): void => {}}
              onEntityCreated={(payload): void => {
                void finishPlace(payload.ref, payload.title, null, { openPreview: false })
              }}
              onOpenDetails={(draft): void => {
                const clickAnchor = quickCreate.anchor
                setQuickCreate(null)
                setCalendarDetailDialog({
                  anchor: clickAnchor,
                  range: draft.range,
                  draft
                })
              }}
            />,
            document.body
          )
        : null}

      <CalendarEventDialog
        open={calendarDetailDialog != null}
        mode="create"
        accounts={calendarAccounts}
        defaultAccountId={
          calendarDetailDialog?.draft.accountId ?? defaultAccountId ?? undefined
        }
        initialRange={calendarDetailDialog?.range ?? undefined}
        createPrefill={
          calendarDetailDialog
            ? { subject: calendarDetailDialog.draft.subject, location: '' }
            : undefined
        }
        initialCreateKind={calendarDetailDialog?.draft.createKind}
        initialGraphCalendarId={calendarDetailDialog?.draft.graphCalendarId || undefined}
        initialTaskListId={calendarDetailDialog?.draft.taskListId || undefined}
        taskAccounts={taskAccounts}
        loadListsForAccount={loadListsForAccount}
        onEntityCreated={(payload): void => {
          void finishPlace(payload.ref, payload.title, null, { openPreview: false })
        }}
        onClose={(): void => {
          setCalendarDetailDialog(null)
          setAnchor(null)
        }}
        onSaved={(): void => {}}
      />

      <CreateCloudTaskDialog
        open={activeKind === 'task'}
        onClose={(): void => {
          setActiveKind(null)
          setAnchor(null)
        }}
        onCreated={(task): void => {
          void finishPlace(
            {
              kind: 'cloud_task',
              accountId: task.accountId,
              listId: task.listId,
              taskId: task.id
            },
            task.title,
            task.notes
          )
        }}
        taskAccounts={taskAccounts}
        selection={null}
        loadListsForAccount={loadListsForAccount}
      />

      <ConnectionsNoteCreateDialog
        open={activeKind === 'note'}
        onClose={(): void => {
          setActiveKind(null)
          setAnchor(null)
        }}
        onCreated={async ({ title, body }): Promise<void> => {
          const note = await window.mailClient.notes.createStandalone({ title, body })
          await finishPlace({ kind: 'note', noteId: note.id }, title, null)
        }}
      />

      <PeopleNewContactDialog
        open={activeKind === 'contact'}
        onClose={(): void => {
          setActiveKind(null)
          setAnchor(null)
        }}
        accounts={accounts}
        preferredAccountId={defaultAccountId}
        onCreated={(contact: PeopleContactView): void => {
          void finishPlace(
            { kind: 'people_contact', contactId: contact.id },
            contact.displayName?.trim() ||
              contact.primaryEmail?.trim() ||
              t('connections.canvasCreate.contactUntitled'),
            contact.primaryEmail
          )
        }}
      />
    </>
  )

  return {
    contextMenuProps: {
      onCanvasContextMenu: (clickAnchor: ConnectionsCanvasCreateAnchor): void => {
        setMenu(clickAnchor)
      }
    },
    dialogs
  }
}
