import { useCallback, useEffect, useRef, useState } from 'react'

const PERSIST_DEBOUNCE_MS = 200

interface UseResizableOptions {
  storageKey: string
  defaultWidth: number
  minWidth: number
  maxWidth: number
}

export function useResizableWidth({
  storageKey,
  defaultWidth,
  minWidth,
  maxWidth
}: UseResizableOptions): [number, (next: number | ((prev: number) => number)) => void] {
  const [width, setWidth] = useState<number>(() => {
    try {
      const stored = window.localStorage.getItem(storageKey)
      if (stored) {
        const parsed = Number(stored)
        if (Number.isFinite(parsed) && parsed >= minWidth && parsed <= maxWidth) {
          return parsed
        }
      }
    } catch {
      // ignore
    }
    return defaultWidth
  })

  const widthRef = useRef(width)
  widthRef.current = width

  const persistTimerRef = useRef<number | null>(null)

  const flushPersist = useCallback((): void => {
    if (persistTimerRef.current != null) {
      window.clearTimeout(persistTimerRef.current)
      persistTimerRef.current = null
    }
    try {
      window.localStorage.setItem(storageKey, String(widthRef.current))
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
        window.localStorage.setItem(storageKey, String(widthRef.current))
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
  }, [width, storageKey])

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

  const setWidthClamped = useCallback(
    (next: number | ((prev: number) => number)) => {
      setWidth((prev) => {
        const base = Number.isFinite(prev) ? prev : defaultWidth
        const raw = typeof next === 'function' ? (next as (p: number) => number)(base) : next
        const n = Number.isFinite(raw) ? raw : base
        return Math.min(maxWidth, Math.max(minWidth, n))
      })
    },
    [defaultWidth, minWidth, maxWidth]
  )

  return [width, setWidthClamped]
}

interface SplitterProps {
  onDrag: (deltaX: number) => void
  ariaLabel?: string
}

function clearSplitterDragChrome(): void {
  document.body.style.removeProperty('cursor')
  document.body.style.removeProperty('user-select')
}

export function VerticalSplitter({ onDrag, ariaLabel }: SplitterProps): JSX.Element {
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
      className={
        'group relative flex w-px shrink-0 cursor-col-resize justify-center bg-border transition-colors hover:bg-primary/50 ' +
        (dragging ? 'bg-primary/70 touch-none' : '')
      }
    >
      {/* breitere Hit-Area fuer angenehmes Dragging */}
      <div className="absolute inset-y-0 -left-1 -right-1" />
    </div>
  )
}
