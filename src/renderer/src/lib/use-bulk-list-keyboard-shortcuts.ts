import { useEffect, useRef } from 'react'

export function shouldIgnoreBulkKeyboardTarget(target: EventTarget | null): boolean {
  const el = target instanceof HTMLElement ? target : null
  if (!el) return false
  if (el.closest('input, textarea, select, [contenteditable="true"]')) return true
  if (el.closest('[role="dialog"]')) return true
  return false
}

let bulkKeyboardActiveCount = 0

/** True wenn mindestens eine Liste gerade Mehrfachauswahl-Tastaturkürzel aktiv hat. */
export function isBulkListKeyboardActive(): boolean {
  return bulkKeyboardActiveCount > 0
}

export interface BulkListKeyboardActions {
  onDelete?: () => void
  onArchive?: () => void
  onMarkRead?: () => void
  onMarkUnread?: () => void
  /** U — liest Ungelesen-Status der Auswahl und markiert gelesen oder ungelesen. */
  onToggleRead?: () => void
  onToggleFlag?: () => void
  onClear?: () => void
  onSelectAll?: () => void
}

/**
 * Windows-/Outlook-typische Tastaturkürzel bei Mehrfachauswahl (Capture-Phase):
 * - Entf / Backspace → Löschen
 * - A / E → Archivieren
 * - U → Gelesen/Ungelesen
 * - F → Markierung (Stern)
 * - Escape → Auswahl aufheben
 * - Strg/Cmd+A → Alle sichtbaren auswählen
 */
export function useBulkListKeyboardShortcuts(
  selectedCount: number,
  actions: BulkListKeyboardActions,
  options?: { enabled?: boolean }
): void {
  const actionsRef = useRef(actions)
  actionsRef.current = actions
  const enabled = (options?.enabled ?? true) && selectedCount > 0

  useEffect(() => {
    if (!enabled) return

    bulkKeyboardActiveCount += 1

    const onKey = (e: KeyboardEvent): void => {
      if (shouldIgnoreBulkKeyboardTarget(e.target)) return

      const a = actionsRef.current
      const key = e.key
      const lower = key.toLowerCase()

      if (key === 'Escape') {
        if (a.onClear) {
          e.preventDefault()
          e.stopImmediatePropagation()
          a.onClear()
        }
        return
      }

      if ((e.ctrlKey || e.metaKey) && lower === 'a') {
        if (a.onSelectAll) {
          e.preventDefault()
          e.stopImmediatePropagation()
          a.onSelectAll()
        }
        return
      }

      if (e.ctrlKey || e.metaKey || e.altKey) return

      if (key === 'Delete' || key === 'Backspace') {
        if (a.onDelete) {
          e.preventDefault()
          e.stopImmediatePropagation()
          a.onDelete()
        }
        return
      }

      if (lower === 'a' || lower === 'e') {
        if (a.onArchive) {
          e.preventDefault()
          e.stopImmediatePropagation()
          a.onArchive()
        }
        return
      }

      if (lower === 'u') {
        if (a.onToggleRead) {
          e.preventDefault()
          e.stopImmediatePropagation()
          a.onToggleRead()
        } else if (a.onMarkRead) {
          e.preventDefault()
          e.stopImmediatePropagation()
          a.onMarkRead()
        } else if (a.onMarkUnread) {
          e.preventDefault()
          e.stopImmediatePropagation()
          a.onMarkUnread()
        }
        return
      }

      if (lower === 'f') {
        if (a.onToggleFlag) {
          e.preventDefault()
          e.stopImmediatePropagation()
          a.onToggleFlag()
        }
      }
    }

    window.addEventListener('keydown', onKey, true)
    return (): void => {
      window.removeEventListener('keydown', onKey, true)
      bulkKeyboardActiveCount = Math.max(0, bulkKeyboardActiveCount - 1)
    }
  }, [enabled])
}
