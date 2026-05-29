import { useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

interface Props {
  onResize: (delta: number) => void
  className?: string
}

/** Griff am rechten Spaltenrand — ziehen ändert die Spaltenbreite. */
export function FilesTableColumnResizeHandle({ onResize, className }: Props): JSX.Element {
  const { t } = useTranslation()
  const lastXRef = useRef<number | null>(null)

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>): void => {
      if (e.button !== 0) return
      e.preventDefault()
      e.stopPropagation()
      const el = e.currentTarget
      lastXRef.current = e.clientX
      try {
        el.setPointerCapture(e.pointerId)
      } catch {
        // ignore
      }

      function onMove(ev: PointerEvent): void {
        if (lastXRef.current == null) return
        const delta = ev.clientX - lastXRef.current
        lastXRef.current = ev.clientX
        if (delta !== 0) onResize(delta)
      }

      function onEnd(): void {
        lastXRef.current = null
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onEnd)
        window.removeEventListener('pointercancel', onEnd)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }

      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onEnd)
      window.addEventListener('pointercancel', onEnd)
    },
    [onResize]
  )

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={t('files.table.resizeColumn')}
      onPointerDown={onPointerDown}
      className={cn(
        'absolute -right-1 top-0 z-20 h-full w-2 cursor-col-resize touch-none',
        'after:absolute after:inset-y-0 after:left-1/2 after:w-px after:-translate-x-1/2 after:bg-transparent hover:after:bg-primary/50',
        className
      )}
    />
  )
}
