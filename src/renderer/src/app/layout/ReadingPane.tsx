import {
  Mail,
  Reply,
  ReplyAll,
  Forward,
  Calendar,
  Clock,
  Hourglass,
  Archive,
  Trash2,
  Image,
  Star,
  MailOpen,
  Sun,
  Moon,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Paperclip,
  Download,
  FileText,
  FileImage,
  FileSpreadsheet,
  FileArchive,
  Loader2,
  Tag,
  ListTodo,
  CheckSquare,
  Unlink,
  SquareArrowOutUpRight,
  PanelRightClose
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useShallow } from 'zustand/react/shallow'
import { useMailStore } from '@/stores/mail'
import { openMailReadingPopout } from '@/lib/open-mail-reading-popout'
import { formatBytes } from '@/lib/format-bytes'
import { useAccountsStore } from '@/stores/accounts'
import { threadGroupingKey } from '@/lib/thread-group'
import { dedupeMailListThreadMessagesById } from '@/lib/mail-list-ui'
import { runMailQuickStep } from '@/lib/run-mail-quickstep'
import { useComposeStore } from '@/stores/compose'
import { useThemeStore } from '@/stores/theme'
import {
  mailPreviewScalePercent,
  useMailPreviewScaleStore
} from '@/stores/mail-preview-scale'
import { useMailPreviewZoom } from '@/hooks/use-mail-preview-zoom'
import { useSnoozeUiStore } from '@/stores/snooze-ui'
import { useUndoStore } from '@/stores/undo'
import { showAppAlert } from '@/stores/app-dialog'
import {
  buildMailShadowRootInnerHtml,
  replaceInlineCidImages,
  stripUnresolvedCidUrls,
  sanitizeMailHtml,
  type MailViewerTheme
} from '@/lib/sanitize'
import { isMailClientRuntimeComplete } from '@/lib/mail-client-runtime'
import { useSanitizedHtmlShadowRoot } from '@/lib/use-sanitized-html-shadow-root'
import { cn } from '@/lib/utils'
import { ContentCrossfade } from '@/components/motion/ContentCrossfade'
import { LoadingIndicator } from '@/components/motion/LoadingIndicator'
import { Avatar } from '@/components/Avatar'
import { profilePhotoSrcForEmail } from '@/lib/contact-avatar'
import { ReadingPaneCompose } from '@/components/ReadingPaneCompose'
import { MailCategoriesPopover } from '@/components/MailCategoriesPopover'
import { ObjectNoteEditor } from '@/components/ObjectNoteEditor'
import { ConnectionsPanel } from '@/components/connections/ConnectionsPanel'
import { LocalConnectionsGraph } from '@/components/connections/LocalConnectionsGraph'
import { useCreateCloudTaskUiStore } from '@/stores/create-cloud-task-ui'
import { accountSupportsCloudTasks } from '@/lib/cloud-task-accounts'
import type { AttachmentMeta, MailFull, ConnectedAccount, MailQuickStep } from '@shared/types'
import { outlookCategoryDotClass } from '@/lib/outlook-category-colors'
import type { IsolatedMailView } from '@/app/layout/use-isolated-mail-view'

/** `datetime-local` im Browser (lokale Zeit) aus ISO-String. */
function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

interface TriageAction {
  id: string
  label: string
  shortcut: string
  icon: React.ComponentType<{ className?: string }>
  disabled?: boolean
  destructive?: boolean
}

export type ReadingPaneProps = {
  /** Wenn keine Mail gewaehlt: eigener Titel (z. B. Kalender-Vorspalte). */
  emptySelectionTitle?: string
  emptySelectionBody?: string
  /** Ohne Mail-Auswahl keine Mail-Toolbar (z. B. Kalender-Vorschau). */
  hideChromeWhenEmpty?: boolean
  /** Mail-Arbeitsbereich: Vorschau ist als schwebendes Panel ausgeklappt. */
  previewDetached?: boolean
  /** Vorschau abdocken / wieder andocken (ersetzt getrennte Pop-up- und Abdock-Buttons). */
  onTogglePreviewDetach?: () => void
  /** Umschalt+Klick auf Abdock-Toggle: Lesefenster-Pop-up (modulübergreifend). */
  onRequestGlobalPopout?: (opts?: { osWindow?: boolean }) => void
  /** Abdock-Toggle ausblenden (z. B. schwebendes Panel hat eigene Titelleiste). */
  hidePreviewDetachToggle?: boolean
  /** Eigenes Fenster / globales Pop-up: feste Nachricht inkl. Konversation. */
  isolatedView?: IsolatedMailView
  /** Verbindungen-Modul: kein zweites Verbindungen-Panel im Lesefenster. */
  hideEntityConnections?: boolean
}

export function ReadingPane({
  emptySelectionTitle,
  emptySelectionBody,
  hideChromeWhenEmpty = false,
  previewDetached = false,
  onTogglePreviewDetach,
  onRequestGlobalPopout,
  hidePreviewDetachToggle = false,
  isolatedView,
  hideEntityConnections = false
}: ReadingPaneProps = {}): JSX.Element {
  const { t, i18n } = useTranslation()
  const storeMail = useMailStore(
    useShallow((s) => ({
      selectedMessage: s.selectedMessage,
      selectedMessageId: s.selectedMessageId,
      listKind: s.listKind,
      foldersByAccount: s.foldersByAccount,
      messageLoading: s.messageLoading,
      threadMessages: s.threadMessages
    }))
  )
  const selectedMessage = isolatedView?.selectedMessage ?? storeMail.selectedMessage
  const selectedMessageId = isolatedView?.selectedMessageId ?? storeMail.selectedMessageId
  const listKind = storeMail.listKind
  const foldersByAccount = storeMail.foldersByAccount
  const messageLoading = isolatedView?.messageLoading ?? storeMail.messageLoading
  const threadMessages = isolatedView?.threadMessages ?? storeMail.threadMessages
  const {
    setMessageRead,
    toggleMessageFlag,
    archiveMessage,
    deleteMessage,
    removeMailTodoRecordsForMessage,
    setTodoForMessage,
    setTodoScheduleForMessage,
    completeTodoForMessage,
    setWaitingForMessage,
    clearWaitingForMessage,
    selectMessage: selectMessageInStore
  } = useMailStore(
    useShallow((s) => ({
      setMessageRead: s.setMessageRead,
      toggleMessageFlag: s.toggleMessageFlag,
      archiveMessage: s.archiveMessage,
      deleteMessage: s.deleteMessage,
      removeMailTodoRecordsForMessage: s.removeMailTodoRecordsForMessage,
      setTodoForMessage: s.setTodoForMessage,
      setTodoScheduleForMessage: s.setTodoScheduleForMessage,
      completeTodoForMessage: s.completeTodoForMessage,
      setWaitingForMessage: s.setWaitingForMessage,
      clearWaitingForMessage: s.clearWaitingForMessage,
      selectMessage: s.selectMessage
    }))
  )
  const selectMessage = isolatedView?.selectMessage ?? selectMessageInStore
  const accounts = useAccountsStore((s) => s.accounts)
  const profilePhotoDataUrls = useAccountsStore((s) => s.profilePhotoDataUrls)
  const autoLoadImages = useAccountsStore((s) => s.config?.autoLoadImages ?? true)
  const openReply = useComposeStore((s) => s.openReply)
  const openForward = useComposeStore((s) => s.openForward)
  const openDraftFromMessage = useComposeStore((s) => s.openDraftFromMessage)
  const popOutCompose = useComposeStore((s) => s.popOutToWindow)
  const closeCompose = useComposeStore((s) => s.close)
  const readingPaneDraft = useComposeStore((s) => s.drafts.find((d) => d.embedInReadingPane) ?? null)
  const selectedFolderId = useMailStore((s) => s.selectedFolderId)
  const openSnoozePicker = useSnoozeUiStore((s) => s.open)

  const [quickSteps, setQuickSteps] = useState<MailQuickStep[]>([])
  const [quickStepSelectKey, setQuickStepSelectKey] = useState(0)
  const [todoScheduleStart, setTodoScheduleStart] = useState('')
  const [todoScheduleEnd, setTodoScheduleEnd] = useState('')
  const autoReadAttemptedIds = useRef<Set<number>>(new Set())

  const selectedFolderWellKnown = useMemo(() => {
    if (selectedMessage?.folderId == null) {
      if (selectedFolderId == null) return null
      for (const acc of accounts) {
        const folder = foldersByAccount[acc.id]?.find((f) => f.id === selectedFolderId)
        if (folder) return folder.wellKnown ?? null
      }
      return null
    }
    const folders = foldersByAccount[selectedMessage.accountId] ?? []
    return folders.find((f) => f.id === selectedMessage.folderId)?.wellKnown ?? null
  }, [selectedMessage, selectedFolderId, foldersByAccount, accounts])

  const isDraftsFolder = selectedFolderWellKnown === 'drafts'

  useEffect(() => {
    if (!selectedMessage || messageLoading || !isDraftsFolder) return
    openDraftFromMessage(selectedMessage)
  }, [selectedMessage, messageLoading, isDraftsFolder, openDraftFromMessage])

  useEffect(() => {
    if (!readingPaneDraft || !selectedMessage) return
    if (isDraftsFolder) return

    const tiesToSelection =
      readingPaneDraft.linkedMessageId === selectedMessage.id ||
      readingPaneDraft.replyToMessageId === selectedMessage.id

    const isStandaloneCompose =
      readingPaneDraft.linkedMessageId == null && readingPaneDraft.replyToMessageId == null

    if (isStandaloneCompose || !tiesToSelection) {
      closeCompose(readingPaneDraft.id)
    }
  }, [
    selectedMessage?.id,
    isDraftsFolder,
    readingPaneDraft?.id,
    readingPaneDraft?.linkedMessageId,
    readingPaneDraft?.replyToMessageId,
    closeCompose
  ])

  useEffect(() => {
    autoReadAttemptedIds.current.clear()
  }, [selectedMessageId])

  useEffect(() => {
    if (!selectedMessage) {
      setTodoScheduleStart('')
      setTodoScheduleEnd('')
      return
    }
    const s = selectedMessage.openTodoStartAt
    const e = selectedMessage.openTodoEndAt
    if (s && e) {
      setTodoScheduleStart(toDatetimeLocalValue(s))
      setTodoScheduleEnd(toDatetimeLocalValue(e))
      return
    }
    const now = new Date()
    now.setMinutes(0, 0, 0)
    now.setHours(now.getHours() + 1)
    const end = new Date(now)
    end.setHours(end.getHours() + 1)
    setTodoScheduleStart(toDatetimeLocalValue(now.toISOString()))
    setTodoScheduleEnd(toDatetimeLocalValue(end.toISOString()))
  }, [
    selectedMessage?.id,
    selectedMessage?.openTodoStartAt,
    selectedMessage?.openTodoEndAt
  ])

  useEffect(() => {
    if (!isMailClientRuntimeComplete()) {
      setQuickSteps([])
      return
    }
    void window.mailClient.mail
      .listQuickSteps()
      .then(setQuickSteps)
      .catch(() => setQuickSteps([]))
  }, [])

  const messageAccount =
    accounts.find((a) => a.id === selectedMessage?.accountId) ?? null

  const senderProfilePhoto =
    selectedMessage != null
      ? profilePhotoSrcForEmail(accounts, profilePhotoDataUrls, selectedMessage.fromAddr)
      : undefined

  const conversationThreadStrip = useMemo(() => {
    if (!selectedMessage) return null
    const k = threadGroupingKey(selectedMessage, true)
    const row = threadMessages[k]
    if (!row || row.length <= 1) return null
    const locale = i18n.language.startsWith('de') ? 'de-DE' : 'en-GB'
    return (
      <div className="shrink-0 border-b border-border bg-muted/35 px-4 py-3">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t('mail.readingPane.conversationCount', { count: row.length })}
        </p>
        <div className="flex max-h-[min(40vh,17.5rem)] flex-col gap-1.5 overflow-y-auto pr-1">
          {row.map((m) => {
            const subject = m.subject?.trim() || t('common.noSubject')
            const from = m.fromName?.trim() || m.fromAddr?.trim() || t('common.unknown')
            const sent = m.receivedAt || m.sentAt
            const dateLabel = sent
              ? new Date(sent).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' })
              : ''
            return (
              <button
                key={m.id}
                type="button"
                title={dateLabel ? `${from} — ${subject} — ${dateLabel}` : `${from} — ${subject}`}
                onClick={(): void => void selectMessage(m.id)}
                onDoubleClick={(e): void => {
                  e.stopPropagation()
                  openMailReadingPopout(m.id, { osWindow: e.shiftKey })
                }}
                className={cn(
                  'flex w-full min-h-[2.75rem] flex-col gap-0.5 rounded-md border px-3 py-2 text-left transition-colors',
                  m.id === selectedMessageId
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border/50 bg-background/70 text-foreground hover:border-border hover:bg-background'
                )}
              >
                <span
                  className={cn(
                    'line-clamp-2 text-xs leading-snug',
                    m.id === selectedMessageId ? 'font-semibold' : 'font-medium'
                  )}
                >
                  {subject}
                </span>
                <span className="truncate text-[10px] leading-tight text-muted-foreground">
                  {from}
                  {dateLabel ? ` · ${dateLabel}` : ''}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    )
  }, [selectedMessage, selectedMessageId, threadMessages, selectMessage, t, i18n.language])

  const appTheme = useThemeStore((s) => s.effective)

  // Sitzungs-Override: `null` = App-Theme; manueller Sonne/Mond-Toggle nur bis App-Theme wechselt.
  const [viewerOverride, setViewerOverride] = useState<MailViewerTheme | null>(null)
  const viewerTheme: MailViewerTheme = viewerOverride ?? appTheme

  useEffect(() => {
    setViewerOverride(null)
  }, [appTheme])

  function toggleViewerTheme(): void {
    const next: MailViewerTheme = viewerTheme === 'light' ? 'dark' : 'light'
    setViewerOverride(next)
  }

  useEffect(() => {
    try {
      window.localStorage.removeItem('mailclient.viewerTheme')
    } catch {
      // ignore
    }
  }, [])

  // Auto-Read: nach 800ms im Lesebereich als gelesen markieren (max. ein Versuch pro Nachricht)
  useEffect(() => {
    if (!selectedMessage || selectedMessage.isRead) return
    if (autoReadAttemptedIds.current.has(selectedMessage.id)) return
    const id = selectedMessage.id
    const timer = window.setTimeout(() => {
      autoReadAttemptedIds.current.add(id)
      void setMessageRead(id, true)
    }, 800)
    return (): void => window.clearTimeout(timer)
  }, [selectedMessage, selectedMessageId, setMessageRead])

  const actions: TriageAction[] = useMemo(() => {
    let deleteLabel = t('mail.readingPane.delete')
    if (listKind === 'todo') {
      deleteLabel = t('mail.contextMenu.removeTodoOnly')
    } else if (selectedMessage?.folderId != null) {
      for (const folders of Object.values(foldersByAccount)) {
        const f = folders.find((x) => x.id === selectedMessage.folderId)
        if (f?.wellKnown === 'deleteditems') {
          deleteLabel = t('mail.readingPane.deletePermanent')
          break
        }
      }
    }
    return [
      { id: 'reply', label: t('mail.readingPane.reply'), shortcut: 'R', icon: Reply, disabled: !selectedMessage },
      {
        id: 'replyAll',
        label: t('mail.readingPane.replyAll'),
        shortcut: 'Shift+R',
        icon: ReplyAll,
        disabled: !selectedMessage
      },
      { id: 'forward', label: t('mail.readingPane.forward'), shortcut: 'L', icon: Forward, disabled: !selectedMessage },
      { id: 'today', label: t('mail.readingPane.today'), shortcut: 'T', icon: Calendar, disabled: !selectedMessage },
      { id: 'tomorrow', label: t('mail.readingPane.tomorrow'), shortcut: 'M', icon: Moon, disabled: !selectedMessage },
      {
        id: 'todoDone',
        label: t('mail.readingPane.todoDone'),
        shortcut: '',
        icon: CheckSquare,
        disabled: !selectedMessage?.openTodoDueKind
      },
      { id: 'snooze', label: t('mail.readingPane.snooze'), shortcut: 'S', icon: Clock, disabled: !selectedMessage },
      {
        id: 'waiting',
        label: selectedMessage?.waitingForReplyUntil
          ? t('mail.readingPane.waitingEnd')
          : t('mail.readingPane.waitingStart'),
        shortcut: 'W',
        icon: Hourglass,
        disabled: !selectedMessage
      },
      {
        id: 'toggleRead',
        label: selectedMessage?.isRead ? t('mail.readingPane.markUnread') : t('mail.readingPane.markRead'),
        shortcut: 'U',
        icon: MailOpen,
        disabled: !selectedMessage
      },
      {
        id: 'flag',
        label: selectedMessage?.isFlagged ? t('mail.readingPane.unflag') : t('mail.readingPane.flag'),
        shortcut: 'F',
        icon: Star,
        disabled: !selectedMessage
      },
      {
        id: 'unsubscribe',
        label: t('mail.readingPane.unsubscribe'),
        shortcut: '',
        icon: Unlink,
        disabled:
          !selectedMessage ||
          !selectedMessage.listUnsubscribePost?.toLowerCase().includes('one-click')
      },
      { id: 'archive', label: t('mail.readingPane.archive'), shortcut: 'A', icon: Archive, disabled: !selectedMessage },
      {
        id: 'delete',
        label: deleteLabel,
        shortcut: 'Del',
        icon: Trash2,
        disabled: !selectedMessage,
        destructive: true
      }
    ]
  }, [selectedMessage, foldersByAccount, t, listKind])

  async function runAction(actionId: string, anchor?: { x: number; y: number }): Promise<void> {
    if (!selectedMessage) return
    switch (actionId) {
      case 'reply':
        openReply('reply', selectedMessage)
        break
      case 'replyAll':
        openReply('replyAll', selectedMessage)
        break
      case 'forward':
        openForward(selectedMessage)
        break
      case 'toggleRead':
        await setMessageRead(selectedMessage.id, !selectedMessage.isRead)
        break
      case 'flag':
        await toggleMessageFlag(selectedMessage.id)
        break
      case 'archive':
        await archiveMessage(selectedMessage.id)
        break
      case 'unsubscribe':
        await window.mailClient.mail.unsubscribeOneClick(selectedMessage.id)
        await useMailStore.getState().refreshNow()
        break
      case 'delete':
        if (listKind === 'todo') {
          await removeMailTodoRecordsForMessage(selectedMessage.id)
        } else {
          await deleteMessage(selectedMessage.id)
        }
        break
      case 'snooze':
        openSnoozePicker(
          selectedMessage.id,
          anchor ?? { x: window.innerWidth - 320, y: 80 }
        )
        break
      case 'today':
        await setTodoForMessage(selectedMessage.id, 'today')
        break
      case 'tomorrow':
        await setTodoForMessage(selectedMessage.id, 'tomorrow')
        break
      case 'todoDone':
        await completeTodoForMessage(selectedMessage.id)
        break
      case 'waiting':
        if (selectedMessage.waitingForReplyUntil) {
          await clearWaitingForMessage(selectedMessage.id)
        } else {
          await setWaitingForMessage(selectedMessage.id, 7)
        }
        break
    }
  }

  // Tastatur-Shortcuts liegen jetzt zentral in `useGlobalShortcuts` (App.tsx).

  // Visuell gruppierte Action-Toolbar:
  // Antworten/Forward | Workflow (Snooze/Heute/Warten auf) | Read/Flag | Archive/Delete
  const actionsById = new Map(actions.map((a) => [a.id, a] as const))
  const actionGroups: TriageAction[][] = [
    ['reply', 'replyAll', 'forward']
      .map((id) => actionsById.get(id))
      .filter((a): a is TriageAction => Boolean(a)),
    ['today', 'tomorrow', 'todoDone', 'snooze', 'waiting']
      .map((id) => actionsById.get(id))
      .filter((a): a is TriageAction => Boolean(a)),
    ['toggleRead', 'flag']
      .map((id) => actionsById.get(id))
      .filter((a): a is TriageAction => Boolean(a)),
    ['unsubscribe', 'archive', 'delete']
      .map((id) => actionsById.get(id))
      .filter((a): a is TriageAction => Boolean(a))
  ]

  if (!selectedMessageId && hideChromeWhenEmpty) {
    return (
      <section className="glass-fill flex min-h-0 flex-1 flex-col overflow-hidden">
        <EmptyState
          title={emptySelectionTitle ?? t('mail.readingPane.emptyNoSelectionTitle')}
          body={emptySelectionBody ?? t('mail.readingPane.emptyNoSelectionBody')}
        />
      </section>
    )
  }

  return (
    <section className="glass-fill flex min-h-0 flex-1 flex-col overflow-hidden">
      {!readingPaneDraft && (
      <div className="flex min-h-10 shrink-0 flex-wrap items-center gap-x-1 gap-y-1 border-b border-border px-2 py-1">
        <IconButton
          icon={viewerTheme === 'light' ? Sun : Moon}
          label={viewerTheme === 'light' ? t('mail.readingPane.viewerLight') : t('mail.readingPane.viewerDark')}
          onClick={toggleViewerTheme}
        />
        <MailPreviewZoomToolbar />

        <label className="sr-only" htmlFor="readingpane-quickstep">
          {t('mail.readingPane.quickStepSr')}
        </label>
        <select
          key={quickStepSelectKey}
          id="readingpane-quickstep"
          className={cn(
            'h-7 max-w-[11rem] shrink-0 rounded-md border border-border bg-background px-2 text-xs text-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
          )}
          defaultValue=""
          disabled={!selectedMessage}
          aria-label={t('mail.readingPane.quickStepAria')}
          onChange={(e) => {
            const raw = e.target.value
            const id = Number.parseInt(raw, 10)
            setQuickStepSelectKey((k) => k + 1)
            if (!selectedMessage || !Number.isFinite(id) || id <= 0) return
            const tk = threadGroupingKey(selectedMessage, true)
            const threadRow = threadMessages[tk]
            void runMailQuickStep(
              id,
              selectedMessage,
              threadRow && threadRow.length > 1
                ? dedupeMailListThreadMessagesById(threadRow)
                : undefined
            ).catch((err) => console.warn('[ReadingPane] QuickStep:', err))
          }}
        >
          <option value="">{t('mail.readingPane.quickStepPlaceholder')}</option>
          {quickSteps.map((q) => (
            <option key={q.id} value={q.id}>
              {q.name}
            </option>
          ))}
        </select>

        {selectedMessage && (
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="shrink-0 font-semibold text-muted-foreground">{t('mail.readingPane.todoScheduleLabel')}</span>
            <label className="flex shrink-0 items-center gap-1.5">
              <span className="whitespace-nowrap text-[10px] text-muted-foreground">{t('mail.readingPane.start')}</span>
              <input
                type="datetime-local"
                value={todoScheduleStart}
                onChange={(e): void => setTodoScheduleStart(e.target.value)}
                className="h-7 rounded border border-border bg-background px-1.5 text-[11px] text-foreground"
              />
            </label>
            <label className="flex shrink-0 items-center gap-1.5">
              <span className="whitespace-nowrap text-[10px] text-muted-foreground">{t('mail.readingPane.end')}</span>
              <input
                type="datetime-local"
                value={todoScheduleEnd}
                onChange={(e): void => setTodoScheduleEnd(e.target.value)}
                className="h-7 rounded border border-border bg-background px-1.5 text-[11px] text-foreground"
              />
            </label>
            <button
              type="button"
              className="rounded-md bg-secondary px-2.5 py-1 text-[11px] font-medium text-secondary-foreground hover:bg-secondary/80"
              onClick={(): void => {
                if (!todoScheduleStart || !todoScheduleEnd) {
                  useUndoStore.getState().pushToast({
                    label: t('mail.readingPane.toastNeedStartEnd'),
                    variant: 'error',
                    durationMs: 4000
                  })
                  return
                }
                const s = new Date(todoScheduleStart).toISOString()
                const e = new Date(todoScheduleEnd).toISOString()
                if (!Number.isFinite(Date.parse(s)) || !Number.isFinite(Date.parse(e)) || e <= s) {
                  useUndoStore.getState().pushToast({
                    label: t('mail.readingPane.toastEndAfterStart'),
                    variant: 'error',
                    durationMs: 4000
                  })
                  return
                }
                void setTodoScheduleForMessage(selectedMessage.id, s, e).catch(() => undefined)
              }}
            >
              {t('mail.readingPane.saveAppointment')}
            </button>
          </div>
        )}

        <div className="flex-1" />

        {actionGroups.map((group, gi) => (
          <div key={gi} className="flex items-center gap-0.5">
            {gi > 0 && <span className="mx-1 h-5 w-px bg-border" aria-hidden />}
            {group.map((a) => (
              <IconButton
                key={a.id}
                icon={a.icon}
                label={a.label}
                shortcut={a.shortcut}
                disabled={a.disabled}
                destructive={a.destructive}
                highlight={
                  (a.id === 'flag' && selectedMessage?.isFlagged) ||
                  (a.id === 'waiting' && Boolean(selectedMessage?.waitingForReplyUntil))
                }
                onClick={(e): void => {
                  if (a.id === 'snooze') {
                    const rect = e.currentTarget.getBoundingClientRect()
                    void runAction(a.id, {
                      x: rect.right - 288,
                      y: rect.bottom + 4
                    })
                  } else {
                    void runAction(a.id)
                  }
                }}
              />
            ))}
          </div>
        ))}

        {!hidePreviewDetachToggle && onTogglePreviewDetach ? (
          <button
            type="button"
            className="ml-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
            title={
              previewDetached
                ? t('mail.readingPane.previewDockBackTitle')
                : onRequestGlobalPopout
                  ? t('mail.readingPane.previewPopOutTitle')
                  : t('mail.readingPane.previewPopOutTitleShort')
            }
            aria-pressed={previewDetached}
            onClick={(e): void => {
              if (e.shiftKey && onRequestGlobalPopout) {
                onRequestGlobalPopout({ osWindow: true })
                return
              }
              onTogglePreviewDetach()
            }}
          >
            {previewDetached ? (
              <PanelRightClose className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <SquareArrowOutUpRight className="h-3.5 w-3.5" aria-hidden />
            )}
          </button>
        ) : null}
      </div>
      )}

      {readingPaneDraft ? (
        <ReadingPaneCompose
          draft={readingPaneDraft}
          onPopOut={(): void => popOutCompose(readingPaneDraft.id)}
          onClose={(): void => closeCompose(readingPaneDraft.id)}
        />
      ) : !selectedMessageId ? (
        <EmptyState
          title={emptySelectionTitle ?? t('mail.readingPane.emptyNoSelectionTitle')}
          body={
            emptySelectionBody ?? t('mail.readingPane.emptyNoSelectionBody')
          }
        />
      ) : messageLoading && !selectedMessage ? (
        <LoadingIndicator className="flex-1" label={t('mail.readingPane.loadingMail')} />
      ) : !selectedMessage ? (
        <EmptyState
          title={t('mail.readingPane.notFoundTitle')}
          body={t('mail.readingPane.notFoundBody')}
        />
      ) : (
        <ContentCrossfade
          contentKey={selectedMessageId}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          {conversationThreadStrip}
          <MailReader
            message={selectedMessage}
            account={messageAccount}
            senderProfilePhoto={senderProfilePhoto}
            viewerTheme={viewerTheme}
            autoLoadImages={autoLoadImages}
            hideEntityConnections={hideEntityConnections}
            onToggleFlag={(): void => void runAction('flag')}
            onReply={(): void => openReply('reply', selectedMessage)}
            onReplyAll={(): void => openReply('replyAll', selectedMessage)}
            onForward={(): void => openForward(selectedMessage)}
          />
        </ContentCrossfade>
      )}
    </section>
  )
}

function MailPreviewZoomToolbar(): JSX.Element {
  const { t } = useTranslation()
  const scale = useMailPreviewScaleStore((s) => s.scale)
  const stepScale = useMailPreviewScaleStore((s) => s.stepScale)
  const resetScale = useMailPreviewScaleStore((s) => s.resetScale)
  const pct = mailPreviewScalePercent(scale)

  return (
    <>
      <IconButton
        icon={ZoomOut}
        label={t('mail.readingPane.zoomOut')}
        onClick={(): void => stepScale(-0.1)}
      />
      <span
        className="min-w-[2.75rem] shrink-0 text-center text-[10px] tabular-nums text-muted-foreground"
        title={t('mail.readingPane.zoomHint')}
      >
        {pct}%
      </span>
      <IconButton
        icon={ZoomIn}
        label={t('mail.readingPane.zoomIn')}
        onClick={(): void => stepScale(0.1)}
      />
      <IconButton
        icon={RotateCcw}
        label={t('mail.readingPane.zoomReset')}
        onClick={(): void => resetScale()}
      />
    </>
  )
}

function MailReader({
  message,
  account,
  senderProfilePhoto,
  viewerTheme,
  autoLoadImages,
  hideEntityConnections = false,
  onToggleFlag,
  onReply,
  onReplyAll,
  onForward
}: {
  message: MailFull
  account: ConnectedAccount | null
  senderProfilePhoto?: string
  viewerTheme: MailViewerTheme
  autoLoadImages: boolean
  hideEntityConnections?: boolean
  onToggleFlag: () => void
  onReply: () => void
  onReplyAll: () => void
  onForward: () => void
}): JSX.Element {
  const { t, i18n } = useTranslation()
  const [loadImages, setLoadImages] = useState(autoLoadImages)
  const [inlineImages, setInlineImages] = useState<Record<string, string>>({})
  const [attachments, setAttachments] = useState<AttachmentMeta[]>([])
  const [attachmentsLoading, setAttachmentsLoading] = useState(false)
  const shadowHostRef = useRef<HTMLDivElement>(null)
  const previewScale = useMailPreviewScaleStore((s) => s.scale)
  useMailPreviewZoom(shadowHostRef, { attachKey: message.id })
  const [categoryOpen, setCategoryOpen] = useState(false)
  const [categoryAnchor, setCategoryAnchor] = useState({ x: 0, y: 0 })

  useEffect(() => {
    setCategoryOpen(false)
  }, [message.id])

  // Anhaenge bei jedem Mail-Wechsel laden. Wir vertrauen `hasAttachments`
  // NICHT, weil Microsoft Graph dieses Flag bei manchen Mails nicht korrekt
  // setzt. WICHTIG: das Effect haengt nur an `message.id` – sonst triggern
  // unsere eigenen DB-Korrekturen (s.u.) einen Re-Run und die Bar flackert.
  useEffect(() => {
    setAttachments([])
    setInlineImages({})

    const messageId = message.id
    let cancelled = false
    setAttachmentsLoading(true)

    void window.mailClient.mail
      .listAttachments(messageId)
      .then((items) => {
        if (cancelled) return
        setAttachments(items)

        // Falls die DB-Information „hat Anhaenge" nicht stimmt, in der DB
        // korrigieren – damit das Paperclip-Icon in der Liste passt.
        // closure-capture auf `message.hasAttachments` ist ok, weil wir
        // den Wert nur zum Zeitpunkt des Initial-Laden vergleichen.
        const realHasAttachments = items.some((a) => !a.isInline)
        if (realHasAttachments && !message.hasAttachments) {
          void window.mailClient.mail
            .syncAttachmentsFlag(messageId, true)
            .catch(() => undefined)
        }

        // Inline-Bilder fuer cid:-Referenzen im HTML nachladen (Signatur, Logo, …).
        const hasInline = items.some((a) => a.isInline)
        if (hasInline && message.bodyHtml) {
          return window.mailClient.mail.fetchInlineImages(messageId).then((map) => {
            if (!cancelled) setInlineImages(map)
          })
        }
        return
      })
      .catch((e) => console.warn('[mail] attachments load failed', e))
      .finally(() => {
        if (!cancelled) setAttachmentsLoading(false)
      })

    return (): void => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message.id])

  // Nur echte Anhaenge in der Leiste; Inline-Bilder werden im Mail-Body
  // per cid:-Ersetzung dargestellt (wie vom Absender eingebettet).
  const visibleAttachments = useMemo(
    () =>
      attachments.filter((a) => {
        if (a.isInline) return false
        if ((a.size ?? 0) > 0 && (a.size ?? 0) < 200) return false
        return true
      }),
    [attachments]
  )

  const realAttachmentCount = visibleAttachments.length

  // Anhang-Bar nur zeigen, wenn auch wirklich etwas da ist. Den Lade-
  // Indikator zeigen wir bewusst NUR, wenn die DB schon weiss, dass die
  // Mail Anhaenge hat – sonst flackert er bei jeder Mail einmal kurz auf.
  const showAttachmentBar = visibleAttachments.length > 0
  const showAttachmentLoading =
    attachmentsLoading && message.hasAttachments && visibleAttachments.length === 0

  const safeHtml = useMemo(() => {
    if (message.bodyHtml) {
      const withInline = replaceInlineCidImages(message.bodyHtml, inlineImages)
      return sanitizeMailHtml(stripUnresolvedCidUrls(withInline), { loadImages })
    }
    if (message.bodyText) {
      const escaped = escapeHtml(message.bodyText).replace(/\n/g, '<br>')
      // Dunkel: invert()-Filter im Shadow-Root — dunkle Vorschlagsfarbe wird hell dargestellt.
      const color = viewerTheme === 'light' ? '#1f1f23' : '#1a1a1a'
      const fontPx = Math.round(14 * previewScale)
      return `<pre style="white-space:pre-wrap;font-family:inherit;font-size:${fontPx}px;color:${color};">${escaped}</pre>`
    }
    const muted = viewerTheme === 'light' ? '#6b6b73' : '#5c5c5c'
    return `<p style="color:${muted};font-style:italic;">${t('mail.readingPane.noContent')}</p>`
  }, [message.bodyHtml, message.bodyText, loadImages, viewerTheme, inlineImages, previewScale, t])

  const shadowInnerHtml = useMemo(
    () => buildMailShadowRootInnerHtml(safeHtml, viewerTheme, previewScale),
    [safeHtml, viewerTheme, previewScale]
  )
  useSanitizedHtmlShadowRoot(shadowHostRef, shadowInnerHtml, 'mail', viewerTheme, previewScale)

  useEffect(() => {
    setLoadImages(autoLoadImages)
  }, [message.id, autoLoadImages])

  const sent = message.receivedAt || message.sentAt
  const dateLabel = sent
    ? new Date(sent).toLocaleString(i18n.language.startsWith('de') ? 'de-DE' : 'en-GB')
    : ''
  const categories = message.categories ?? []

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="shrink-0 space-y-3 border-b border-border px-6 py-4">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1 space-y-1.5">
            <h1 className="text-base font-semibold leading-snug text-foreground">
              {message.subject || t('common.noSubject')}
            </h1>
            {categories.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {categories.map((c) => (
                  <span
                    key={c}
                    className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-secondary/60 px-2 py-0.5 text-[10px] font-medium text-foreground/90"
                    title={c}
                  >
                    <span
                      className={cn('h-2 w-2 shrink-0 rounded-full', outlookCategoryDotClass(null))}
                      aria-hidden
                    />
                    <span className="truncate">{c}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex shrink-0 items-start gap-1">
            <div
              className="mr-1 flex items-center gap-0.5 border-r border-border/60 pr-2"
              role="group"
              aria-label={t('mail.readingPane.replyActionsAria')}
            >
              <IconButton
                icon={Reply}
                label={t('mail.readingPane.reply')}
                shortcut="R"
                onClick={onReply}
                iconClassName="text-violet-500"
                hoverClassName="hover:bg-violet-500/15 hover:text-violet-400"
              />
              <IconButton
                icon={ReplyAll}
                label={t('mail.readingPane.replyAll')}
                shortcut="Shift+R"
                onClick={onReplyAll}
                iconClassName="text-violet-500"
                hoverClassName="hover:bg-violet-500/15 hover:text-violet-400"
              />
              <IconButton
                icon={Forward}
                label={t('mail.readingPane.forward')}
                shortcut="L"
                onClick={onForward}
                iconClassName="text-sky-500"
                hoverClassName="hover:bg-sky-500/15 hover:text-sky-400"
              />
            </div>
            <ObjectNoteEditor
              target={{
                kind: 'mail',
                messageId: message.id,
                title: message.subject || t('common.noSubject')
              }}
            />
            {message.openTodoId != null && account && accountSupportsCloudTasks(account) ? (
              <button
                type="button"
                onClick={(): void => {
                  useCreateCloudTaskUiStore
                    .getState()
                    .open(message, message.openTodoId ?? undefined)
                }}
                className="inline-flex h-6 shrink-0 items-center gap-1 rounded-md border border-border px-2 text-[10px] font-medium text-foreground transition-colors hover:bg-secondary/70"
                title={t('mail.promoteCloudTask.buttonTitle')}
              >
                <ListTodo className="h-3 w-3 text-emerald-500" />
                {t('mail.promoteCloudTask.button')}
              </button>
            ) : null}
            <button
              type="button"
              disabled={!account}
              onClick={(e): void => {
                if (!account) return
                const r = e.currentTarget.getBoundingClientRect()
                setCategoryAnchor({ x: Math.max(8, r.left), y: r.bottom + 6 })
                setCategoryOpen(true)
              }}
              className={cn(
                'inline-flex h-6 shrink-0 items-center gap-1 rounded-md border px-2 text-[10px] font-medium transition-colors',
                categories.length > 0
                  ? 'border-border bg-secondary/40 text-foreground hover:bg-secondary/70'
                  : 'border-dashed border-border text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
              )}
              title={t('mail.readingPane.categoriesTitle')}
            >
              <Tag className="h-3 w-3" />
              {t('mail.readingPane.categories')}
            </button>
            {realAttachmentCount > 0 && (
              <span
                className="inline-flex shrink-0 items-center gap-1 rounded-full bg-status-flagged/15 px-2 py-0.5 text-[11px] font-medium text-status-flagged"
                title={`${realAttachmentCount} ${
                  realAttachmentCount === 1
                    ? t('mail.readingPane.attachment_one')
                    : t('mail.readingPane.attachment_other')
                }`}
              >
                <Paperclip className="h-3 w-3" />
                {realAttachmentCount}
              </span>
            )}
            <button
              type="button"
              onClick={onToggleFlag}
              className={cn(
                'shrink-0 rounded p-1 transition-colors',
                message.isFlagged
                  ? 'text-status-flagged hover:bg-status-flagged/10'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
              )}
              title={message.isFlagged ? t('mail.readingPane.flagRemoveTitle') : t('mail.readingPane.flagSetTitle')}
            >
              <Star
                className={cn(
                  'h-4 w-4',
                  message.isFlagged && 'fill-status-flagged text-status-flagged'
                )}
              />
            </button>
          </div>
        </div>
        <MailCategoriesPopover
          open={categoryOpen}
          anchor={categoryAnchor}
          messageId={message.id}
          account={account}
          selectedNames={categories}
          onClose={(): void => setCategoryOpen(false)}
        />
        <div className="flex items-start gap-3">
          <Avatar
            name={message.fromName}
            email={message.fromAddr}
            accountColor={account?.color}
            imageSrc={senderProfilePhoto}
            useGravatar={Boolean(message.fromAddr?.trim())}
            size="lg"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="truncate text-sm font-medium text-foreground">
                {message.fromName || message.fromAddr || t('common.unknown')}
              </span>
              {message.fromAddr && message.fromName && (
                <span className="truncate text-[11px] text-muted-foreground">
                  &lt;{message.fromAddr}&gt;
                </span>
              )}
            </div>
            {message.toAddrs && (
              <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                <span className="font-medium text-foreground/70">{t('mail.readingPane.toPrefix')}</span> {message.toAddrs}
              </div>
            )}
            {message.ccAddrs && (
              <div className="truncate text-[11px] text-muted-foreground">
                <span className="font-medium text-foreground/70">{t('mail.readingPane.ccPrefix')}</span> {message.ccAddrs}
              </div>
            )}
          </div>
          <div className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
            {dateLabel}
          </div>
        </div>
        {!loadImages && message.bodyHtml && hasExternalImages(message.bodyHtml) && (
          <button
            type="button"
            onClick={(): void => setLoadImages(true)}
            className="flex items-center gap-1.5 rounded-md border border-border bg-secondary/40 px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-secondary"
          >
            <Image className="h-3 w-3" />
            {t('mail.readingPane.loadExternalImages')}
          </button>
        )}

        {showAttachmentBar && (
          <AttachmentBar messageId={message.id} attachments={visibleAttachments} />
        )}
        {showAttachmentLoading && (
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            {t('mail.readingPane.loadingAttachments')}
          </div>
        )}
      </header>

      <div
        ref={shadowHostRef}
        className="mail-reading-shadow-host flex min-h-0 min-w-0 flex-1 flex-col overflow-auto touch-pan-y"
        style={{ zoom: previewScale }}
        data-mail-viewer-theme={viewerTheme}
        data-mail-preview-scale={String(previewScale)}
        role="document"
        aria-label={t('mail.readingPane.contentIframeTitle')}
      />

      <ObjectNoteEditor
        target={{
          kind: 'mail',
          messageId: message.id,
          title: message.subject || t('common.noSubject')
        }}
        variant="section"
        sectionCollapsedDefault
        layout="toggle"
        className="shrink-0 border-t border-border bg-secondary/5 px-6 py-2"
      />

      {!hideEntityConnections ? (
        message.openTodoId != null ? (
          <>
            <LocalConnectionsGraph
              anchor={{ kind: 'mail_todo', todoId: message.openTodoId }}
              className="shrink-0 bg-secondary/5"
            />
            <ConnectionsPanel
              anchor={{ kind: 'mail_todo', todoId: message.openTodoId }}
              sectionCollapsedDefault
              className="shrink-0 bg-secondary/5"
            />
          </>
        ) : (
          <>
            <LocalConnectionsGraph
              anchor={{ kind: 'mail', messageId: message.id }}
              className="shrink-0 bg-secondary/5"
            />
            <ConnectionsPanel
              anchor={{ kind: 'mail', messageId: message.id }}
              sectionCollapsedDefault
              className="shrink-0 bg-secondary/5"
            />
          </>
        )
      ) : null}

    </div>
  )
}

function AttachmentBar({
  messageId,
  attachments
}: {
  messageId: number
  attachments: AttachmentMeta[]
}): JSX.Element | null {
  const { t } = useTranslation()
  const [busyId, setBusyId] = useState<string | null>(null)

  if (attachments.length === 0) return null

  async function open(a: AttachmentMeta): Promise<void> {
    setBusyId(a.id)
    try {
      const res = await window.mailClient.mail.openAttachment(messageId, a.id)
      if (!res.ok && res.error) {
        console.warn('[mail] open attachment failed:', res.error)
        await showAppAlert(t('mail.readingPane.openAttachmentFail', { error: res.error }), {
          title: t('mail.readingPane.attachmentDialogTitle')
        })
      }
    } finally {
      setBusyId(null)
    }
  }

  async function saveAs(a: AttachmentMeta, e: React.MouseEvent): Promise<void> {
    e.stopPropagation()
    setBusyId(a.id)
    try {
      const res = await window.mailClient.mail.saveAttachmentAs(messageId, a.id, a.name)
      if (!res.ok && !res.cancelled && res.error) {
        console.warn('[mail] save attachment failed:', res.error)
        await showAppAlert(t('mail.readingPane.saveAttachmentFail', { error: res.error }), {
          title: t('mail.readingPane.saveAttachmentTitle')
        })
      }
    } finally {
      setBusyId(null)
    }
  }

  const count = attachments.length

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <div className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
        <Paperclip className="h-3 w-3" />
        {`${count} ${count === 1 ? t('mail.readingPane.attachment_one') : t('mail.readingPane.attachment_other')}`}
      </div>
      {attachments.map((a) => {
        const Icon = pickAttachmentIcon(a)
        const isBusy = busyId === a.id
        return (
          <div
            key={a.id}
            className="group flex items-center gap-1.5 overflow-hidden rounded-md border border-border bg-secondary/40 pl-2 pr-1 transition-colors hover:bg-secondary"
          >
            <button
              type="button"
              onClick={(): void => void open(a)}
              disabled={isBusy}
              title={t('mail.readingPane.openAttachmentTitle', {
                name: a.name,
                size: a.size != null ? ` (${formatBytes(a.size)})` : ''
              })}
              className="flex max-w-[260px] items-center gap-1.5 py-1 text-left text-[11px] text-foreground disabled:opacity-50"
            >
              {isBusy ? (
                <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
              ) : (
                <Icon className="h-3 w-3 shrink-0 text-muted-foreground" />
              )}
              <span className="truncate font-medium">{a.name}</span>
              {a.size != null && (
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {formatBytes(a.size)}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={(e): void => void saveAs(a, e)}
              disabled={isBusy}
              title={t('mail.readingPane.saveAttachmentAsTitle')}
              className="ml-0.5 rounded p-1 text-muted-foreground transition-colors hover:bg-background hover:text-foreground disabled:opacity-50"
            >
              <Download className="h-3 w-3" />
            </button>
          </div>
        )
      })}
    </div>
  )
}

function pickAttachmentIcon(a: AttachmentMeta): React.ComponentType<{ className?: string }> {
  const ct = (a.contentType ?? '').toLowerCase()
  const ext = (a.name.split('.').pop() ?? '').toLowerCase()
  if (ct.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) {
    return FileImage
  }
  if (ct.includes('spreadsheet') || ['xls', 'xlsx', 'csv', 'ods'].includes(ext)) {
    return FileSpreadsheet
  }
  if (ct.includes('zip') || ['zip', '7z', 'rar', 'tar', 'gz'].includes(ext)) {
    return FileArchive
  }
  return FileText
}

function IconButton({
  icon: Icon,
  label,
  shortcut,
  onClick,
  disabled,
  destructive,
  highlight,
  iconClassName,
  hoverClassName
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  shortcut?: string
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void
  disabled?: boolean
  destructive?: boolean
  highlight?: boolean
  iconClassName?: string
  hoverClassName?: string
}): JSX.Element {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={shortcut ? `${label} (${shortcut})` : label}
      aria-label={label}
      className={cn(
        'flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors',
        disabled
          ? 'cursor-not-allowed text-muted-foreground/40'
          : destructive
            ? 'text-muted-foreground hover:bg-destructive/20 hover:text-destructive'
            : hoverClassName ?? 'hover:bg-secondary hover:text-foreground',
        !disabled && !destructive && !hoverClassName && 'text-muted-foreground',
        highlight && 'text-status-flagged'
      )}
    >
      <Icon
        className={cn(
          'h-4 w-4',
          !disabled && iconClassName,
          highlight && 'fill-status-flagged text-status-flagged'
        )}
      />
    </button>
  )
}

function EmptyState({ title, body }: { title: string; body: string }): JSX.Element {
  return (
    <div className="flex flex-1 items-center justify-center px-6">
      <div className="max-w-sm space-y-3 text-center">
        <Mail className="mx-auto h-10 w-10 text-muted-foreground/40" strokeWidth={1.5} />
        <h2 className="text-base font-semibold text-foreground/90">{title}</h2>
        <p className="text-xs leading-relaxed text-muted-foreground">{body}</p>
      </div>
    </div>
  )
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function hasExternalImages(html: string): boolean {
  return /<img\b[^>]*\bsrc\s*=\s*["']?https?:/i.test(html)
}
