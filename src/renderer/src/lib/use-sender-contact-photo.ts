import { useEffect, useState } from 'react'
import { loadContactPhotoUrlByEmail } from '@/lib/contact-photo-by-email'

/** Lokales Kontaktfoto aus dem Adressbuch fuer eine Absender-E-Mail (ohne Gravatar). */
export function useSenderContactPhoto(
  email: string | null | undefined,
  accountId?: string | null
): string | null {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    const addr = email?.trim()
    if (!addr) {
      setUrl(null)
      return
    }
    let cancelled = false
    void loadContactPhotoUrlByEmail(addr, accountId).then((u) => {
      if (!cancelled) setUrl(u)
    })
    return (): void => {
      cancelled = true
    }
  }, [email, accountId])

  return url
}
