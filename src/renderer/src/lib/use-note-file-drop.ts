import { useCallback, useRef, useState, type ClipboardEvent, type DragEvent, type ReactNode } from 'react'

function hasDraggedFiles(e: DragEvent<HTMLElement>): boolean {
  const types = e.dataTransfer?.types
  if (!types) return false
  return Array.from(types).includes('Files')
}

export function useNoteFileDrop(onFiles: (files: File[]) => void): {
  dragging: boolean
  dropZoneProps: {
    onDragEnter: (e: DragEvent<HTMLDivElement>) => void
    onDragOver: (e: DragEvent<HTMLDivElement>) => void
    onDragLeave: (e: DragEvent<HTMLDivElement>) => void
    onDrop: (e: DragEvent<HTMLDivElement>) => void
    onPasteCapture: (e: ClipboardEvent<HTMLDivElement>) => void
  }
} {
  const dragDepthRef = useRef(0)
  const [dragging, setDragging] = useState(false)

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>): void => {
      if (!hasDraggedFiles(e)) return
      e.preventDefault()
      e.stopPropagation()
      dragDepthRef.current = 0
      setDragging(false)
      const files = Array.from(e.dataTransfer.files)
      if (files.length > 0) onFiles(files)
    },
    [onFiles]
  )

  const handleDragEnter = useCallback((e: DragEvent<HTMLDivElement>): void => {
    if (!hasDraggedFiles(e)) return
    e.preventDefault()
    e.stopPropagation()
    dragDepthRef.current += 1
    setDragging(true)
  }, [])

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>): void => {
    if (!hasDraggedFiles(e)) return
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>): void => {
    if (!hasDraggedFiles(e)) return
    e.preventDefault()
    e.stopPropagation()
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
    if (dragDepthRef.current === 0) setDragging(false)
  }, [])

  const handlePasteCapture = useCallback(
    (e: ClipboardEvent<HTMLDivElement>): void => {
      const items = Array.from(e.clipboardData?.items ?? [])
      if (items.length === 0) return
      const files = items
        .filter((item) => item.kind === 'file')
        .map((item) => item.getAsFile())
        .filter((f): f is File => Boolean(f))
      if (files.length === 0) return
      e.preventDefault()
      e.stopPropagation()
      onFiles(files)
    },
    [onFiles]
  )

  return {
    dragging,
    dropZoneProps: {
      onDragEnter: handleDragEnter,
      onDragOver: handleDragOver,
      onDragLeave: handleDragLeave,
      onDrop: handleDrop,
      onPasteCapture: handlePasteCapture
    }
  }
}
