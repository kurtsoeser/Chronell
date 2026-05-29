import { useCallback, useEffect, useRef, useState } from 'react'
import {
  clampSettingsDialogSize,
  readStoredSettingsDialogSize,
  type SettingsDialogSize,
  settingsDialogViewportLimits,
  writeStoredSettingsDialogSize
} from '@/lib/settings-dialog-size'

const PERSIST_DEBOUNCE_MS = 200

export function useSettingsDialogSize(open: boolean): {
  width: number
  height: number
  onResizeGripPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void
} {
  const [size, setSize] = useState<SettingsDialogSize>(() => readStoredSettingsDialogSize())
  const sizeRef = useRef(size)
  sizeRef.current = size

  const resizeDragRef = useRef<{
    startX: number
    startY: number
    startW: number
    startH: number
  } | null>(null)

  const persistTimerRef = useRef<number | null>(null)

  const flushPersist = useCallback((): void => {
    if (persistTimerRef.current != null) {
      window.clearTimeout(persistTimerRef.current)
      persistTimerRef.current = null
    }
    writeStoredSettingsDialogSize(sizeRef.current)
  }, [])

  const onResizePointerMoveRef = useRef((e: PointerEvent): void => {
    const d = resizeDragRef.current
    if (!d) return
    const limits = settingsDialogViewportLimits()
    const nextW = d.startW + (e.clientX - d.startX)
    const nextH = d.startH + (e.clientY - d.startY)
    setSize(
      clampSettingsDialogSize({
        width: Math.min(limits.maxWidth, Math.max(limits.minWidth, nextW)),
        height: Math.min(limits.maxHeight, Math.max(limits.minHeight, nextH))
      })
    )
  })

  const endResize = useCallback((): void => {
    resizeDragRef.current = null
    document.body.style.removeProperty('cursor')
    document.body.style.removeProperty('user-select')
    window.removeEventListener('pointermove', onResizePointerMoveRef.current)
    window.removeEventListener('pointerup', endResize)
    window.removeEventListener('pointercancel', endResize)
    flushPersist()
  }, [flushPersist])

  useEffect(() => {
    if (persistTimerRef.current != null) {
      window.clearTimeout(persistTimerRef.current)
    }
    persistTimerRef.current = window.setTimeout(() => {
      persistTimerRef.current = null
      writeStoredSettingsDialogSize(sizeRef.current)
    }, PERSIST_DEBOUNCE_MS)
    return (): void => {
      if (persistTimerRef.current != null) {
        window.clearTimeout(persistTimerRef.current)
        persistTimerRef.current = null
      }
    }
  }, [size.width, size.height])

  useEffect(() => {
    const onPageHide = (): void => flushPersist()
    window.addEventListener('pagehide', onPageHide)
    return (): void => {
      window.removeEventListener('pagehide', onPageHide)
      flushPersist()
    }
  }, [flushPersist])

  useEffect(() => {
    if (!open) return
    setSize((prev) => clampSettingsDialogSize(prev))
  }, [open])

  useEffect(() => {
    function onViewportChange(): void {
      setSize((prev) => clampSettingsDialogSize(prev))
    }
    window.addEventListener('resize', onViewportChange)
    return (): void => window.removeEventListener('resize', onViewportChange)
  }, [])

  const onResizeGripPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>): void => {
      if (e.button !== 0) return
      e.preventDefault()
      e.stopPropagation()
      resizeDragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startW: sizeRef.current.width,
        startH: sizeRef.current.height
      }
      document.body.style.cursor = 'se-resize'
      document.body.style.userSelect = 'none'
      window.addEventListener('pointermove', onResizePointerMoveRef.current)
      window.addEventListener('pointerup', endResize)
      window.addEventListener('pointercancel', endResize)
    },
    [endResize]
  )

  useEffect(() => {
    return (): void => {
      if (resizeDragRef.current) endResize()
    }
  }, [endResize])

  return {
    width: size.width,
    height: size.height,
    onResizeGripPointerDown
  }
}
