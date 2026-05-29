import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronRight, CornerDownLeft, Loader2 } from 'lucide-react'
import type { MailCorrespondenceItem } from '@shared/types'
import type { ContactHistoryDateBucketLabels } from '@/lib/contact-history-date-bucket'
import { ContactHistoryHoverPreview } from '@/app/layout/mail-right-sidebar/ContactHistoryHoverPreview'
import {
  ContactSidebarVirtualList,
  type ContactVirtualRow
} from '@/app/layout/mail-right-sidebar/ContactSidebarVirtualList'
import { useContactHistoryHoverPreview } from '@/app/layout/mail-right-sidebar/use-contact-history-hover-preview'
import { contactHistoryBucketIcon } from '@/lib/contact-history-bucket-icon'
import { groupContactHistoryItems } from '@/lib/group-contact-history'
import {
  formatContactHistoryRowDate,
  isLikelyReplySubject
} from '@/lib/contact-history-date'
import { cn } from '@/lib/utils'
import { useMailStore } from '@/stores/mail'

const PAGE_SIZE = 100

interface Props {
  items: MailCorrespondenceItem[]
  total: number
  loading: boolean
  loadingMore: boolean
  correspondentDisplayName: string | null
  selectedMessageId: number | null
  onLoadMore: () => void
  onMessageRemoved?: (messageId: number) => void
  onMessageReadChanged?: (messageId: number, isRead: boolean) => void
}

export function ContactHistoryList({
  items,
  total,
  loading,
  loadingMore,
  correspondentDisplayName,
  selectedMessageId,
  onLoadMore,
  onMessageRemoved,
  onMessageReadChanged
}: Props): JSX.Element {
  const { t, i18n } = useTranslation()
  const locale = i18n.language.startsWith('de') ? 'de-DE' : 'en-GB'

  const bucketLabels = useMemo(
    (): ContactHistoryDateBucketLabels => ({
      unknown: t('mail.rightSidebar.contactBucketUnknown'),
      today: t('mail.rightSidebar.contactBucketToday'),
      yesterday: t('mail.rightSidebar.contactBucketYesterday'),
      lastWeek: t('mail.rightSidebar.contactBucketLastWeek'),
      thisMonth: t('mail.rightSidebar.contactBucketThisMonth'),
      older: t('mail.rightSidebar.contactBucketOlder')
    }),
    [t]
  )
  const selectMessageWithThreadPreview = useMailStore((s) => s.selectMessageWithThreadPreview)
  const youLabel = t('mail.rightSidebar.contactHistoryYou')

  const hasMore = items.length < total

  const {
    hover,
    onRowMouseEnter,
    onRowMouseLeave,
    onPanelMouseEnter,
    onPanelMouseLeave,
    dismiss
  } = useContactHistoryHoverPreview()

  const openMessage = useCallback(
    (messageId: number): void => {
      dismiss()
      void selectMessageWithThreadPreview(messageId)
    },
    [dismiss, selectMessageWithThreadPreview]
  )

  const groups = useMemo(
    () => groupContactHistoryItems(items, bucketLabels, locale),
    [items, bucketLabels, locale]
  )
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())

  const toggleGroup = useCallback((key: string): void => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const rowLabel = useCallback(
    (item: MailCorrespondenceItem): string => {
      if (item.isFromMe) return youLabel
      return correspondentDisplayName?.trim() || item.fromName?.trim() || t('mail.rightSidebar.contactTitle')
    },
    [correspondentDisplayName, t, youLabel]
  )

  const virtualRows = useMemo((): ContactVirtualRow<MailCorrespondenceItem>[] => {
    const out: ContactVirtualRow<MailCorrespondenceItem>[] = []
    for (const group of groups) {
      out.push({
        kind: 'header',
        key: `h:${group.key}`,
        label: group.label,
        bucketKey: group.key,
        count: group.items.length
      })
      if (!collapsed.has(group.key)) {
        for (const item of group.items) {
          out.push({ kind: 'item', key: `m:${item.id}`, data: item })
        }
      }
    }
    return out
  }, [groups, collapsed])

  if (loading && items.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center gap-2 p-6 text-2xs text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t('mail.rightSidebar.contactHistoryLoading')}
      </div>
    )
  }

  if (!loading && items.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-center text-2xs text-muted-foreground">
        {t('mail.rightSidebar.contactHistoryEmpty')}
      </div>
    )
  }

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="shrink-0 px-3 py-0.5 text-3xs tabular-nums text-muted-foreground">
          {t('mail.rightSidebar.contactHistoryCount', { shown: items.length, total })}
        </div>
        <ContactSidebarVirtualList
          rows={virtualRows}
          renderHeader={(row): JSX.Element => {
            const groupKey = row.key.replace(/^h:/, '')
            const isCollapsed = collapsed.has(groupKey)
            const BucketIcon = contactHistoryBucketIcon(row.bucketKey ?? groupKey)
            return (
              <button
                type="button"
                className="flex h-full w-full items-center gap-1 px-3 text-left text-2xs font-semibold text-muted-foreground hover:bg-secondary/40"
                onClick={(): void => toggleGroup(groupKey)}
                aria-expanded={!isCollapsed}
              >
                {isCollapsed ? (
                  <ChevronRight className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
                ) : (
                  <ChevronDown className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
                )}
                <BucketIcon className="h-3 w-3 shrink-0 text-primary/70" aria-hidden />
                <span className="min-w-0 truncate">{row.label}</span>
                {row.count != null ? (
                  <span className="ml-auto tabular-nums text-3xs font-normal opacity-70">
                    {row.count}
                  </span>
                ) : null}
              </button>
            )
          }}
          renderItem={(row): JSX.Element => {
            const item = row.data
            const active = item.id === selectedMessageId
            const when = formatContactHistoryRowDate(item.receivedAt ?? item.sentAt, locale)
            const reply = isLikelyReplySubject(item.subject)
            const unread = !item.isRead
            return (
              <button
                type="button"
                className={cn(
                  'flex h-full w-full items-start gap-1 border-l-2 border-transparent px-3 py-0.5 text-left transition-colors',
                  active ? 'border-primary bg-primary/10' : 'hover:bg-secondary/50',
                  unread && !active && 'bg-primary/[0.03]'
                )}
                onMouseEnter={(e): void => {
                  onRowMouseEnter(item, e.currentTarget)
                }}
                onMouseLeave={onRowMouseLeave}
                onClick={(): void => {
                  dismiss()
                  void selectMessageWithThreadPreview(item.id)
                }}
              >
                {unread ? (
                  <span
                    className="mt-0.5 h-1 w-1 shrink-0 rounded-full bg-primary"
                    aria-hidden
                  />
                ) : null}
                <span className="min-w-0 flex-1 leading-none">
                  <span className="flex items-center gap-0.5">
                    <span
                      className={cn(
                        'truncate text-2xs font-medium',
                        active ? 'text-foreground' : unread ? 'font-semibold text-foreground' : 'text-foreground/90'
                      )}
                    >
                      {rowLabel(item)}
                    </span>
                    {reply ? (
                      <CornerDownLeft
                        className="h-2.5 w-2.5 shrink-0 text-muted-foreground"
                        aria-hidden
                      />
                    ) : null}
                  </span>
                  <span
                    className={cn(
                      'mt-px line-clamp-1 text-3xs',
                      unread ? 'text-foreground/80' : 'text-muted-foreground'
                    )}
                  >
                    {item.subject?.trim() || t('common.noSubject')}
                  </span>
                </span>
                <span className="shrink-0 pt-px text-3xs tabular-nums text-muted-foreground">
                  {when}
                </span>
              </button>
            )
          }}
        />
        {hasMore ? (
          <div className="shrink-0 border-t border-border px-3 py-1.5">
            <button
              type="button"
              className="w-full rounded-md border border-border bg-background/60 py-1 text-3xs font-medium text-foreground hover:bg-secondary/60 disabled:opacity-60"
              disabled={loadingMore}
              onClick={onLoadMore}
            >
              {loadingMore ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {t('mail.rightSidebar.contactHistoryLoadingMore')}
                </span>
              ) : (
                t('mail.rightSidebar.contactHistoryLoadMore', { count: PAGE_SIZE })
              )}
            </button>
          </div>
        ) : null}
      </div>
      {hover ? (
        <ContactHistoryHoverPreview
          state={hover}
          correspondentDisplayName={correspondentDisplayName}
          youLabel={youLabel}
          onMouseEnter={onPanelMouseEnter}
          onMouseLeave={onPanelMouseLeave}
          onOpenMessage={openMessage}
          onMessageRemoved={onMessageRemoved}
          onMessageReadChanged={onMessageReadChanged}
        />
      ) : null}
    </>
  )
}
