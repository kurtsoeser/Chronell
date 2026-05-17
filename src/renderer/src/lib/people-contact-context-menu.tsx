import { Copy, Mail, Pencil, Star, Trash2 } from 'lucide-react'
import type { TFunction } from 'i18next'
import type { PeopleContactView, PeopleListSort } from '@shared/types'
import type { ContextMenuItem } from '@/components/ContextMenu'
import { peopleListPrimaryLabel } from '@/app/people/people-display-label'
import {
  formatAddressLines,
  parseAddressesJson,
  parseEmailsJson,
  parsePhonesJson
} from '@/app/people/people-contact-json'

export function formatPeopleContactClipboardText(
  contact: PeopleContactView,
  displayName: string,
  sortBy: PeopleListSort,
  t: TFunction
): string {
  const lines: string[] = [displayName]

  const pushField = (label: string, value: string | null | undefined): void => {
    const v = value?.trim()
    if (v) lines.push(`${label}: ${v}`)
  }

  pushField(t('people.shell.fieldDisplayName'), contact.displayName)
  pushField(t('people.shell.fieldGivenName'), contact.givenName)
  pushField(t('people.shell.fieldSurname'), contact.surname)
  pushField(t('people.shell.email'), contact.primaryEmail)

  const extraEmails = parseEmailsJson(contact.emailsJson).filter((e) => {
    const primary = contact.primaryEmail?.trim().toLowerCase()
    if (!primary) return true
    return e.address.toLowerCase() !== primary
  })
  for (const e of extraEmails) {
    const line = e.name ? `${e.name} <${e.address}>` : e.address
    lines.push(`${t('people.shell.email')}: ${line}`)
  }

  for (const p of parsePhonesJson(contact.phonesJson)) {
    lines.push(`${t('people.shell.phone')} (${p.type}): ${p.value}`)
  }

  pushField(t('people.shell.company'), contact.company)
  pushField(t('people.shell.jobTitle'), contact.jobTitle)
  pushField(t('people.shell.fieldDepartment'), contact.department)
  pushField(t('people.shell.fieldOffice'), contact.officeLocation)
  pushField(t('people.shell.fieldBirthday'), contact.birthdayIso)
  pushField(t('people.shell.fieldWeb'), contact.webPage)

  for (const addr of parseAddressesJson(contact.addressesJson)) {
    const addrLines = formatAddressLines(addr)
    if (addrLines.length === 0) continue
    lines.push(`${t('people.shell.fieldAddress')} (${addr.type}): ${addrLines.join(', ')}`)
  }

  pushField(t('people.shell.notes'), contact.notes)

  const label = peopleListPrimaryLabel(contact, sortBy)
  if (lines.length === 1 && lines[0] === label) {
    return label
  }

  return lines.join('\n')
}

export interface PeopleContactContextHandlers {
  t: TFunction
  contact: PeopleContactView
  sortBy: PeopleListSort
  onEdit: (contact: PeopleContactView) => void | Promise<void>
  onEmail: (contact: PeopleContactView) => void
  onToggleFavorite: (contact: PeopleContactView) => void | Promise<void>
  onCopyName: (contact: PeopleContactView) => void | Promise<void>
  onCopyEmail: (contact: PeopleContactView) => void | Promise<void>
  onCopyDetails: (contact: PeopleContactView) => void | Promise<void>
  onDelete: (contact: PeopleContactView) => void | Promise<void>
}

export function buildPeopleContactContextMenuItems(h: PeopleContactContextHandlers): ContextMenuItem[] {
  const { t, contact, sortBy } = h
  const displayName = peopleListPrimaryLabel(contact, sortBy)
  const hasEmail = Boolean(contact.primaryEmail?.trim())

  const copySubmenu: ContextMenuItem[] = [
    {
      id: 'people-contact-copy-name',
      label: t('people.contactContextMenu.copyName'),
      onSelect: (): void => void h.onCopyName(contact)
    },
    {
      id: 'people-contact-copy-email',
      label: t('people.contactContextMenu.copyEmail'),
      disabled: !hasEmail,
      onSelect: (): void => void h.onCopyEmail(contact)
    },
    {
      id: 'people-contact-copy-details',
      label: t('people.contactContextMenu.copyDetails'),
      onSelect: (): void => void h.onCopyDetails(contact)
    }
  ]

  return [
    {
      id: 'people-contact-edit',
      label: t('people.shell.edit'),
      icon: Pencil,
      onSelect: (): void => void h.onEdit(contact)
    },
    {
      id: 'people-contact-email',
      label: t('people.shell.emailAction'),
      icon: Mail,
      disabled: !hasEmail,
      onSelect: (): void => h.onEmail(contact)
    },
    {
      id: 'people-contact-favorite',
      label: contact.isFavorite ? t('people.shell.unfavorite') : t('people.shell.favorite'),
      icon: Star,
      iconClassName: contact.isFavorite ? 'fill-amber-400 text-amber-400' : undefined,
      onSelect: (): void => void h.onToggleFavorite(contact)
    },
    { id: 'people-contact-sep-1', label: '', separator: true },
    {
      id: 'people-contact-copy',
      label: t('people.contactContextMenu.copy'),
      icon: Copy,
      submenu: copySubmenu
    },
    { id: 'people-contact-sep-2', label: '', separator: true },
    {
      id: 'people-contact-delete',
      label: t('people.shell.deleteContact'),
      icon: Trash2,
      destructive: true,
      onSelect: (): void => void h.onDelete(contact)
    }
  ]
}
