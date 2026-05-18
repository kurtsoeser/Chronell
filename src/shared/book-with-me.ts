/** Outlook Web — persoenliche Book-with-me-Seite verwalten. */
export const BOOK_WITH_ME_MANAGE_URL = 'https://outlook.office.com/bookwithme/'

/** Normalisiert eine gespeicherte Buchungs-URL oder gibt null bei leerem Input. */
export function normalizeBookWithMeUrl(raw: string | null | undefined): string | null {
  const trimmed = typeof raw === 'string' ? raw.trim() : ''
  if (!trimmed) return null
  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    throw new Error('Ungueltige URL.')
  }
  if (url.protocol !== 'https:') {
    throw new Error('Die Buchungsseite muss mit https:// beginnen.')
  }
  return url.toString()
}

export function isBookWithMeHost(hostname: string): boolean {
  const h = hostname.toLowerCase()
  return h === 'outlook.office.com' || h === 'outlook.office365.com' || h.endsWith('.office.com')
}
