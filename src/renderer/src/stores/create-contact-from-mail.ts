import { create } from 'zustand'
import { normalizeMailSenderEmail } from '@shared/mail-sender-email'
import type { MailListItem } from '@shared/types'
import { invalidateContactPhotoByEmailCache } from '@/lib/contact-photo-by-email'
import { useAppModeStore } from '@/stores/app-mode'
import { usePeoplePendingFocusStore } from '@/stores/people-pending-focus'

export type CreateContactFromMailDraft = {
  accountId: string
  displayName?: string | null
  primaryEmail?: string | null
}

interface CreateContactFromMailState {
  open: boolean
  draft: CreateContactFromMailDraft | null
  openFromMessage: (message: Pick<MailListItem, 'accountId' | 'fromName' | 'fromAddr'>) => void
  close: () => void
  openContactInPeople: (contactId: number) => void
}

function draftFromMessage(
  message: Pick<MailListItem, 'accountId' | 'fromName' | 'fromAddr'>
): CreateContactFromMailDraft {
  const email = normalizeMailSenderEmail(message.fromAddr)
  const name = message.fromName?.trim()
  return {
    accountId: message.accountId,
    displayName: name || null,
    primaryEmail: email
  }
}

export const useCreateContactFromMailStore = create<CreateContactFromMailState>((set) => ({
  open: false,
  draft: null,
  openFromMessage(message): void {
    set({ open: true, draft: draftFromMessage(message) })
  },
  close(): void {
    set({ open: false, draft: null })
  },
  openContactInPeople(contactId): void {
    usePeoplePendingFocusStore.getState().setPendingContactId(contactId)
    useAppModeStore.getState().setMode('people')
  }
}))

export function onContactCreatedFromMail(email: string | null | undefined): void {
  invalidateContactPhotoByEmailCache(email)
}
