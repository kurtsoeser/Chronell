/** `mail:123` → lokale messages.id; sonst null (z. B. Kalender). */
export function parseMailMessageIdFromContextKey(contextKey: string): number | null {
  const m = /^mail:(\d+)$/.exec(contextKey.trim())
  if (!m) return null
  const id = Number(m[1])
  return Number.isFinite(id) && id > 0 ? id : null
}
