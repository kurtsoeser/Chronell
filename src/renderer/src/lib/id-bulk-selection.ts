import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

export type BulkSelectionModifiers = { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }

export function toggleIdInSet<T extends string | number>(keys: ReadonlySet<T>, id: T): Set<T> {
  const next = new Set(keys)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  return next
}

/** Nächster Checked-State nach Klick (Fokus-Zeile + Mehrfachauswahl, z. B. Tasks/Work). */
export function nextCheckedListSelection<T extends string | number>(
  id: T,
  modifiers: BulkSelectionModifiers,
  visibleIds: readonly T[],
  checkedKeys: ReadonlySet<T>,
  anchor: T | null,
  focusKey: T | null
): { checkedKeys: Set<T>; anchor: T } {
  const extend = modifiers.ctrlKey || modifiers.metaKey
  if (modifiers.shiftKey) {
    const rangeAnchor = anchor ?? focusKey ?? id
    const range = rangeIdsInListOrder(visibleIds, rangeAnchor, id)
    if (extend) {
      const next = new Set(checkedKeys)
      for (const rid of range) next.add(rid)
      return { checkedKeys: next, anchor: rangeAnchor }
    }
    return { checkedKeys: new Set(range), anchor: rangeAnchor }
  }
  if (extend) {
    return { checkedKeys: toggleIdInSet(checkedKeys, id), anchor: id }
  }
  return { checkedKeys: new Set(), anchor: id }
}

/** Bereich zwischen Anker und Ziel in Listenreihenfolge (Windows Shift+Klick). */
export function rangeIdsInListOrder<T extends string | number>(
  visibleIds: readonly T[],
  anchorId: T,
  toId: T
): T[] {
  const fromIdx = visibleIds.indexOf(anchorId)
  const toIdx = visibleIds.indexOf(toId)
  if (fromIdx < 0 || toIdx < 0) return [toId]
  const lo = Math.min(fromIdx, toIdx)
  const hi = Math.max(fromIdx, toIdx)
  return visibleIds.slice(lo, hi + 1)
}

export interface IdBulkSelection<T extends string | number> {
  selectedIds: ReadonlySet<T>
  selectedCount: number
  isSelected: (id: T) => boolean
  clear: () => void
  selectAllVisible: () => void
  handlePointerDown: (id: T, modifiers: BulkSelectionModifiers) => void
}

/**
 * Windows-typische Mehrfachauswahl:
 * - Klick ohne Modifier: Einzel-Auswahl (ersetzen)
 * - Ctrl/Meta + Klick: Toggle
 * - Shift + Klick: Range (ersetzen)
 * - Ctrl/Meta + Shift + Klick: Range (additiv)
 * - Escape: Auswahl löschen
 */
export function useIdBulkSelection<T extends string | number>(
  orderedVisibleIds: readonly T[],
  scopeKey: string
): IdBulkSelection<T> {
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<T>>(() => new Set())
  const rangeAnchorRef = useRef<T | null>(null)

  const visibleIds = useMemo(() => [...orderedVisibleIds], [orderedVisibleIds])

  useEffect(() => {
    setSelectedIds(new Set())
    rangeAnchorRef.current = null
  }, [scopeKey])

  useEffect(() => {
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev
      const visible = new Set(visibleIds)
      let changed = false
      const next = new Set<T>()
      for (const id of prev) {
        if (visible.has(id)) next.add(id)
        else changed = true
      }
      return changed ? next : prev
    })
  }, [visibleIds])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape' || selectedIds.size === 0) return
      const el = e.target as HTMLElement | null
      if (el?.closest('input, textarea, select, [contenteditable="true"]')) return
      setSelectedIds(new Set())
      rangeAnchorRef.current = null
    }
    window.addEventListener('keydown', onKey)
    return (): void => window.removeEventListener('keydown', onKey)
  }, [selectedIds.size])

  const clear = useCallback((): void => {
    setSelectedIds(new Set())
    rangeAnchorRef.current = null
  }, [])

  const selectAllVisible = useCallback((): void => {
    setSelectedIds(new Set(visibleIds))
    if (visibleIds.length > 0) rangeAnchorRef.current = visibleIds[0] ?? null
  }, [visibleIds])

  const handlePointerDown = useCallback(
    (id: T, modifiers: BulkSelectionModifiers): void => {
      const extend = modifiers.ctrlKey || modifiers.metaKey
      if (modifiers.shiftKey) {
        const anchor = rangeAnchorRef.current ?? id
        const range = rangeIdsInListOrder(visibleIds, anchor, id)
        if (extend) {
          setSelectedIds((prev) => {
            const next = new Set(prev)
            for (const rid of range) next.add(rid)
            return next
          })
        } else {
          setSelectedIds(new Set(range))
        }
        rangeAnchorRef.current = anchor
        return
      }

      if (extend) {
        setSelectedIds((prev) => toggleIdInSet(prev, id))
        rangeAnchorRef.current = id
        return
      }

      setSelectedIds(new Set([id]))
      rangeAnchorRef.current = id
    },
    [visibleIds]
  )

  return {
    selectedIds,
    selectedCount: selectedIds.size,
    isSelected: (id: T): boolean => selectedIds.has(id),
    clear,
    selectAllVisible,
    handlePointerDown
  }
}

