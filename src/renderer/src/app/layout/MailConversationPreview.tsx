import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Avatar } from '@/components/Avatar'
import { useSenderAvatarSources } from '@/lib/use-sender-avatar-sources'
import {
  mailConversationMessageTileClass,
  mailConversationStackClass
} from '@/lib/chronell-ui-classes'
import { cn } from '@/lib/utils'
import type { ConnectedAccount, MailFolder, MailFull, MailListItem } from '@shared/types'
import { wellKnownFolderTitle } from '@shared/well-known-folder-title'

function conversationFolderLabel(
  folder: MailFolder | undefined,
  t: (key: string) => string
): string {
  if (!folder) return ''
  return wellKnownFolderTitle(folder.wellKnown, folder.name, t, 'conversationPreview')
}

function MailConversationCollapsed({
  message,
  account,
  folder,
  profilePhotoDataUrls,
  accounts
}: {
  message: MailListItem
  account: ConnectedAccount | null
  folder: MailFolder | undefined
  profilePhotoDataUrls: Record<string, string | undefined>
  accounts: ConnectedAccount[]
}): JSX.Element {
  const { t, i18n } = useTranslation()
  const locale = i18n.language.startsWith('de') ? 'de-DE' : 'en-GB'
  const sent = message.receivedAt || message.sentAt
  const dateLabel = sent
    ? new Date(sent).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })
    : ''
  const from = message.fromName?.trim() || message.fromAddr?.trim() || t('common.unknown')
  const folderLabel = conversationFolderLabel(folder, t)
  const { imageSrc: photo, useGravatar, useDomainAvatar } = useSenderAvatarSources(
    message.fromAddr,
    message.accountId
  )

  return (
    <div
      className="px-4 py-3"
      aria-label={t('mail.conversationPreview.collapsedAria', { from, date: dateLabel })}
    >
      <div className="flex items-start gap-3">
        <Avatar
          name={message.fromName}
          email={message.fromAddr}
          accountColor={account?.color}
          imageSrc={photo}
          useGravatar={useGravatar}
          useDomainAvatar={useDomainAvatar}
          size="md"
          className="mt-0.5 shrink-0"
        />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
            <span className="truncate text-sm font-medium text-foreground">{from}</span>
            <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{dateLabel}</span>
          </div>
          {folderLabel ? (
            <span className="inline-flex max-w-full truncate rounded-md bg-muted/80 px-1.5 py-px text-[10px] font-medium text-muted-foreground">
              {folderLabel}
            </span>
          ) : null}
          {message.snippet ? (
            <p className="line-clamp-2 text-xs leading-snug text-muted-foreground">{message.snippet}</p>
          ) : (
            <p className="text-xs italic text-muted-foreground/80">
              {t('mail.conversationPreview.collapsedNoSnippet')}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export function MailConversationPreview({
  messages,
  selectedMessageId,
  selectedMessage,
  account,
  accounts,
  profilePhotoDataUrls,
  foldersByAccount,
  onSelectMessage,
  children
}: {
  messages: MailListItem[]
  selectedMessageId: number
  selectedMessage: MailFull
  account: ConnectedAccount | null
  accounts: ConnectedAccount[]
  profilePhotoDataUrls: Record<string, string | undefined>
  foldersByAccount: Record<string, MailFolder[]>
  onSelectMessage: (messageId: number) => void
  children: (expandedMessage: MailFull) => JSX.Element
}): JSX.Element {
  const expandedRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    expandedRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [selectedMessageId])

  return (
    <div className={cn(mailConversationStackClass, 'min-h-0 flex-1 overflow-y-auto')}>
      {messages.map((item) => {
        const isExpanded = item.id === selectedMessageId
        const folders = foldersByAccount[item.accountId] ?? []
        const folder = folders.find((f) => f.id === item.folderId)
        const itemAccount = accounts.find((a) => a.id === item.accountId) ?? account

        return (
          <div
            key={item.id}
            ref={isExpanded ? expandedRef : undefined}
            className={cn(
              mailConversationMessageTileClass,
              'shrink-0',
              isExpanded && 'border-primary/30 ring-1 ring-primary/15 dark:border-primary/25'
            )}
          >
            {isExpanded ? (
              children(selectedMessage)
            ) : (
              <button
                type="button"
                className={cn(
                  'w-full cursor-pointer text-left transition-colors',
                  'hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-inset'
                )}
                onClick={(): void => onSelectMessage(item.id)}
              >
                <MailConversationCollapsed
                  message={item}
                  account={itemAccount}
                  folder={folder}
                  profilePhotoDataUrls={profilePhotoDataUrls}
                  accounts={accounts}
                />
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
