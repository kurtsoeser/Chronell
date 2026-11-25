import { useEffect } from 'react'
import { useAppModeStore } from '@/stores/app-mode'
import { useEventsOsWebinarLaunchStore } from '@/stores/events-os-webinar-launch'

/**
 * chronell://webinar aus Events OS → Kalender, Shell öffnet die Vorlage.
 */
export function EventsOsWebinarLaunchHost(): JSX.Element {
  useEffect(() => {
    const pull = async (): Promise<void> => {
      const launches = await window.mailClient.eventsOs.drainWebinarLaunches()
      if (launches.length === 0) return
      const last = launches[launches.length - 1]!
      useAppModeStore.getState().setMode('calendar')
      useEventsOsWebinarLaunchStore.getState().request(last)
    }
    const dispose = window.mailClient.eventsOs.onWebinarLaunchAvailable(() => {
      void pull()
    })
    void pull()
    return dispose
  }, [])

  return <></>
}
