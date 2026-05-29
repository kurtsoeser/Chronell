import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useComposeEditorEffectiveTheme } from '@/stores/compose-editor-theme'
import { resolveMailViewerDarkSurfaceHex, useThemeStore } from '@/stores/theme'
import {
  buildMailShadowRootInnerHtml,
  sanitizeMailHtml,
  type MailViewerTheme
} from '@/lib/sanitize'
import { useSanitizedHtmlShadowRoot } from '@/lib/use-sanitized-html-shadow-root'
import { cn } from '@/lib/utils'

const MAX_HEIGHT_PX = 360

export interface ComposeQuotedMailPreviewProps {
  quotedHtml: string
  /** Hell-DOM-Kachel: immer lesbar; Dark nur wenn explizit gewünscht. */
  viewerTheme?: MailViewerTheme
  className?: string
}

/** Zitierte Original-Mail im Composer — gleiche Shadow-DOM-Pipeline wie Lesefenster. */
export function ComposeQuotedMailPreview({
  quotedHtml,
  viewerTheme: viewerThemeProp,
  className
}: ComposeQuotedMailPreviewProps): JSX.Element {
  const storedViewerTheme = useComposeEditorEffectiveTheme()
  const viewerTheme = viewerThemeProp ?? storedViewerTheme
  const shadowHostRef = useRef<HTMLDivElement>(null)
  const [contentHeight, setContentHeight] = useState(80)
  const darkPalette = useThemeStore((s) => s.darkPalette)
  const customColors = useThemeStore((s) => s.customColors)
  const mailDarkSurfaceHex = useMemo(
    () => resolveMailViewerDarkSurfaceHex(darkPalette, customColors.dark),
    [darkPalette, customColors.dark]
  )

  const safeHtml = useMemo(
    () => sanitizeMailHtml(quotedHtml.trim(), { loadImages: false }),
    [quotedHtml]
  )

  const shadowInnerHtml = useMemo(
    () => buildMailShadowRootInnerHtml(safeHtml, viewerTheme, 1, mailDarkSurfaceHex),
    [safeHtml, viewerTheme, mailDarkSurfaceHex]
  )

  useSanitizedHtmlShadowRoot(shadowHostRef, shadowInnerHtml, 'compose-quoted', viewerTheme)

  useLayoutEffect(() => {
    const measureHost = (): void => {
      const host = shadowHostRef.current
      if (!host) return
      const h = Math.max(host.scrollHeight, host.offsetHeight)
      setContentHeight(Math.max(48, Math.ceil(h)))
    }
    setContentHeight(80)
    measureHost()
    const tid = window.requestAnimationFrame(measureHost)
    return (): void => window.cancelAnimationFrame(tid)
  }, [shadowInnerHtml])

  const capped = contentHeight > MAX_HEIGHT_PX
  const frameHeight = capped ? MAX_HEIGHT_PX : contentHeight

  return (
    <div
      className={cn(
        'compose-quoted-mail-preview overflow-hidden rounded-lg border border-[hsl(var(--compose-surface-border)/0.55)]',
        viewerTheme === 'light' ? 'bg-white' : 'bg-[hsl(var(--compose-surface-muted))]',
        capped && 'overflow-y-auto',
        className
      )}
      style={capped ? { maxHeight: MAX_HEIGHT_PX } : undefined}
    >
      <div
        ref={shadowHostRef}
        className="mail-reading-shadow-host chronell-surface-flat block w-full border-0"
        data-mail-viewer-theme={viewerTheme}
        style={{ height: frameHeight, minHeight: 48 }}
        role="document"
        aria-label="Original-Mail"
      />
    </div>
  )
}
