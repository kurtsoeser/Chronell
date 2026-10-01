import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import {
  isTimeGridSlotMinutes,
  persistTimeGridSlotMinutes,
  readTimeGridSlotMinutesFromStorage,
  TIME_GRID_SLOT_MINUTES_CHANGED_EVENT,
  type TimeGridSlotMinutes
} from '@/app/calendar/calendar-shell-storage'

/**
 * Gemeinsame Zeitraster-Einstellung (localStorage + Same-tab CustomEvent).
 * Persistiert bei Änderung und hält mehrere Instanzen (Woche / Kontextleiste) synchron.
 */
export function useSyncedTimeGridSlotMinutes(): [
  TimeGridSlotMinutes,
  Dispatch<SetStateAction<TimeGridSlotMinutes>>
] {
  const [slotMinutes, setSlotMinutesState] = useState<TimeGridSlotMinutes>(
    readTimeGridSlotMinutesFromStorage
  )

  useEffect(() => {
    persistTimeGridSlotMinutes(slotMinutes)
  }, [slotMinutes])

  useEffect(() => {
    const onExternal = (e: Event): void => {
      const detail = (e as CustomEvent).detail
      if (!isTimeGridSlotMinutes(Number(detail))) return
      const next = Number(detail) as TimeGridSlotMinutes
      setSlotMinutesState((cur) => (cur === next ? cur : next))
    }
    window.addEventListener(TIME_GRID_SLOT_MINUTES_CHANGED_EVENT, onExternal)
    return (): void => window.removeEventListener(TIME_GRID_SLOT_MINUTES_CHANGED_EVENT, onExternal)
  }, [])

  const setSlotMinutes = useCallback<Dispatch<SetStateAction<TimeGridSlotMinutes>>>((update) => {
    setSlotMinutesState(update)
  }, [])

  return [slotMinutes, setSlotMinutes]
}
