import { useCallback, useLayoutEffect, useRef, type RefObject } from 'react'
import {
  MAIL_PREVIEW_SCALE_MAX,
  MAIL_PREVIEW_SCALE_MIN,
  MAIL_PREVIEW_SCALE_STEP,
  useMailPreviewScaleStore
} from '@/stores/mail-preview-scale'

function touchDistance(touches: TouchList): number {
  if (touches.length < 2) return 0
  const a = touches[0]
  const b = touches[1]
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
}

function eventTargetsMailPreviewHost(host: HTMLElement, e: Event): boolean {
  for (const node of e.composedPath()) {
    if (node === host) return true
    if (node instanceof HTMLElement && node.classList.contains('mail-reading-shadow-host')) {
      return true
    }
  }
  return false
}

export interface UseMailPreviewZoomOptions {
  enabled?: boolean
  /** Erzwingt erneutes Anbinden der Listener (z. B. message.id). */
  attachKey?: string | number
}

/** Ctrl+Mausrad, Ctrl+/-/0 und Pinch-to-Zoom für die Mail-Vorschau (Shadow-Host). */
export function useMailPreviewZoom(
  hostRef: RefObject<HTMLElement | null>,
  opts: UseMailPreviewZoomOptions = {}
): void {
  const enabled = opts.enabled !== false
  const setScale = useMailPreviewScaleStore((s) => s.setScale)
  const stepScale = useMailPreviewScaleStore((s) => s.stepScale)
  const resetScale = useMailPreviewScaleStore((s) => s.resetScale)
  const pinchRef = useRef<{ startDistance: number; startScale: number } | null>(null)

  const zoomIn = useCallback((): void => {
    stepScale(MAIL_PREVIEW_SCALE_STEP)
  }, [stepScale])

  const zoomOut = useCallback((): void => {
    stepScale(-MAIL_PREVIEW_SCALE_STEP)
  }, [stepScale])

  const resetZoom = useCallback((): void => {
    resetScale()
  }, [resetScale])

  useLayoutEffect(() => {
    if (!enabled) return

    const onKeyDown = (e: KeyboardEvent): void => {
      if (!e.ctrlKey && !e.metaKey) return
      const target = e.target
      if (
        target instanceof HTMLElement &&
        target.closest('input, textarea, select, [contenteditable="true"]')
      ) {
        return
      }
      if (e.key === '=' || e.key === '+' || e.key === 'Add') {
        e.preventDefault()
        zoomIn()
        return
      }
      if (e.key === '-' || e.key === '_' || e.key === 'Subtract') {
        e.preventDefault()
        zoomOut()
        return
      }
      if (e.key === '0' || e.key === 'Digit0') {
        e.preventDefault()
        resetZoom()
      }
    }

    window.addEventListener('keydown', onKeyDown, { capture: true })
    return (): void => {
      window.removeEventListener('keydown', onKeyDown, { capture: true })
    }
  }, [enabled, hostRef, zoomIn, zoomOut, resetZoom])

  useLayoutEffect(() => {
    if (!enabled) return
    const host = hostRef.current
    if (!host) return

    const onWheel = (e: WheelEvent): void => {
      if (!e.ctrlKey && !e.metaKey) return
      if (!eventTargetsMailPreviewHost(host, e)) return
      e.preventDefault()
      e.stopPropagation()
      const delta = e.deltaY < 0 ? MAIL_PREVIEW_SCALE_STEP : -MAIL_PREVIEW_SCALE_STEP
      stepScale(delta)
    }

    const onTouchStart = (e: TouchEvent): void => {
      if (!eventTargetsMailPreviewHost(host, e)) return
      if (e.touches.length !== 2) {
        pinchRef.current = null
        return
      }
      pinchRef.current = {
        startDistance: touchDistance(e.touches),
        startScale: useMailPreviewScaleStore.getState().scale
      }
    }

    const onTouchMove = (e: TouchEvent): void => {
      const pinch = pinchRef.current
      if (!pinch || e.touches.length !== 2 || pinch.startDistance <= 0) return
      if (!eventTargetsMailPreviewHost(host, e)) return
      e.preventDefault()
      const dist = touchDistance(e.touches)
      const ratio = dist / pinch.startDistance
      const next = Math.min(
        MAIL_PREVIEW_SCALE_MAX,
        Math.max(MAIL_PREVIEW_SCALE_MIN, pinch.startScale * ratio)
      )
      setScale(next)
    }

    const onTouchEnd = (e: TouchEvent): void => {
      if (e.touches.length < 2) pinchRef.current = null
    }

    document.addEventListener('wheel', onWheel, { passive: false, capture: true })
    host.addEventListener('touchstart', onTouchStart, { passive: true })
    host.addEventListener('touchmove', onTouchMove, { passive: false })
    host.addEventListener('touchend', onTouchEnd, { passive: true })
    host.addEventListener('touchcancel', onTouchEnd, { passive: true })

    return (): void => {
      document.removeEventListener('wheel', onWheel, { capture: true })
      host.removeEventListener('touchstart', onTouchStart)
      host.removeEventListener('touchmove', onTouchMove)
      host.removeEventListener('touchend', onTouchEnd)
      host.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [enabled, hostRef, setScale, stepScale, opts.attachKey])
}
