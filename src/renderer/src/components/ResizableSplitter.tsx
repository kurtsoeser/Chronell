import { useCallback, useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

const PERSIST_DEBOUNCE_MS = 200

/** Layout-Breite/Hoehe des Splitters (Trefferzone); sichtbare Linie bleibt 1px in der Mitte. */
export const SPLITTER_HIT_THICKNESS_PX = 10

interface UseResizableWidthOptions {
  storageKey: string
  defaultWidth: number
  minWidth: number
  maxWidth: number
  /** Einmalige Migration: erster gültiger Wert wird unter storageKey gespeichert. */
  legacyStorageKeys?: readonly string[]
}

interface UseResizableHeightOptions {
  storageKey: string
  defaultHeight: number
  minHeight: number
  maxHeight: number
}

function readStoredDimension(
  storageKey: string,
  defaultValue: number,
  min: number,
  max: number,
  legacyStorageKeys?: readonly string[]
): number {
  const clamp = (n: number): number => Math.min(max, Math.max(min, n))
  try {
    const stored = window.localStorage.getItem(storageKey)
    if (stored) {
      const parsed = Number(stored)
      if (Number.isFinite(parsed)) return clamp(parsed)
    }
    if (legacyStorageKeys?.length) {
      for (const legacyKey of legacyStorageKeys) {
        const legacy = window.localStorage.getItem(legacyKey)
        if (!legacy) continue
        const parsed = Number(legacy)
        if (!Number.isFinite(parsed)) continue
        const value = clamp(parsed)
        window.localStorage.setItem(storageKey, String(value))
        return value
      }
    }
  } catch {
    // ignore
  }
  return defaultValue
}

function usePersistedDimension({
  storageKey,
  defaultValue,
  min,
  max,
  legacyStorageKeys
}: {
  storageKey: string
  defaultValue: number
  min: number
  max: number
  legacyStorageKeys?: readonly string[]
}): [number, (next: number | ((prev: number) => number)) => void] {
  const [value, setValue] = useState<number>(() =>
    readStoredDimension(storageKey, defaultValue, min, max, legacyStorageKeys)
  )

  const valueRef = useRef(value)
  valueRef.current = value

  const persistTimerRef = useRef<number | null>(null)

  const flushPersist = useCallback((): void => {
    if (persistTimerRef.current != null) {
      window.clearTimeout(persistTimerRef.current)
      persistTimerRef.current = null
    }
    try {
      window.localStorage.setItem(storageKey, String(valueRef.current))
    } catch {
      // ignore
    }
  }, [storageKey])

  useEffect(() => {
    if (persistTimerRef.current != null) {
      window.clearTimeout(persistTimerRef.current)
    }
    persistTimerRef.current = window.setTimeout(() => {
      persistTimerRef.current = null
      try {
        window.localStorage.setItem(storageKey, String(valueRef.current))
      } catch {
        // ignore
      }
    }, PERSIST_DEBOUNCE_MS)
    return (): void => {
      if (persistTimerRef.current != null) {
        window.clearTimeout(persistTimerRef.current)
        persistTimerRef.current = null
      }
    }
  }, [value, storageKey])

  useEffect(() => {
    const onPageHide = (): void => {
      flushPersist()
    }
    window.addEventListener('pagehide', onPageHide)
    return (): void => {
      window.removeEventListener('pagehide', onPageHide)
      flushPersist()
    }
  }, [flushPersist])

  const setValueClamped = useCallback(
    (next: number | ((prev: number) => number)) => {
      setValue((prev) => {
        const base = Number.isFinite(prev) ? prev : defaultValue
        const raw = typeof next === 'function' ? (next as (p: number) => number)(base) : next
        const n = Number.isFinite(raw) ? raw : base
        return Math.min(max, Math.max(min, n))
      })
    },
    [defaultValue, min, max]
  )

  return [value, setValueClamped]
}

export function useResizableWidth({
  storageKey,
  defaultWidth,
  minWidth,
  maxWidth,
  legacyStorageKeys
}: UseResizableWidthOptions): [number, (next: number | ((prev: number) => number)) => void] {
  return usePersistedDimension({
    storageKey,
    defaultValue: defaultWidth,
    min: minWidth,
    max: maxWidth,
    legacyStorageKeys
  })
}

export function useResizableHeight({
  storageKey,
  defaultHeight,
  minHeight,
  maxHeight
}: UseResizableHeightOptions): [number, (next: number | ((prev: number) => number)) => void] {
  return usePersistedDimension({
    storageKey,
    defaultValue: defaultHeight,
    min: minHeight,
    max: maxHeight
  })
}

interface SplitterProps {
  onDrag: (deltaX: number) => void
  ariaLabel?: string
  /**
   * Keine sichtbare Linie (Nav → Inhalts-Pane). Nur Hover/Drag-Hinweis.
   * Fluent/OneNote: abgerundete Pane ohne Trennstrich zur Sidebar.
   */
  variant?: 'default' | 'moduleNav'
}

function clearSplitterDragChrome(): void {
  document.body.style.removeProperty('cursor')
  document.body.style.removeProperty('user-select')
}

export function VerticalSplitter({ onDrag, ariaLabel, variant = 'default' }: SplitterProps): JSX.Element {
  const [dragging, setDragging] = useState(false)
  const lastXRef = useRef<number | null>(null)
  const captureTargetRef = useRef<HTMLElement | null>(null)
  const activePointerIdRef = useRef<number | null>(null)
  const draggingRef = useRef(false)
  const onDragRef = useRef(onDrag)
  onDragRef.current = onDrag

  const finishDrag = useCallback((e?: PointerEvent): void => {
    if (!draggingRef.current) return
    if (
      e != null &&
      activePointerIdRef.current != null &&
      e.pointerId !== activePointerIdRef.current
    ) {
      return
    }

    const target = captureTargetRef.current
    const pointerId = e?.pointerId ?? activePointerIdRef.current

    if (target != null && pointerId != null) {
      try {
        if (target.hasPointerCapture(pointerId)) {
          target.releasePointerCapture(pointerId)
        }
      } catch {
        // ignore
      }
    }

    draggingRef.current = false
    captureTargetRef.current = null
    activePointerIdRef.current = null
    lastXRef.current = null
    clearSplitterDragChrome()
    setDragging(false)
  }, [])

  useEffect(() => {
    if (!dragging) return

    function onMove(e: PointerEvent): void {
      if (activePointerIdRef.current != null && e.pointerId !== activePointerIdRef.current) return
      if (lastXRef.current === null) {
        lastXRef.current = e.clientX
        return
      }
      const delta = e.clientX - lastXRef.current
      lastXRef.current = e.clientX
      if (delta !== 0) onDragRef.current(delta)
    }

    function onEnd(e: PointerEvent): void {
      finishDrag(e)
    }

    function onWindowBlur(): void {
      finishDrag()
    }

    function onLostCapture(e: PointerEvent): void {
      finishDrag(e)
    }

    const captureEl = captureTargetRef.current
    captureEl?.addEventListener('lostpointercapture', onLostCapture)

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onEnd)
    window.addEventListener('pointercancel', onEnd)
    window.addEventListener('blur', onWindowBlur)

    return (): void => {
      captureEl?.removeEventListener('lostpointercapture', onLostCapture)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onEnd)
      window.removeEventListener('pointercancel', onEnd)
      window.removeEventListener('blur', onWindowBlur)
      clearSplitterDragChrome()
      draggingRef.current = false
    }
  }, [dragging, finishDrag])

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={ariaLabel}
      onPointerDown={(e): void => {
        if (e.button !== 0) return
        e.preventDefault()
        const el = e.currentTarget
        lastXRef.current = e.clientX
        activePointerIdRef.current = e.pointerId
        captureTargetRef.current = el
        draggingRef.current = true
        try {
          el.setPointerCapture(e.pointerId)
        } catch {
          // ignore
        }
        setDragging(true)
      }}
      onLostPointerCapture={(e): void => {
        finishDrag(e)
      }}
      style={{ width: SPLITTER_HIT_THICKNESS_PX }}
      className={cn(
        'group relative z-10 flex shrink-0 cursor-col-resize items-center justify-center',
        dragging && 'touch-none'
      )}
    >
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 transition-colors',
          variant === 'moduleNav'
            ? 'bg-transparent group-hover:bg-primary/35'
            : 'bg-border group-hover:bg-primary/50',
          dragging && (variant === 'moduleNav' ? 'bg-primary/45' : 'bg-primary/70')
        )}
      />
    </div>
  )
}

interface HorizontalSplitterProps {
  onDrag: (deltaY: number) => void
  ariaLabel?: string
  /** Dezente Linie (Notiz/Kontext-Vorschau) statt voller `border`-Farbe. */
  variant?: 'default' | 'subtle' | 'flush'
}

export function HorizontalSplitter({
  onDrag,
  ariaLabel,
  variant = 'default'
}: HorizontalSplitterProps): JSX.Element {
  const [dragging, setDragging] = useState(false)
  const lastYRef = useRef<number | null>(null)
  const captureTargetRef = useRef<HTMLElement | null>(null)
  const activePointerIdRef = useRef<number | null>(null)
  const draggingRef = useRef(false)
  const onDragRef = useRef(onDrag)
  onDragRef.current = onDrag

  const finishDrag = useCallback((e?: PointerEvent): void => {
    if (!draggingRef.current) return
    if (
      e != null &&
      activePointerIdRef.current != null &&
      e.pointerId !== activePointerIdRef.current
    ) {
      return
    }

    const target = captureTargetRef.current
    const pointerId = e?.pointerId ?? activePointerIdRef.current

    if (target != null && pointerId != null) {
      try {
        if (target.hasPointerCapture(pointerId)) {
          target.releasePointerCapture(pointerId)
        }
      } catch {
        // ignore
      }
    }

    draggingRef.current = false
    captureTargetRef.current = null
    activePointerIdRef.current = null
    lastYRef.current = null
    clearSplitterDragChrome()
    setDragging(false)
  }, [])

  useEffect(() => {
    if (!dragging) return

    function onMove(e: PointerEvent): void {
      if (activePointerIdRef.current != null && e.pointerId !== activePointerIdRef.current) return
      if (lastYRef.current === null) {
        lastYRef.current = e.clientY
        return
      }
      const delta = e.clientY - lastYRef.current
      lastYRef.current = e.clientY
      if (delta !== 0) onDragRef.current(delta)
    }

    function onEnd(e: PointerEvent): void {
      finishDrag(e)
    }

    function onWindowBlur(): void {
      finishDrag()
    }

    function onLostCapture(e: PointerEvent): void {
      finishDrag(e)
    }

    const captureEl = captureTargetRef.current
    captureEl?.addEventListener('lostpointercapture', onLostCapture)

    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onEnd)
    window.addEventListener('pointercancel', onEnd)
    window.addEventListener('blur', onWindowBlur)

    return (): void => {
      captureEl?.removeEventListener('lostpointercapture', onLostCapture)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onEnd)
      window.removeEventListener('pointercancel', onEnd)
      window.removeEventListener('blur', onWindowBlur)
      clearSplitterDragChrome()
      draggingRef.current = false
    }
  }, [dragging, finishDrag])

  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-label={ariaLabel}
      onPointerDown={(e): void => {
        if (e.button !== 0) return
        e.preventDefault()
        const el = e.currentTarget
        lastYRef.current = e.clientY
        activePointerIdRef.current = e.pointerId
        captureTargetRef.current = el
        draggingRef.current = true
        try {
          el.setPointerCapture(e.pointerId)
        } catch {
          // ignore
        }
        setDragging(true)
      }}
      onLostPointerCapture={(e): void => {
        finishDrag(e)
      }}
      style={{
        height: variant === 'flush' ? 4 : SPLITTER_HIT_THICKNESS_PX
      }}
      className={cn(
        'group relative z-10 flex shrink-0 cursor-row-resize items-center justify-center',
        dragging && 'touch-none'
      )}
    >
      {variant !== 'flush' ? (
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 transition-colors',
          variant === 'subtle'
            ? 'bg-white/[0.04] group-hover:bg-primary/20 dark:bg-white/[0.04] dark:group-hover:bg-primary/25'
            : 'bg-border group-hover:bg-primary/50',
          dragging && (variant === 'subtle' ? 'bg-primary/35' : 'bg-primary/70')
        )}
      />
      ) : null}
    </div>
  )
}
