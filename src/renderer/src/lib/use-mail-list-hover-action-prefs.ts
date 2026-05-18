import { useCallback, useEffect, useState } from 'react'
import type { MailQuickStep } from '@shared/types'
import {
  MAIL_LIST_HOVER_ACTIONS_CHANGED_EVENT,
  readMailListHoverActionPrefs,
  type MailListHoverActionPrefs
} from '@/lib/mail-list-hover-actions'

export function useMailListHoverActionPrefs(quickSteps: MailQuickStep[] = []): MailListHoverActionPrefs {
  const [prefs, setPrefs] = useState<MailListHoverActionPrefs>(() =>
    readMailListHoverActionPrefs(quickSteps)
  )

  const refresh = useCallback((): void => {
    setPrefs(readMailListHoverActionPrefs(quickSteps))
  }, [quickSteps])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    const onChanged = (): void => refresh()
    window.addEventListener(MAIL_LIST_HOVER_ACTIONS_CHANGED_EVENT, onChanged)
    return (): void => window.removeEventListener(MAIL_LIST_HOVER_ACTIONS_CHANGED_EVENT, onChanged)
  }, [refresh])

  return prefs
}
