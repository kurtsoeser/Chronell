import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ExternalLink, Loader2 } from 'lucide-react'
import type { MailCorrespondenceItem, PeopleContactView } from '@shared/types'
import { resolveCorrespondentFromMessage } from '@shared/mail-correspondent'
import { resolveCorrespondenceEmailSet } from '@shared/mail-participants'
import { ContactCorrespondenceSettingsMenu } from '@/app/layout/mail-right-sidebar/ContactCorrespondenceSettingsMenu'
import {
  readContactCorrespondenceSettings,
  type ContactCorrespondenceSettings
} from '@/app/layout/mail-right-sidebar/contact-correspondence-settings'
import { chronellMailContactPanelClass } from '@/lib/chronell-ui-classes'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/Avatar'
import { FilterTabs } from '@/components/FilterTabs'
import { ConnectionsObjectPreview } from '@/app/connections/ConnectionsObjectPreview'
import { EntityContextBlock } from '@/components/connections/EntityContextBlock'
import { clearContactHistoryPreviewCache } from '@/app/layout/mail-right-sidebar/contact-history-preview-cache'
import { ContactAttachmentsList } from '@/app/layout/mail-right-sidebar/ContactAttachmentsList'
import { ContactHistoryList } from '@/app/layout/mail-right-sidebar/ContactHistoryList'
import { ContactRelatedStrip } from '@/app/layout/mail-right-sidebar/ContactRelatedStrip'
import { findContactByEmail } from '@/lib/contact-photo-by-email'
import { useSenderAvatarSources } from '@/lib/use-sender-avatar-sources'
import { useAccountsStore } from '@/stores/accounts'
import { useMailStore } from '@/stores/mail'
import { usePeoplePendingFocusStore } from '@/stores/people-pending-focus'
import { useAppModeStore } from '@/stores/app-mode'

const HISTORY_PAGE = 100

type ContactSidebarTab = 'history' | 'attachments' | 'details'

export function MailContactDetailsSidebar(): JSX.Element {
  const { t } = useTranslation()
  const selectedMessage = useMailStore((s) => s.selectedMessage)
  const selectedMessageId = useMailStore((s) => s.selectedMessageId)
  const foldersByAccount = useMailStore((s) => s.foldersByAccount)
  const accounts = useAccountsStore((s) => s.accounts)
  const setAppMode = useAppModeStore((s) => s.setMode)

  const [tab, setTab] = useState<ContactSidebarTab>('history')
  const [contactLoading, setContactLoading] = useState(false)
  const [contactErr, setContactErr] = useState<string | null>(null)
  const [contact, setContact] = useState<PeopleContactView | null>(null)

  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyLoadingMore, setHistoryLoadingMore] = useState(false)
  const [historyErr, setHistoryErr] = useState<string | null>(null)
  const [historyItems, setHistoryItems] = useState<MailCorrespondenceItem[]>([])
  const [historyTotal, setHistoryTotal] = useState(0)
  const [correspondenceSettings, setCorrespondenceSettings] = useState(
    readContactCorrespondenceSettings
  )

  const account = useMemo(
    () => accounts.find((a) => a.id === selectedMessage?.accountId) ?? null,
    [accounts, selectedMessage?.accountId]
  )

  const folderWellKnown = useMemo(() => {
    if (!selectedMessage?.folderId) return null
    const folders = foldersByAccount[selectedMessage.accountId] ?? []
    return folders.find((f) => f.id === selectedMessage.folderId)?.wellKnown ?? null
  }, [foldersByAccount, selectedMessage?.accountId, selectedMessage?.folderId])

  const correspondent = useMemo(() => {
    if (!selectedMessage) return null
    return resolveCorrespondentFromMessage({
      fromAddr: selectedMessage.fromAddr,
      fromName: selectedMessage.fromName,
      toAddrs: selectedMessage.toAddrs,
      ccAddrs: selectedMessage.ccAddrs,
      accountEmail: account?.email ?? null,
      folderWellKnown
    })
  }, [selectedMessage, account?.email, folderWellKnown])

  const correspondentEmail = correspondent?.email ?? null
  const correspondentAccountId = selectedMessage?.accountId ?? null

  const correspondenceEmails = useMemo(() => {
    if (!correspondentEmail) return []
    return resolveCorrespondenceEmailSet(
      correspondentEmail,
      contact?.emailsJson,
      correspondenceSettings.includeContactAliases
    )
  }, [
    correspondentEmail,
    contact?.emailsJson,
    correspondenceSettings.includeContactAliases
  ])

  const queryAccountIds = useMemo((): string[] => {
    if (correspondenceSettings.accountScope === 'all_accounts') {
      return accounts.map((a) => a.id)
    }
    return correspondentAccountId ? [correspondentAccountId] : []
  }, [accounts, correspondenceSettings.accountScope, correspondentAccountId])

  const headerName = useMemo(() => {
    if (contact?.displayName?.trim()) return contact.displayName.trim()
    if (correspondent?.displayName?.trim()) return correspondent.displayName.trim()
    if (selectedMessage?.fromName?.trim() && !selectedMessage.fromAddr?.includes(correspondentEmail ?? '')) {
      return selectedMessage.fromName.trim()
    }
    return correspondentEmail ?? t('mail.rightSidebar.contactTitle')
  }, [contact, correspondent, selectedMessage, correspondentEmail, t])

  const {
    imageSrc: avatarSrc,
    useGravatar,
    useDomainAvatar
  } = useSenderAvatarSources(correspondentEmail, correspondentAccountId)

  useEffect(() => {
    let cancelled = false
    setContactErr(null)
    setContact(null)
    if (!correspondentEmail) return
    setContactLoading(true)
    void findContactByEmail(correspondentEmail, correspondentAccountId)
      .then((c) => {
        if (!cancelled) setContact(c)
      })
      .catch((e) => {
        if (!cancelled) setContactErr(e instanceof Error ? e.message : String(e))
      })
      .finally(() => {
        if (!cancelled) setContactLoading(false)
      })
    return (): void => {
      cancelled = true
    }
  }, [correspondentEmail, correspondentAccountId])

  const loadHistory = useCallback(
    async (offset: number, append: boolean): Promise<void> => {
      if (!correspondentEmail || queryAccountIds.length === 0) {
        setHistoryItems([])
        setHistoryTotal(0)
        return
      }
      if (append) setHistoryLoadingMore(true)
      else setHistoryLoading(true)
      setHistoryErr(null)
      try {
        const result = await window.mailClient.mail.listCorrespondence({
          email: correspondentEmail,
          emails: correspondenceEmails,
          accountIds: queryAccountIds,
          excludeDeletedJunk: !correspondenceSettings.includeDeletedJunk,
          limit: HISTORY_PAGE,
          offset
        })
        setHistoryTotal(result.total)
        setHistoryItems((prev) => (append ? [...prev, ...result.items] : result.items))
      } catch (e) {
        setHistoryErr(e instanceof Error ? e.message : String(e))
        if (!append) {
          setHistoryItems([])
          setHistoryTotal(0)
        }
      } finally {
        setHistoryLoading(false)
        setHistoryLoadingMore(false)
      }
    },
    [
      correspondentEmail,
      correspondenceEmails,
      queryAccountIds,
      correspondenceSettings.includeDeletedJunk
    ]
  )

  useEffect(() => {
    void loadHistory(0, false)
  }, [loadHistory])

  useEffect(() => {
    clearContactHistoryPreviewCache()
  }, [correspondentEmail, correspondenceEmails, queryAccountIds, correspondenceSettings])

  const tabOptions = useMemo(() => {
    const opts: Array<{ id: ContactSidebarTab; label: string }> = [
      { id: 'history', label: t('mail.rightSidebar.contactTabHistory') },
      { id: 'attachments', label: t('mail.rightSidebar.contactTabAttachments') }
    ]
    if (contact) {
      opts.push({ id: 'details', label: t('mail.rightSidebar.contactTabDetails') })
    }
    return opts
  }, [contact, t])

  useEffect(() => {
    if (tab === 'details' && !contact) setTab('history')
  }, [tab, contact])

  useEffect(() => {
    setTab('history')
  }, [correspondentEmail])

  const historyUnreadCount = useMemo(
    () => historyItems.filter((m) => !m.isRead).length,
    [historyItems]
  )

  const onHistoryMessageRemoved = useCallback((messageId: number): void => {
    setHistoryItems((prev) => prev.filter((m) => m.id !== messageId))
    setHistoryTotal((t) => Math.max(0, t - 1))
    clearContactHistoryPreviewCache()
  }, [])

  const onHistoryMessageReadChanged = useCallback((messageId: number, isRead: boolean): void => {
    setHistoryItems((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, isRead } : m))
    )
  }, [])

  if (!selectedMessage) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center p-6 text-center text-2xs text-muted-foreground">
        {t('mail.rightSidebar.contactNoSelection')}
      </div>
    )
  }

  if (!correspondentEmail) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center p-6 text-center text-2xs text-muted-foreground">
        {t('mail.rightSidebar.contactNoCorrespondent')}
      </div>
    )
  }

  return (
    <div className={cn('flex h-full min-h-0 flex-col overflow-hidden', chronellMailContactPanelClass)}>
      <div className="shrink-0 border-b border-border px-3 py-2">
        <div className="flex items-start gap-2">
          <Avatar
            name={headerName}
            email={correspondentEmail}
            accountColor={account?.color}
            imageSrc={avatarSrc}
            useGravatar={useGravatar}
            useDomainAvatar={useDomainAvatar}
            size="sm"
            className="mt-px shrink-0"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <div className="truncate text-2xs font-semibold text-foreground">{headerName}</div>
              {historyUnreadCount > 0 ? (
                <span
                  className="shrink-0 rounded-full bg-primary px-1 py-px text-3xs font-semibold tabular-nums text-primary-foreground"
                  title={t('mail.rightSidebar.contactUnreadBadge', { count: historyUnreadCount })}
                >
                  {historyUnreadCount > 99 ? '99+' : historyUnreadCount}
                </span>
              ) : null}
            </div>
            <div className="truncate text-3xs text-muted-foreground">{correspondentEmail}</div>
            {contactLoading ? (
              <div className="mt-1 inline-flex items-center gap-1.5 text-2xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                {t('mail.rightSidebar.contactLoading')}
              </div>
            ) : null}
            {contactErr ? <p className="mt-1 text-2xs text-destructive">{contactErr}</p> : null}
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <ContactCorrespondenceSettingsMenu
              settings={correspondenceSettings}
              onChange={(next: ContactCorrespondenceSettings): void => {
                setCorrespondenceSettings(next)
              }}
              hasContactAliases={Boolean(contact?.emailsJson?.trim())}
            />
            {contact ? (
              <button
                type="button"
                className={cn(
                  'inline-flex h-6 w-6 items-center justify-center rounded-md border border-border bg-background/60',
                  'text-foreground hover:bg-secondary/60'
                )}
                onClick={(): void => {
                  usePeoplePendingFocusStore.getState().setPendingContactId(contact.id)
                  setAppMode('people')
                }}
                title={t('mail.rightSidebar.openContact')}
              >
                <ExternalLink className="h-3 w-3" />
              </button>
            ) : null}
          </div>
        </div>
        <FilterTabs
          className="mt-1.5"
          size="compact"
          value={tab}
          options={tabOptions}
          onChange={setTab}
          ariaLabel={t('mail.rightSidebar.contactTabsAria')}
        />
        <ContactRelatedStrip contactEmails={correspondenceEmails} />
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {tab === 'history' ? (
          <>
            {historyErr ? (
              <p className="shrink-0 px-3 py-1 text-2xs text-destructive">{historyErr}</p>
            ) : null}
            <ContactHistoryList
              items={historyItems}
              total={historyTotal}
              loading={historyLoading}
              loadingMore={historyLoadingMore}
              correspondentDisplayName={correspondent?.displayName ?? contact?.displayName ?? null}
              selectedMessageId={selectedMessageId}
              onLoadMore={(): void => {
                void loadHistory(historyItems.length, true)
              }}
              onMessageRemoved={onHistoryMessageRemoved}
              onMessageReadChanged={onHistoryMessageReadChanged}
            />
          </>
        ) : tab === 'attachments' && correspondentEmail && queryAccountIds.length > 0 ? (
          <ContactAttachmentsList
            contactEmails={correspondenceEmails}
            accountIds={queryAccountIds}
            excludeDeletedJunk={!correspondenceSettings.includeDeletedJunk}
            selectedMessageId={selectedMessageId}
          />
        ) : contact ? (
          <div className="flex h-full min-h-0 flex-col overflow-hidden">
            <div className="min-h-0 flex-1 overflow-hidden">
              <ConnectionsObjectPreview
                entityRef={{ kind: 'people_contact', contactId: contact.id }}
                accounts={accounts}
              />
            </div>
            <div className="border-t border-border">
              <EntityContextBlock
                anchor={{ kind: 'people_contact', contactId: contact.id }}
                noteTarget={{
                  kind: 'people_contact',
                  contactId: contact.id,
                  title:
                    contact.displayName?.trim() ||
                    contact.primaryEmail?.trim() ||
                    t('mail.rightSidebar.contactTitle')
                }}
                sectionCollapsedDefault={false}
                contentPaddingClass="px-3"
                className="min-h-0"
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
