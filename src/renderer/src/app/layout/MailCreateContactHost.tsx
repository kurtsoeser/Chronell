import { useAccountsStore } from '@/stores/accounts'
import {
  onContactCreatedFromMail,
  useCreateContactFromMailStore
} from '@/stores/create-contact-from-mail'
import { PeopleNewContactDialog } from '@/app/people/PeopleNewContactDialog'

/** Globaler Dialog: Absender aus Mail als Kontakt anlegen. */
export function MailCreateContactHost(): JSX.Element | null {
  const accounts = useAccountsStore((s) => s.accounts)
  const open = useCreateContactFromMailStore((s) => s.open)
  const draft = useCreateContactFromMailStore((s) => s.draft)
  const close = useCreateContactFromMailStore((s) => s.close)
  return (
    <PeopleNewContactDialog
      open={open}
      onClose={close}
      accounts={accounts}
      preferredAccountId={draft?.accountId ?? null}
      initialDraft={draft}
      onCreated={(contact): void => {
        onContactCreatedFromMail(contact.primaryEmail)
        close()
      }}
    />
  )
}
