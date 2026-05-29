import { normalizeMailSenderEmail } from '@shared/mail-sender-email'

const dataUrlCache = new Map<string, string | null>()
const inflight = new Map<string, Promise<string | null>>()

function cacheKey(email: string): string {
  return normalizeMailSenderEmail(email) ?? email.trim().toLowerCase()
}

/** Domain-Favicon fuer Absender (Main-Prozess-Cache), null bei Miss/Freemail. */
export async function loadSenderDomainAvatarDataUrl(
  email: string | null | undefined
): Promise<string | null> {
  const norm = normalizeMailSenderEmail(email)
  if (!norm) return null
  const key = cacheKey(norm)
  if (dataUrlCache.has(key)) return dataUrlCache.get(key) ?? null
  const running = inflight.get(key)
  if (running) return running

  const p = (async (): Promise<string | null> => {
    try {
      const url = await window.mailClient.mail.getSenderDomainAvatarDataUrl(norm)
      if (url) dataUrlCache.set(key, url)
      return url
    } catch {
      return null
    } finally {
      inflight.delete(key)
    }
  })()
  inflight.set(key, p)
  return p
}
