import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import {
  buildNotePageTemplatePreviewHtml,
  notePageTemplatePreviewScale
} from '@/lib/note-page-template-preview'
import type { NotePlannerBuildOptions } from '@/lib/note-planner-templates'
import { cn } from '@/lib/utils'

const PREVIEW_WIDTH_PX = 300
const PREVIEW_MAX_HEIGHT_PX = 220
const SHOW_DELAY_MS = 280

export interface NotePageTemplatePreviewTarget {
  templateId: string
  title: string
  anchorRect: DOMRect
}

export function NotePageTemplatePreviewHover({
  target,
  customTemplates,
  plannerOptions
}: {
  target: NotePageTemplatePreviewTarget | null
  customTemplates: readonly { id: string; name: string; description: string; bodyHtml: string }[]
  plannerOptions: NotePlannerBuildOptions
}): JSX.Element | null {
  const { t } = useTranslation()
  const [visibleTarget, setVisibleTarget] = useState<NotePageTemplatePreviewTarget | null>(null)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (!target) {
      setVisibleTarget(null)
      return
    }
    timerRef.current = window.setTimeout(() => {
      setVisibleTarget(target)
      timerRef.current = null
    }, SHOW_DELAY_MS)
    return (): void => {
      if (timerRef.current != null) window.clearTimeout(timerRef.current)
    }
  }, [target])

  const previewHtml = useMemo(() => {
    if (!visibleTarget) return null
    return buildNotePageTemplatePreviewHtml(
      visibleTarget.templateId,
      customTemplates,
      t,
      plannerOptions
    )
  }, [visibleTarget, customTemplates, t, plannerOptions])

  if (!visibleTarget || !previewHtml || typeof document === 'undefined') return null

  const scale = notePageTemplatePreviewScale(visibleTarget.templateId)
  const logicalWidth = PREVIEW_WIDTH_PX / scale
  const menuGap = 10
  let left = visibleTarget.anchorRect.left - PREVIEW_WIDTH_PX - menuGap
  if (left < 8) {
    left = visibleTarget.anchorRect.right + menuGap
  }
  const top = Math.min(
    Math.max(8, visibleTarget.anchorRect.top),
    window.innerHeight - PREVIEW_MAX_HEIGHT_PX - 8
  )

  return createPortal(
    <div
      className="pointer-events-none fixed z-[400] overflow-hidden rounded-md border border-border bg-card shadow-xl"
      style={{ left, top, width: PREVIEW_WIDTH_PX, maxHeight: PREVIEW_MAX_HEIGHT_PX }}
      role="tooltip"
      aria-label={t('notes.templates.previewAria', { name: visibleTarget.title })}
    >
      <div className="border-b border-border/60 bg-muted/30 px-2 py-1 text-[0.65rem] font-medium text-foreground">
        {visibleTarget.title}
      </div>
      <div className="overflow-hidden bg-[#fafafa]">
        <div
          className={cn(
            'note-template-preview-scaler compose-editor-canvas tiptap-note-editor',
            'origin-top-left'
          )}
          style={{
            transform: `scale(${scale})`,
            width: logicalWidth,
            maxHeight: PREVIEW_MAX_HEIGHT_PX / scale
          }}
          data-compose-theme="light"
          dangerouslySetInnerHTML={{ __html: previewHtml }}
        />
      </div>
    </div>,
    document.body
  )
}
