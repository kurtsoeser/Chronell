import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronRight, ExternalLink, FolderOpen, Loader2 } from 'lucide-react'
import type { MailFileIndexRow } from '@shared/files'
import {
  persistFilesShellAccountFilter,
  persistFilesShellContactEmails,
  persistFilesShellSource
} from '@/app/files/files-shell-storage'
import {
  ContactSidebarVirtualList,
  type ContactVirtualRow
} from '@/app/layout/mail-right-sidebar/ContactSidebarVirtualList'
import { formatContactHistoryRowDate } from '@/lib/contact-history-date'
import { formatBytes } from '@/lib/format-bytes'
import { dateBucketFor } from '@/lib/mail-list-arrange'
import { mailFileRowIcon } from '@/lib/mail-file-display'
import { cn } from '@/lib/utils'
import { useAppModeStore } from '@/stores/app-mode'
import { useMailStore } from '@/stores/mail'

const PAGE_SIZE = 80

interface Props {
  contactEmails: string[]
  accountIds: string[]
  excludeDeletedJunk: boolean
  selectedMessageId: number | null
}

export function ContactAttachmentsList({
  contactEmails,
  accountIds,
  excludeDeletedJunk,
  selectedMessageId
}: Props): JSX.Element {
  const { t, i18n } = useTranslation()
  const locale = i18n.language.startsWith('de') ? 'de-DE' : 'en-GB'
  const setAppMode = useAppModeStore((s) => s.setMode)
  const selectMessageWithThreadPreview = useMailStore((s) => s.selectMessageWithThreadPreview)

  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [rows, setRows] = useState<MailFileIndexRow[]>([])
  const [total, setTotal] = useState(0)
  const [busyFileId, setBusyFileId] = useState<number | null>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())

  const primaryEmail = contactEmails[0] ?? ''
  const hasMore = rows.length < total

  const load = useCallback(
    async (offset: number, append: boolean): Promise<void> => {
      if (contactEmails.length === 0 || accountIds.length === 0) {
        setRows([])
        setTotal(0)
        return
      }
      if (append) setLoadingMore(true)
      else setLoading(true)
      setErr(null)
      try {
        const result = await window.mailClient.files.listMail({
          accountIds,
          contactEmail: primaryEmail,
          contactEmails,
          excludeDeletedJunk,
          sortBy: 'receivedAt',
          sortDir: 'desc',
          limit: PAGE_SIZE,
          offset
        })
        setTotal(result.total)
        setRows((prev) => (append ? [...prev, ...result.rows] : result.rows))
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e))
        if (!append) {
          setRows([])
          setTotal(0)
        }
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [accountIds, contactEmails, excludeDeletedJunk, primaryEmail]
  )

  useEffect(() => {
    void load(0, false)
  }, [load])

  useEffect(() => {
    const off = window.mailClient.events.onMailChanged(() => {
      void load(0, false)
    })
    return off
  }, [load])

  const openInFilesModule = useCallback((): void => {
    persistFilesShellSource('mail')
    persistFilesShellContactEmails(contactEmails)
    persistFilesShellAccountFilter(accountIds.length === 1 ? [accountIds[0]!] : accountIds)
    setAppMode('files')
  }, [accountIds, primaryEmail, setAppMode])

  const openAttachment = useCallback(async (fileId: number): Promise<void> => {
    setBusyFileId(fileId)
    try {
      const res = await window.mailClient.files.openMailAttachment({ fileId })
      if (!res.ok && res.error) console.warn('[contact-attachments] open failed', res.error)
    } finally {
      setBusyFileId(null)
    }
  }, [])

  const toggleGroup = useCallback((key: string): void => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const groups = useMemo(() => {
    const buckets = new Map<string, { key: string; label: string; items: MailFileIndexRow[] }>()
    for (const row of rows) {
      const { key, label } = dateBucketFor(row.receivedAt)
      const existing = buckets.get(key)
      if (existing) existing.items.push(row)
      else buckets.set(key, { key, label, items: [row] })
    }
    return [...buckets.values()]
  }, [rows])

  const virtualRows = useMemo((): ContactVirtualRow<MailFileIndexRow>[] => {
    const out: ContactVirtualRow<MailFileIndexRow>[] = []
    for (const group of groups) {
      out.push({
        kind: 'header',
        key: `h:${group.key}`,
        label: group.label,
        count: group.items.length
      })
      if (!collapsed.has(group.key)) {
        for (const row of group.items) {
          out.push({ kind: 'item', key: `f:${row.id}`, data: row })
        }
      }
    }
    return out
  }, [groups, collapsed])

  if (loading && rows.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center gap-2 p-6 text-2xs text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t('mail.rightSidebar.contactAttachmentsLoading')}
      </div>
    )
  }

  if (!loading && rows.length === 0) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex flex-1 items-center justify-center p-6 text-center text-2xs text-muted-foreground">
          {t('mail.rightSidebar.contactAttachmentsEmpty')}
        </div>
        <div className="shrink-0 border-t border-border px-3 py-2">
          <button
            type="button"
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-border bg-background/60 py-1.5 text-2xs font-medium text-foreground hover:bg-secondary/60"
            onClick={openInFilesModule}
          >
            <FolderOpen className="h-3.5 w-3.5" />
            {t('mail.rightSidebar.contactAttachmentsOpenFiles')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {err ? <p className="shrink-0 px-3 py-1 text-2xs text-destructive">{err}</p> : null}
      <div className="shrink-0 px-3 py-0.5 text-3xs tabular-nums text-muted-foreground">
        {t('mail.rightSidebar.contactAttachmentsCount', { shown: rows.length, total })}
      </div>
      <ContactSidebarVirtualList
        rows={virtualRows}
        renderHeader={(row): JSX.Element => {
          const groupKey = row.key.replace(/^h:/, '')
          const isCollapsed = collapsed.has(groupKey)
          return (
            <button
              type="button"
              className="flex h-full w-full items-center gap-0.5 px-3 text-left text-2xs font-semibold text-muted-foreground hover:bg-secondary/40"
              onClick={(): void => toggleGroup(groupKey)}
              aria-expanded={!isCollapsed}
            >
              {isCollapsed ? (
                <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
              )}
              <span className="truncate">{row.label}</span>
            </button>
          )
        }}
        renderItem={(row): JSX.Element => {
          const file = row.data
          const Icon = mailFileRowIcon(file.mime, file.name)
          const when = formatContactHistoryRowDate(file.receivedAt, locale)
          const mailActive = file.messageId === selectedMessageId
          const busy = busyFileId === file.id
          return (
            <div
              className={cn(
                'flex h-full items-start gap-1.5 border-l-2 border-transparent px-3 py-1',
                mailActive ? 'border-primary bg-primary/10' : 'hover:bg-secondary/40'
              )}
            >
              <button
                type="button"
                className="flex min-w-0 flex-1 items-start gap-2 text-left"
                disabled={busy}
                onClick={(): void => {
                  void openAttachment(file.id)
                }}
                title={t('mail.rightSidebar.contactAttachmentsOpenFile')}
              >
                {busy ? (
                  <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
                ) : (
                  <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-1 text-2xs font-medium leading-tight text-foreground">
                    {file.name}
                  </span>
                  <span className="line-clamp-1 text-3xs text-muted-foreground">
                    {file.subject?.trim() || t('common.noSubject')}
                  </span>
                  <span className="text-3xs text-muted-foreground">
                    {file.size != null ? formatBytes(file.size) : ''}
                    {file.size != null && when ? ' · ' : ''}
                    {when}
                  </span>
                </span>
              </button>
              <button
                type="button"
                className="shrink-0 rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                title={t('mail.rightSidebar.contactAttachmentsOpenMail')}
                onClick={(): void => {
                  void selectMessageWithThreadPreview(file.messageId)
                }}
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </button>
            </div>
          )
        }}
      />
      {hasMore ? (
        <div className="shrink-0 border-t border-border px-3 py-2">
          <button
            type="button"
            className="w-full rounded-md border border-border bg-background/60 py-1.5 text-2xs font-medium text-foreground hover:bg-secondary/60 disabled:opacity-60"
            disabled={loadingMore}
            onClick={(): void => {
              void load(rows.length, true)
            }}
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
      <div className="shrink-0 border-t border-border px-3 py-2">
        <button
          type="button"
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-border bg-background/60 py-1.5 text-2xs font-medium text-foreground hover:bg-secondary/60"
          onClick={openInFilesModule}
        >
          <FolderOpen className="h-3.5 w-3.5" />
          {t('mail.rightSidebar.contactAttachmentsOpenFiles')}
        </button>
      </div>
    </div>
  )
}
