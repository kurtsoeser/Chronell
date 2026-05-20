/** ISO-Zeitstempel für Cloud-Sync-Einstellungen (z. B. 20.05.2026, 19:24:40). */
export function formatProfileSyncTimestamp(iso: string, language: string): string {
  const ms = Date.parse(iso)
  if (!Number.isFinite(ms)) return iso
  const locale = language.startsWith('de') ? 'de-DE' : 'en-GB'
  return new Date(ms).toLocaleString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}
