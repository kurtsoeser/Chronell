import { useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import {
  Archive,
  Loader2,
  Mail,
  MailOpen,
  Maximize2,
  Paperclip,
  Reply,
  Trash2
} from 'lucide-react'
import type { ContactHistoryHoverState } from '@/app/layout/mail-right-sidebar/use-contact-history-hover-preview'
import {
  buildContactHistoryPreviewBodyHtml,
  buildContactHistoryPreviewSnippetHtml
} from '@/app/layout/mail-right-sidebar/contact-history-preview-body'
import { chronellAcrylicPopoverClass } from '@/lib/chronell-ui-classes'
import { formatBytes } from '@/lib/format-bytes'
import { mailFileRowIcon } from '@/lib/mail-file-display'
import { cn } from '@/lib/utils'
import { useComposeStore } from '@/stores/compose'
import { useMailStore } from '@/stores/mail'

interface Props {
  state: ContactHistoryHoverState
  correspondentDisplayName: string | null
  youLabel: string
  onMouseEnter: () => void
  onMouseLeave: () => void
  onOpenMessage: (messageId: number) => void
  onMessageRemoved?: (messageId: number) => void
  onMessageReadChanged?: (messageId: number, isRead: boolean) => void
}

export function ContactHistoryHoverPreview({
  state,
  correspondentDisplayName,
  youLabel,
  onMouseEnter,
  onMouseLeave,
  onOpenMessage,
  onMessageRemoved,
  onMessageReadChanged
}: Props): JSX.Element | null {
  const { t, i18n } = useTranslation()
  const locale = i18n.language.startsWith('de') ? 'de-DE' : 'en-GB'
  const { item, panel, payload, loading, error } = state
  const message = payload?.message ?? null
  const attachments = payload?.attachments ?? []
  const archiveMessage = useMailStore((s) => s.archiveMessage)
  const deleteMessage = useMailStore((s) => s.deleteMessage)
  const setMessageRead = useMailStore((s) => s.setMessageRead)

  const whenLabel = useMemo(() => {
    const iso = item.receivedAt ?? item.sentAt
    if (!iso) return ''
    try {
      const d = new Date(iso)
      if (Number.isNaN(d.getTime())) return ''
      return d.toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })
    } catch {
      return ''
    }
  }, [item.receivedAt, item.sentAt, locale])

  const fromLabel = useMemo(() => {
    if (item.isFromMe) return youLabel
    return (
      message?.fromName?.trim() ||
      item.fromName?.trim() ||
      correspondentDisplayName?.trim() ||
      message?.fromAddr?.trim() ||
      item.fromAddr?.trim() ||
      '—'
    )
  }, [item, message, correspondentDisplayName, youLabel])

  const toLabel = useMemo(() => {
    const raw = message?.toAddrs ?? item.toAddrs
    if (!raw?.trim()) return '—'
    const first = raw.split(/[;,]/)[0]?.trim()
    return first || raw.trim()
  }, [message, item.toAddrs])

  const inlineImages = payload?.inlineImages ?? {}

  const bodyHtml = useMemo(() => {
    if (message) {
      return buildContactHistoryPreviewBodyHtml(message, item.snippet, inlineImages)
    }
    if (item.snippet?.trim()) return buildContactHistoryPreviewSnippetHtml(item.snippet)
    return ''
  }, [message, item.snippet, inlineImages])

  const maxAttachmentsShown = 6
  const shownAttachments = attachments.slice(0, maxAttachmentsShown)
  const moreAttachments = attachments.length - shownAttachments.length

  const iconBtnClass =
    'inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-40'

  const runAndRemove = (fn: () => Promise<void>): void => {
    void fn().then(() => {
      onMessageRemoved?.(item.id)
    })
  }

  return createPortal(
    <div
      className="fixed z-[200] flex flex-col pointer-events-auto"
      style={{
        top: panel.top,
        left: panel.left,
        width: panel.width,
        maxHeight: panel.maxHeight
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      role="dialog"
      aria-label={t('mail.rightSidebar.contactPreviewAria')}
    >
      <div
        className={cn(
          chronellAcrylicPopoverClass,
          'flex max-h-full min-h-0 flex-col overflow-hidden rounded-lg border border-border shadow-xl'
        )}
      >
        <div className="shrink-0 border-b border-border px-3 py-2.5">
          <h3 className="line-clamp-2 text-xs font-semibold leading-snug text-foreground">
            {item.subject?.trim() || t('common.noSubject')}
          </h3>
          <div className="mt-1.5 space-y-0.5 text-[11px] text-muted-foreground">
            <p className="truncate">
              <span className="font-medium text-foreground/80">{t('mail.rightSidebar.contactPreviewFrom')}</span>{' '}
              {fromLabel}
            </p>
            <p className="truncate">
              <span className="font-medium text-foreground/80">{t('mail.rightSidebar.contactPreviewTo')}</span>{' '}
              {toLabel}
            </p>
            {whenLabel ? <p className="tabular-nums">{whenLabel}</p> : null}
          </div>
        </div>

        {shownAttachments.length > 0 ? (
          <div className="shrink-0 border-b border-border px-3 py-2">
            <div className="mb-1 flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
              <Paperclip className="h-3 w-3" aria-hidden />
              {t('mail.rightSidebar.contactPreviewAttachments', { count: attachments.length })}
            </div>
            <ul className="space-y-0.5">
              {shownAttachments.map((a) => {
                const Icon = mailFileRowIcon(a.contentType, a.name)
                return (
                  <li
                    key={a.id}
                    className="flex items-center gap-1.5 truncate text-[11px] text-foreground/90"
                    title={a.name}
                  >
                    <Icon className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="truncate">{a.name}</span>
                    {a.size != null ? (
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {formatBytes(a.size)}
                      </span>
                    ) : null}
                  </li>
                )
              })}
              {moreAttachments > 0 ? (
                <li className="text-[10px] text-muted-foreground">
                  {t('mail.rightSidebar.contactPreviewAttachmentsMore', { count: moreAttachments })}
                </li>
              ) : null}
            </ul>
          </div>
        ) : loading && item.hasAttachments ? (
          <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2 text-[11px] text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {t('mail.rightSidebar.contactPreviewLoadingAttachments')}
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
          {loading && !bodyHtml ? (
            <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('mail.rightSidebar.contactPreviewLoadingBody')}
            </div>
          ) : null}
          {error ? <p className="text-2xs text-destructive">{error}</p> : null}
          {bodyHtml ? (
            <div
              className="contact-history-preview-body text-foreground/90"
              // eslint-disable-next-line react/no-dangerously-set-inner-html -- sanitized mail HTML
              dangerouslySetInnerHTML={{ __html: bodyHtml }}
            />
          ) : !loading && !error ? (
            <p className="text-xs italic text-muted-foreground">
              {t('mail.readingPane.noContent')}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-0.5 border-t border-border px-2 py-1.5">
          <button
            type="button"
            className={iconBtnClass}
            title={
              item.isRead
                ? t('mail.rightSidebar.contactPreviewMarkUnread')
                : t('mail.rightSidebar.contactPreviewMarkRead')
            }
            onClick={(e): void => {
              e.stopPropagation()
              const next = !item.isRead
              void setMessageRead(item.id, next).then(() => {
                onMessageReadChanged?.(item.id, next)
              })
            }}
          >
            {item.isRead ? <Mail className="h-3.5 w-3.5" /> : <MailOpen className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            className={iconBtnClass}
            title={t('mail.rightSidebar.contactPreviewReply')}
            disabled={!message}
            onClick={(e): void => {
              e.stopPropagation()
              if (!message) return
              useComposeStore.getState().openReply('reply', message)
              onOpenMessage(message.id)
            }}
          >
            <Reply className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className={iconBtnClass}
            title={t('mail.rightSidebar.contactPreviewArchive')}
            onClick={(e): void => {
              e.stopPropagation()
              runAndRemove(() => archiveMessage(item.id))
            }}
          >
            <Archive className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className={iconBtnClass}
            title={t('mail.rightSidebar.contactPreviewDelete')}
            onClick={(e): void => {
              e.stopPropagation()
              runAndRemove(() => deleteMessage(item.id))
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className={iconBtnClass}
            title={t('mail.rightSidebar.contactPreviewOpen')}
            onClick={(e): void => {
              e.stopPropagation()
              onOpenMessage(item.id)
            }}
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
