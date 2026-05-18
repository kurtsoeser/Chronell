export interface MailReadingPopoutRoute {
  messageId: number
}

/** Popout-Fenster: `#mail-reading-popout?messageId=…` */
export function parseMailReadingPopoutRoute(): MailReadingPopoutRoute | null {
  const hash = window.location.hash.replace(/^#/, '')
  if (!hash.startsWith('mail-reading-popout')) return null
  const qIdx = hash.indexOf('?')
  const qs = qIdx >= 0 ? hash.slice(qIdx + 1) : ''
  const params = new URLSearchParams(qs)
  const raw = params.get('messageId')?.trim() ?? ''
  const messageId = Number.parseInt(raw, 10)
  if (!Number.isFinite(messageId) || messageId <= 0) return null
  return { messageId }
}

export function isMailReadingPopoutWindow(): boolean {
  return parseMailReadingPopoutRoute() != null
}
