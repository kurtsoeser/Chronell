import { useLayoutEffect, type RefObject } from 'react'
import { parseIcsCalendarText } from '@shared/parse-ics'
import { useCalendarIcsImportStore } from '@/stores/calendar-ics-import'
import type { CalendarParseIcsFileResult } from '@shared/types'

function isIcsDrop(dt: DataTransfer): boolean {
  const types = Array.from(dt.types ?? [])
  if (!types.includes('Files')) return false
  // Während dragover enthält dt.files keine Elemente (Browser-Sicherheit).
  // Wir prüfen hier nur, ob der Transfer Dateien enthält.
  return true
}

function firstIcsFileFromDrop(dt: DataTransfer): File | null {
  const files = Array.from(dt.files ?? [])
  return files.find((f) => f.name.toLowerCase().endsWith('.ics')) ?? null
}

/**
 * Drag & Drop einer .ics-Datei aus dem Datei-Explorer auf den Kalender-Bereich.
 * Erkennt `files`-Transfers und öffnet den Import-Dialog wenn mindestens eine .ics dabei ist.
 */
export function useCalendarIcsDrop(
  rootRef: RefObject<HTMLElement | null>,
  options: { enabled: boolean }
): void {
  const { enabled } = options

  useLayoutEffect(() => {
    if (!enabled) return
    const root = rootRef.current
    if (!root) return

    const onDragOver = (e: DragEvent): void => {
      if (!e.dataTransfer) return
      if (!isIcsDrop(e.dataTransfer)) return
      e.preventDefault()
      e.stopPropagation()
      e.dataTransfer.dropEffect = 'copy'
    }

    const onDrop = (e: DragEvent): void => {
      if (!e.dataTransfer) return
      const file = firstIcsFileFromDrop(e.dataTransfer)
      if (!file) return
      e.preventDefault()
      e.stopPropagation()

      useCalendarIcsImportStore.setState({ open: true, loading: true, parsed: null, error: null })

      file.text().then((text) => {
        const { events, warnings } = parseIcsCalendarText(text)
        if (events.length === 0) {
          useCalendarIcsImportStore.setState({
            loading: false,
            error: warnings[0] ?? 'Keine Termine in der Datei.'
          })
          return
        }
        const parsed: CalendarParseIcsFileResult = {
          filePath: null,
          fileName: file.name,
          events,
          warnings
        }
        useCalendarIcsImportStore.setState({ loading: false, parsed })
      }).catch((err: unknown) => {
        useCalendarIcsImportStore.setState({
          loading: false,
          error: err instanceof Error ? err.message : String(err)
        })
      })
    }

    const opts = { capture: true, passive: false } as const
    root.addEventListener('dragenter', onDragOver, opts)
    root.addEventListener('dragover', onDragOver, opts)
    root.addEventListener('drop', onDrop, { capture: true })

    return (): void => {
      root.removeEventListener('dragenter', onDragOver, opts)
      root.removeEventListener('dragover', onDragOver, opts)
      root.removeEventListener('drop', onDrop, { capture: true })
    }
  }, [rootRef, enabled])
}
