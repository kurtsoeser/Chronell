import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import type { LayoutStudioPanelId } from '@/app/layout-studio/layout-studio-panel-ids'
import {
  LayoutStudioPanelPreviewIllustration,
  layoutStudioPanelPreviewKey,
  layoutStudioPanelPreviewKind
} from '@/app/layout-studio/layout-studio-panel-preview'

const HOVER_DELAY_MS = 380

export function useLayoutStudioPanelPickerPreview(): {
  previewId: LayoutStudioPanelId | null
  onOptionMouseEnter: (id: LayoutStudioPanelId, anchor: HTMLElement) => void
  onOptionMouseLeave: () => void
  PreviewPortal: () => JSX.Element | null
} {
  const { t } = useTranslation()
  const [previewId, setPreviewId] = useState<LayoutStudioPanelId | null>(null)
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const anchorRef = useRef<HTMLElement | null>(null)

  const clearTimer = useCallback((): void => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const onOptionMouseEnter = useCallback(
    (id: LayoutStudioPanelId, anchor: HTMLElement): void => {
      if (!layoutStudioPanelPreviewKey(id)) return
      clearTimer()
      anchorRef.current = anchor
      timerRef.current = setTimeout(() => {
        setPreviewId(id)
        setAnchorRect(anchor.getBoundingClientRect())
      }, HOVER_DELAY_MS)
    },
    [clearTimer]
  )

  const onOptionMouseLeave = useCallback((): void => {
    clearTimer()
    setPreviewId(null)
    setAnchorRect(null)
    anchorRef.current = null
  }, [clearTimer])

  useEffect(() => (): void => clearTimer(), [clearTimer])

  useLayoutEffect(() => {
    if (!previewId || !anchorRef.current) return
    const update = (): void => setAnchorRect(anchorRef.current!.getBoundingClientRect())
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return (): void => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [previewId])

  const PreviewPortal = useCallback((): JSX.Element | null => {
    if (!previewId || !anchorRect || typeof document === 'undefined') return null
    const key = layoutStudioPanelPreviewKey(previewId)
    if (!key) return null
    const description = t(key)
    const kind = layoutStudioPanelPreviewKind(previewId)
    const width = 300
    let left = anchorRect.right + 10
    if (left + width > window.innerWidth - 8) {
      left = Math.max(8, anchorRect.left - width - 10)
    }
    const top = Math.max(
      8,
      Math.min(window.innerHeight - 120, anchorRect.top + anchorRect.height / 2 - 60)
    )

    return createPortal(
      <div
        role="tooltip"
        className="chronell-acrylic-popover pointer-events-none z-[220] flex gap-2.5 rounded-lg border border-border bg-popover p-2.5 shadow-lg"
        style={{ position: 'fixed', left, top, width }}
      >
        <LayoutStudioPanelPreviewIllustration kind={kind} />
        <p className="min-w-0 flex-1 self-center text-[10px] leading-snug text-muted-foreground">
          {description}
        </p>
      </div>,
      document.body
    )
  }, [anchorRect, previewId, t])

  return { previewId, onOptionMouseEnter, onOptionMouseLeave, PreviewPortal }
}
