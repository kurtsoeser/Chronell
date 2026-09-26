/** Custom Domain der veroeffentlichten #kurtrocks Notion-Site. */
export const KURTROCKS_PUBLIC_SITE_ORIGIN = 'https://www.kurtrocks.com'

/**
 * Notion `public_url` → www.kurtrocks.com/… (Custom Domain).
 * Kein Fallback auf Property „Veranstaltungslink“ (z. B. ph-online).
 */
export function toKurtrocksPublicSiteUrl(publicUrl: string | null | undefined): string | null {
  const raw = publicUrl?.trim()
  if (!raw) return null
  try {
    const u = new URL(raw.startsWith('http') ? raw : `https://${raw}`)
    const host = u.hostname.replace(/^www\./i, '').toLowerCase()
    if (host === 'kurtrocks.com') {
      u.protocol = 'https:'
      u.hostname = 'www.kurtrocks.com'
      return u.toString()
    }
    // Notion Sites / Workspace-URL → gleicher Pfad unter Custom Domain
    if (
      host === 'notion.site' ||
      host.endsWith('.notion.site') ||
      host === 'notion.so' ||
      host.endsWith('.notion.so') ||
      host === 'notion.com' ||
      host.endsWith('.notion.com')
    ) {
      const path = `${u.pathname}${u.search}${u.hash}`
      if (!path || path === '/') return KURTROCKS_PUBLIC_SITE_ORIGIN
      return `${KURTROCKS_PUBLIC_SITE_ORIGIN}${path}`
    }
    return null
  } catch {
    return null
  }
}
