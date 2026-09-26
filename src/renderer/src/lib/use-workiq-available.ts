import { useEffect, useState } from 'react'
import {
  WORKIQ_AVAILABILITY_CHANGED_EVENT,
  probeWorkIqAvailability,
  readWorkIqAvailablePref
} from '@/lib/workiq-availability'

/** Ob Work IQ im Engine-Dropdown für dieses MS-Konto erscheinen soll. */
export function useWorkIqAvailable(accountId: string | null | undefined): boolean {
  const id = accountId?.trim() || ''
  const [available, setAvailable] = useState(() =>
    id.startsWith('ms:') ? readWorkIqAvailablePref(id) : false
  )

  useEffect(() => {
    if (!id.startsWith('ms:')) {
      setAvailable(false)
      return
    }
    setAvailable(readWorkIqAvailablePref(id))
    let cancelled = false
    void probeWorkIqAvailability(id).then((ok) => {
      if (!cancelled) setAvailable(ok)
    })
    const onChange = (): void => setAvailable(readWorkIqAvailablePref(id))
    window.addEventListener(WORKIQ_AVAILABILITY_CHANGED_EVENT, onChange)
    return (): void => {
      cancelled = true
      window.removeEventListener(WORKIQ_AVAILABILITY_CHANGED_EVENT, onChange)
    }
  }, [id])

  return available
}
