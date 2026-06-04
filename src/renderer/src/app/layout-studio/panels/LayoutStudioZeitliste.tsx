import { useRef } from 'react'
import { CalendarRightZeitlistePanel } from '@/app/calendar/CalendarRightZeitlistePanel'
import { useLayoutStudioPreviewStore } from '@/stores/layout-studio-preview-store'

/** Zeitliste (Work-Items) — Klicks befüllen optional das Panel „Termin-Vorschau“. */
export function LayoutStudioZeitliste(): JSX.Element {
  const reloadRef = useRef<(() => void) | null>(null)
  const applyWorkItem = useLayoutStudioPreviewStore((s) => s.applyWorkItem)

  return (
    <CalendarRightZeitlistePanel
      open
      hideChrome
      reloadRef={reloadRef}
      onWorkItemFocused={applyWorkItem}
      onRequestClose={(): void => {
        /* Labor: Spalte wird über Zonen-Layout gesteuert */
      }}
    />
  )
}
