import { normalizeMailSenderEmail } from '@shared/mail-sender-email'
import type { PeopleContactView } from '@shared/types'
import { loadPeopleContactPhotoDataUrl } from '@/app/people/useContactPhotoDataUrl'

const contactByEmailCache = new Map<string, PeopleContactView | null>()
const photoUrlByEmailCache = new Map<string, string | null>()
const contactInflight = new Map<string, Promise<PeopleContactView | null>>()
const photoInflight = new Map<string, Promise<string | null>>()

function cacheKey(email: string, accountId?: string | null): string {
  return `${accountId ?? '*'}:${email}`
}

export function invalidateContactPhotoByEmailCache(email?: string | null): void {
  if (!email?.trim()) {
    contactByEmailCache.clear()
    photoUrlByEmailCache.clear()
    contactInflight.clear()
    photoInflight.clear()
    return
  }
  const norm = normalizeMailSenderEmail(email)
  if (!norm) return
  for (const key of [...contactByEmailCache.keys(), ...photoUrlByEmailCache.keys()]) {
    if (key.endsWith(`:${norm}`)) {
      contactByEmailCache.delete(key)
      photoUrlByEmailCache.delete(key)
      contactInflight.delete(key)
      photoInflight.delete(key)
    }
  }
}

export async function findContactByEmail(
  email: string | null | undefined,
  accountId?: string | null
): Promise<PeopleContactView | null> {
  const norm = normalizeMailSenderEmail(email)
  if (!norm) return null
  const key = cacheKey(norm, accountId)
  if (contactByEmailCache.has(key)) return contactByEmailCache.get(key) ?? null
  const running = contactInflight.get(key)
  if (running) return running

  const p = (async (): Promise<PeopleContactView | null> => {
    try {
      const hit = await window.mailClient.people.findByEmail({ email: norm, accountId })
      contactByEmailCache.set(key, hit)
      return hit
    } catch {
      contactByEmailCache.set(key, null)
      return null
    } finally {
      contactInflight.delete(key)
    }
  })()
  contactInflight.set(key, p)
  return p
}

export async function loadContactPhotoUrlByEmail(
  email: string | null | undefined,
  accountId?: string | null
): Promise<string | null> {
  const norm = normalizeMailSenderEmail(email)
  if (!norm) return null
  const key = cacheKey(norm, accountId)
  if (photoUrlByEmailCache.has(key)) return photoUrlByEmailCache.get(key) ?? null
  const running = photoInflight.get(key)
  if (running) return running

  const p = (async (): Promise<string | null> => {
    try {
      const contact = await findContactByEmail(norm, accountId)
      if (!contact?.photoLocalPath?.trim()) {
        photoUrlByEmailCache.set(key, null)
        return null
      }
      const url = await loadPeopleContactPhotoDataUrl(contact.id)
      photoUrlByEmailCache.set(key, url)
      return url
    } catch {
      photoUrlByEmailCache.set(key, null)
      return null
    } finally {
      photoInflight.delete(key)
    }
  })()
  photoInflight.set(key, p)
  return p
}
