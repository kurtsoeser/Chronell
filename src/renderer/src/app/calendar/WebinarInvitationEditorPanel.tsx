import { useCallback, useEffect, useMemo, useState, type MutableRefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { Code2, Eye, Pencil } from 'lucide-react'
import { WebinarInvitationPreview } from '@/app/calendar/WebinarInvitationPreview'
import { HtmlDocumentWysiwygEditor } from '@/components/HtmlDocumentWysiwygEditor'
import { FilterTabs } from '@/components/FilterTabs'
import { sanitizeWebinarInvitationHtml } from '@/lib/sanitize-webinar-invitation-html'
import {
  applyWebinarLayoutThemeColors,
  type WebinarLayoutThemeId
} from '@/lib/webinar-invitation-layout-themes'
import { cn } from '@/lib/utils'

export type WebinarInvitationEditorView = 'edit' | 'preview' | 'source'

export interface WebinarInvitationEditorPanelProps {
  descriptionHtml: string
  onChangeHtml: (html: string) => void
  flushRef?: MutableRefObject<(() => string) | null>
  /** TN-Ansicht inkl. Graph-Teams-Blob — fuer Vorschau-Tab. */
  attendeePreviewHtml?: string
  /**
   * Optional: faerbt nur die Vorschau mit Hell/Dunkel + Akzent —
   * das gespeicherte Basis-HTML (Gold/Dunkel) bleibt unveraendert.
   */
  previewTheme?: WebinarLayoutThemeId
  disabled?: boolean
  imagesLoading?: boolean
  className?: string
  protectedSelectors?: readonly string[]
  defaultView?: WebinarInvitationEditorView
  /** Kontrollierter Tab (z. B. Settings springt bei Theme-Wechsel auf Vorschau). */
  view?: WebinarInvitationEditorView
  onViewChange?: (view: WebinarInvitationEditorView) => void
}

export function WebinarInvitationEditorPanel({
  descriptionHtml,
  onChangeHtml,
  flushRef,
  attendeePreviewHtml,
  previewTheme,
  disabled = false,
  imagesLoading = false,
  className,
  protectedSelectors,
  defaultView = 'edit',
  view: viewControlled,
  onViewChange
}: WebinarInvitationEditorPanelProps): JSX.Element {
  const { t } = useTranslation()
  const [viewUncontrolled, setViewUncontrolled] =
    useState<WebinarInvitationEditorView>(defaultView)
  const view = viewControlled ?? viewUncontrolled
  const setView = onViewChange ?? setViewUncontrolled
  const [sourceDraft, setSourceDraft] = useState(descriptionHtml)
  const [sourceDirty, setSourceDirty] = useState(false)

  useEffect(() => {
    if (view === 'source' && sourceDirty) return
    setSourceDraft(descriptionHtml)
    setSourceDirty(false)
  }, [descriptionHtml, sourceDirty, view])

  const previewHtml = useMemo((): string => {
    const raw =
      view === 'preview'
        ? attendeePreviewHtml?.trim() || descriptionHtml
        : view === 'source' && sourceDirty
          ? sourceDraft
          : descriptionHtml
    if (!previewTheme || view !== 'preview') return raw
    return applyWebinarLayoutThemeColors(raw, previewTheme)
  }, [
    attendeePreviewHtml,
    descriptionHtml,
    previewTheme,
    sourceDraft,
    sourceDirty,
    view
  ])

  const applySourceDraft = useCallback((): void => {
    const next = sanitizeWebinarInvitationHtml(sourceDraft)
    setSourceDirty(false)
    setSourceDraft(next)
    onChangeHtml(next)
  }, [onChangeHtml, sourceDraft])

  const handleViewChange = useCallback(
    (next: WebinarInvitationEditorView): void => {
      if (view === 'source' && sourceDirty) {
        applySourceDraft()
      } else if (view === 'edit' && next !== 'edit') {
        flushRef?.current?.()
      }
      setView(next)
    },
    [applySourceDraft, flushRef, setView, sourceDirty, view]
  )

  return (
    <div className={cn('space-y-2', className)}>
      <FilterTabs
        size="compact"
        ariaLabel={t('calendar.eventDialog.webinarEditorViewsAria')}
        value={view}
        onChange={handleViewChange}
        options={[
          {
            id: 'edit' as const,
            label: t('calendar.eventDialog.webinarEditorViewEdit'),
            icon: <Pencil className="h-3.5 w-3.5" />
          },
          {
            id: 'preview' as const,
            label: t('calendar.eventDialog.webinarEditorViewPreview'),
            icon: <Eye className="h-3.5 w-3.5" />
          },
          {
            id: 'source' as const,
            label: t('calendar.eventDialog.webinarEditorViewSource'),
            icon: <Code2 className="h-3.5 w-3.5" />
          }
        ]}
      />

      {imagesLoading ? (
        <p className="text-2xs text-muted-foreground">{t('calendar.eventDialog.webinarImagesLoading')}</p>
      ) : null}

      {view === 'edit' ? (
        <HtmlDocumentWysiwygEditor
          valueHtml={descriptionHtml}
          onChangeHtml={onChangeHtml}
          flushRef={flushRef}
          disabled={disabled}
          minHeightClass="min-h-[420px]"
          placeholder={t('calendar.eventDialog.webinarPreviewEmpty')}
          protectedSelectors={protectedSelectors}
        />
      ) : null}

      {view === 'preview' ? (
        <>
          <p className="text-2xs text-muted-foreground">
            {t('calendar.eventDialog.webinarPreviewAttendeeHint')}
          </p>
          <WebinarInvitationPreview html={previewHtml} className="w-full" />
        </>
      ) : null}

      {view === 'source' ? (
        <>
          <p className="text-2xs text-muted-foreground">
            {t('calendar.eventDialog.webinarSourceHint')}
          </p>
          <textarea
            value={sourceDraft}
            disabled={disabled}
            onChange={(e): void => {
              setSourceDraft(e.target.value)
              setSourceDirty(true)
            }}
            onBlur={(): void => {
              if (sourceDirty) applySourceDraft()
            }}
            spellCheck={false}
            className="min-h-[420px] w-full resize-y rounded-md border border-border bg-[#0d0d0d] px-3 py-2 font-mono text-xs leading-relaxed text-[#f4f1ea] outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-60"
          />
        </>
      ) : null}
    </div>
  )
}
