import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { resolveMailViewerDarkSurfaceHex, useThemeStore } from '@/stores/theme'
import { useTranslation } from 'react-i18next'
import {
  buildMailShadowRootInnerHtml,
  isEffectivelyEmptyDescriptionHtml,
  sanitizeMailHtml,
  type MailViewerTheme
} from '@/lib/sanitize'
import { prepareCalendarEventBodyHtml } from '@shared/calendar-event-body-html'
import { useSanitizedHtmlShadowRoot } from '@/lib/use-sanitized-html-shadow-root'
import { previewSectionDividerClass } from '@/lib/chronell-ui-classes'
import { cn } from '@/lib/utils'
import { useMailPreviewZoom } from '@/hooks/use-mail-preview-zoom'
import { useMailPreviewScaleStore } from '@/stores/mail-preview-scale'

const DESCRIPTION_MAX_HEIGHT_PX = Math.min(
  typeof window !== 'undefined' ? window.innerHeight * 0.7 : 720,
  1040
)

export interface CalendarEventDescriptionPreviewProps {
  /** Rohes HTML (wird angezeigeseitig bereinigt). */
  html: string
  viewerTheme: MailViewerTheme
  className?: string
}

/**
 * Kalenderbeschreibung: kompakt ohne Inhalt, sonst Shadow-DOM mit inhaltsgerechter Hoehe.
 * Externe Links oeffnen im Systembrowser (wie Mail-Leseansicht).
 */
export function CalendarEventDescriptionPreview({
  html,
  viewerTheme,
  className
}: CalendarEventDescriptionPreviewProps): JSX.Element {
  const { t } = useTranslation()
  const shadowHostRef = useRef<HTMLDivElement>(null)
  const previewScale = useMailPreviewScaleStore((s) => s.scale)
  const [contentHeight, setContentHeight] = useState(48)
  const darkPalette = useThemeStore((s) => s.darkPalette)
  const customColors = useThemeStore((s) => s.customColors)
  const mailDarkSurfaceHex = useMemo(
    () => resolveMailViewerDarkSurfaceHex(darkPalette, customColors.dark),
    [darkPalette, customColors.dark]
  )

  const isEmpty = useMemo(() => isEffectivelyEmptyDescriptionHtml(html), [html])
  useMailPreviewZoom(shadowHostRef, { attachKey: html, enabled: !isEmpty })

  const safeHtml = useMemo(() => {
    if (isEmpty) return ''
    const prepared = prepareCalendarEventBodyHtml(html.trim())
    if (!prepared) return ''
    return sanitizeMailHtml(prepared, { loadImages: true })
  }, [html, isEmpty])

  const shadowInnerHtml = useMemo(
    () =>
      isEmpty
        ? ''
        : buildMailShadowRootInnerHtml(safeHtml, viewerTheme, previewScale, mailDarkSurfaceHex),
    [isEmpty, safeHtml, viewerTheme, previewScale, mailDarkSurfaceHex]
  )

  useSanitizedHtmlShadowRoot(
    shadowHostRef,
    shadowInnerHtml,
    'calendar',
    viewerTheme,
    previewScale
  )

  useLayoutEffect(() => {
    if (isEmpty) return
    const measureHost = (): void => {
      const host = shadowHostRef.current
      if (!host) return
      const h = Math.max(host.scrollHeight, host.offsetHeight)
      setContentHeight(Math.max(48, Math.ceil(h)))
    }
    setContentHeight(48)
    measureHost()
    const tid = window.requestAnimationFrame(measureHost)
    return (): void => window.cancelAnimationFrame(tid)
  }, [isEmpty, shadowInnerHtml, previewScale])

  if (isEmpty) {
    return (
      <p
        className={cn(
          'text-base italic leading-snug text-muted-foreground',
          className
        )}
      >
        {t('calendar.eventDialog.descriptionEmptyReadonly')}
      </p>
    )
  }

  const capped = contentHeight > DESCRIPTION_MAX_HEIGHT_PX
  const frameHeight = capped ? DESCRIPTION_MAX_HEIGHT_PX : contentHeight

  return (
    <div
      className={cn(
        'rounded-md border bg-secondary/[0.02]',
        previewSectionDividerClass,
        capped && 'calendar-description-scroll overflow-y-auto overflow-x-hidden',
        className
      )}
      style={capped ? { maxHeight: DESCRIPTION_MAX_HEIGHT_PX } : undefined}
    >
      <div
        ref={shadowHostRef}
        className="mail-reading-shadow-host chronell-surface-flat block w-full border-0"
        data-mail-viewer-theme={viewerTheme}
        data-mail-preview-scale={String(previewScale)}
        style={{ height: frameHeight, zoom: previewScale }}
        role="document"
        aria-label={t('calendar.eventDialog.description')}
      />
    </div>
  )
}

