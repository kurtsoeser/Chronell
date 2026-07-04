import type { PeopleContactView } from '@shared/types'

function contactDisplayName(
  contact: PeopleContactView,
  untitledLabel: string
): string {
  return (
    contact.displayName?.trim() ||
    [contact.givenName, contact.surname].filter(Boolean).join(' ').trim() ||
    contact.primaryEmail?.trim() ||
    untitledLabel
  )
}

function normalizeLookupText(value: string): string {
  return value.trim().toLowerCase()
}

export async function resolvePeopleContactForPreview(
  contactId: number,
  hints?: { label?: string; subtitle?: string | null; untitledLabel?: string }
): Promise<PeopleContactView | null> {
  const untitledLabel = hints?.untitledLabel ?? 'Kontakt'

  const byId = await window.mailClient.people.getById(contactId)
  if (byId) return byId

  const subtitle = hints?.subtitle?.trim()
  if (subtitle && subtitle.includes('@')) {
    const byEmail = await window.mailClient.people.findByEmail({ email: subtitle })
    if (byEmail) return byEmail
  }

  const label = hints?.label?.trim()
  if (!label) return null

  const candidates = await window.mailClient.people.list({
    filter: 'all',
    query: label,
    limit: 16
  })
  if (candidates.length === 0) return null

  const needle = normalizeLookupText(label)
  return (
    candidates.find((c) => normalizeLookupText(contactDisplayName(c, untitledLabel)) === needle) ??
    candidates.find((c) =>
      normalizeLookupText(contactDisplayName(c, untitledLabel)).includes(needle)
    ) ??
    null
  )
}
