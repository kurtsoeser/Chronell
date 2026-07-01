import { useEffect, useState } from 'react'
import {
  MAIL_READING_PREVIEW_META_FIELDS_CHANGED_EVENT,
  readMailReadingPreviewMetaFieldPrefs,
  type MailReadingPreviewMetaFieldPrefs
} from '@/lib/mail-reading-preview-meta-fields'

export function useMailReadingPreviewMetaPrefs(): MailReadingPreviewMetaFieldPrefs {
  const [prefs, setPrefs] = useState<MailReadingPreviewMetaFieldPrefs>(() =>
    readMailReadingPreviewMetaFieldPrefs()
  )

  useEffect(() => {
    const onChanged = (): void => setPrefs(readMailReadingPreviewMetaFieldPrefs())
    window.addEventListener(MAIL_READING_PREVIEW_META_FIELDS_CHANGED_EVENT, onChanged)
    return (): void =>
      window.removeEventListener(MAIL_READING_PREVIEW_META_FIELDS_CHANGED_EVENT, onChanged)
  }, [])

  return prefs
}
