import type { TFunction } from 'i18next'
import { User, UserPlus } from 'lucide-react'
import type { MailFull, MailListItem } from '@shared/types'
import type { ContextMenuItem } from '@/components/ContextMenu'

export function buildMailSenderContextItems(
  message: Pick<MailListItem, 'accountId' | 'fromName' | 'fromAddr'>,
  senderContactId: number | null,
  handlers: {
    onCreateContact: () => void
    onOpenContact: (contactId: number) => void
  },
  t?: TFunction
): ContextMenuItem[] {
  if (!message.fromAddr?.trim()) return []

  if (senderContactId != null) {
    return [
      {
        id: 'open-sender-contact',
        label: t?.('mail.contextMenu.openSenderContact') ?? 'Kontakt öffnen',
        icon: User,
        onSelect: (): void => handlers.onOpenContact(senderContactId)
      }
    ]
  }

  return [
    {
      id: 'create-sender-contact',
      label: t?.('mail.contextMenu.createSenderContact') ?? 'Absender als Kontakt speichern',
      icon: UserPlus,
      onSelect: handlers.onCreateContact
    }
  ]
}

export type MailSenderContextMessage = Pick<MailFull, 'accountId' | 'fromName' | 'fromAddr'>
