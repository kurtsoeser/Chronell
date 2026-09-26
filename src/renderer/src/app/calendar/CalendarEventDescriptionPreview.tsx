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
import { cn } from '@/lib/utils'
import { useMailPreviewZoom } from '@/hooks/use-mail-preview-zoom'
import { useMailPreviewScaleStore } from '@/stores/mail-preview-scale'

/** Cap fuer sehr lange Beschreibungen (Webinare) — Rest scrollbar. */
const DESCRIPTION_MAX_HEIGHT_PX = Math.min(
  typeof window !== 'undefined' ? Math.round(window.innerHeight * 0.55) : 520,
  720
)

function measureShadowContentHeight(host: HTMLElement): number {
  const shadow = host.shadowRoot
  if (!shadow) return 0
  const root = shadow.querySelector('.mail-html-root')
  if (root instanceof HTMLElement) {
    // scrollHeight = Layout-Hoehe (ohne CSS-zoom); getBoundingClientRect waere schon skaliert.
    return Math.ceil(Math.max(root.scrollHeight, 0))
  }
  let max = 0
  for (const child of shadow.children) {
    if (!(child instanceof HTMLElement)) continue
    if (child.tagName === 'STYLE') continue
    max = Math.max(max, child.scrollHeight)
  }
  return Math.ceil(max)
}

export interface CalendarEventDescriptionPreviewProps {
  /** Rohes HTML (wird angezeigeseitig bereinigt). */
  html: string
  viewerTheme: MailViewerTheme
  className?: string
}

/**
 * Kalenderbeschreibung: Shadow-DOM, Hoehe am Inhalt (kein Leerraum), Rahmen wie Notiz.
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
  const [contentHeight, setContentHeight] = useState(0)
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
    if (isEmpty) {
      setContentHeight(0)
      return
    }
    const host = shadowHostRef.current
    if (!host) return

    const measure = (): void => {
      // Host-Hoehe kurz auf auto, sonst misst scrollHeight die alte fixe Hoehe mit.
      const prevHeight = host.style.height
      host.style.height = 'auto'
      const raw = measureShadowContentHeight(host)
      host.style.height = prevHeight
      const next = Math.max(24, raw || 24)
      setContentHeight((prev) => (prev === next ? prev : next))
    }

    measure()
    const raf1 = window.requestAnimationFrame(measure)
    const raf2 = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(measure)
    })

    const shadow = host.shadowRoot
    const root = shadow?.querySelector('.mail-html-root')
    let ro: ResizeObserver | null = null
    if (root && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => measure())
      ro.observe(root)
    }

    return (): void => {
      window.cancelAnimationFrame(raf1)
      window.cancelAnimationFrame(raf2)
      ro?.disconnect()
    }
  }, [isEmpty, shadowInnerHtml, previewScale])

  if (isEmpty) {
    return (
      <p className={cn('text-sm italic leading-snug text-muted-foreground', className)}>
        {t('calendar.eventDialog.descriptionEmptyReadonly')}
      </p>
    )
  }

  const capped = contentHeight > DESCRIPTION_MAX_HEIGHT_PX
  const frameHeight = capped
    ? DESCRIPTION_MAX_HEIGHT_PX
    : contentHeight > 0
      ? contentHeight
      : undefined

  return (
    <div
      className={cn(
        'overflow-x-hidden rounded-lg border border-border/60 bg-secondary/[0.04]',
        capped && 'calendar-description-scroll overflow-y-auto',
        className
      )}
      style={capped ? { maxHeight: DESCRIPTION_MAX_HEIGHT_PX } : undefined}
    >
      <div
        ref={shadowHostRef}
        className="mail-reading-shadow-host chronell-surface-flat block w-full border-0"
        data-mail-viewer-theme={viewerTheme}
        data-mail-preview-scale={String(previewScale)}
        style={{
          height: frameHeight,
          minHeight: frameHeight == null ? 24 : undefined,
          zoom: previewScale
        }}
        role="document"
        aria-label={t('calendar.eventDialog.description')}
      />
    </div>
  )
}
