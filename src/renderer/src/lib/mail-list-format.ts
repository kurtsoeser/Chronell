import i18n from '@/i18n'

export function threadSubFirstToDisplay(toAddrs: string | null | undefined): string {
  if (!toAddrs?.trim()) return ''
  const first = toAddrs.split(/[;,]/)[0]?.trim() ?? ''
  if (!first) return ''
  const m = first.match(/<([^>]+)>/)
  const raw = (m?.[1] ?? first).trim()
  return raw.length > 0 ? raw : ''
}

export function formatMailListDate(iso: string): string {
  const localeTag = i18n.language?.startsWith('de') ? 'de-DE' : 'en-GB'
  try {
    const d = new Date(iso)
    const now = new Date()
    const sameDay =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    if (sameDay) {
      return d.toLocaleTimeString(localeTag, { hour: '2-digit', minute: '2-digit' })
    }
    const sameYear = d.getFullYear() === now.getFullYear()
    if (sameYear) {
      return d.toLocaleDateString(localeTag, { day: '2-digit', month: '2-digit' })
    }
    return d.toLocaleDateString(localeTag, { day: '2-digit', month: '2-digit', year: '2-digit' })
  } catch {
    return ''
  }
}
