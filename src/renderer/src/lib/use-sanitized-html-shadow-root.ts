import { type RefObject, useLayoutEffect } from 'react'
import { hrefForExternalOpen, openExternalUrl } from '@/lib/open-external'
import type { MailViewerTheme } from '@/lib/sanitize'

const MAIL_MODULE_SURFACE_VAR = '--chronell-mail-module-surface'

function syncMailModuleSurfaceVar(host: HTMLElement, viewerTheme?: MailViewerTheme): void {
  if (viewerTheme !== 'dark') {
    host.style.removeProperty(MAIL_MODULE_SURFACE_VAR)
    return
  }
  const bg = getComputedStyle(host).backgroundColor
  if (bg && bg !== 'rgba(0, 0, 0, 0)') {
    host.style.setProperty(MAIL_MODULE_SURFACE_VAR, bg)
  }
}

function linkFromComposedPath(e: Event): Element | null {
  for (const n of e.composedPath()) {
    if (n instanceof Element && n.tagName.toLowerCase() === 'a') {
      return n
    }
  }
  return null
}

/**
 * Sanitisiertes HTML im offenen Shadow-Root des Hosts; externe Links per IPC.
 * Gleiches Muster wie die Mail-Leseansicht (zuverlaessiger als srcdoc-Iframe in Electron).
 */
export function useSanitizedHtmlShadowRoot(
  hostRef: RefObject<HTMLElement | null>,
  shadowInnerHtml: string,
  logPrefix: 'mail' | 'calendar' | 'task' | 'compose-quoted',
  viewerTheme?: MailViewerTheme,
  previewScale?: number
): void {
  useLayoutEffect(() => {
    const host = hostRef.current
    if (!host) return

    if (viewerTheme) {
      host.dataset.mailViewerTheme = viewerTheme
    } else {
      delete host.dataset.mailViewerTheme
    }

    if (previewScale != null && Number.isFinite(previewScale)) {
      host.dataset.mailPreviewScale = String(previewScale)
    } else {
      delete host.dataset.mailPreviewScale
    }

    let shadow = host.shadowRoot
    if (!shadow) {
      shadow = host.attachShadow({ mode: 'open' })
    }
    shadow.innerHTML = shadowInnerHtml
    syncMailModuleSurfaceVar(host, viewerTheme)

    const linkInShadow = (linkEl: Element): boolean => shadow.contains(linkEl)

    const openFromEvent = (e: MouseEvent): void => {
      if (e.defaultPrevented) return
      if (e.type === 'auxclick' && e.button !== 1) return
      if (e.type === 'click' && e.button !== 0) return
      const linkEl = linkFromComposedPath(e)
      if (!linkEl || !linkInShadow(linkEl)) return

      const rawHref =
        linkEl.getAttribute('data-mail-external')?.trim() ||
        linkEl.getAttribute('href') ||
        linkEl.getAttribute('xlink:href')
      const url = hrefForExternalOpen(rawHref)

      e.preventDefault()
      e.stopPropagation()

      if (!url) return
      void openExternalUrl(url).catch((err) => {
        console.warn(`[${logPrefix}] Link konnte nicht geoeffnet werden:`, err)
      })
    }

    const keyOpen = (e: KeyboardEvent): void => {
      if (e.defaultPrevented) return
      if (e.key !== 'Enter') return
      const linkEl = linkFromComposedPath(e)
      if (!linkEl || !linkInShadow(linkEl)) return
      const ae = document.activeElement
      if (ae && ae !== linkEl && !linkEl.contains(ae)) return

      const rawHref =
        linkEl.getAttribute('data-mail-external')?.trim() ||
        linkEl.getAttribute('href') ||
        linkEl.getAttribute('xlink:href')
      const url = hrefForExternalOpen(rawHref)
      e.preventDefault()
      e.stopPropagation()
      if (!url) return
      void openExternalUrl(url).catch((err) => {
        console.warn(`[${logPrefix}] Link (Tastatur) konnte nicht geoeffnet werden:`, err)
      })
    }

    // Capture auf dem Shadow-Root: zuverlaessiger als Bubble am Host (Electron/Shadow-DOM).
    const capture = true
    shadow.addEventListener('click', openFromEvent, capture)
    shadow.addEventListener('auxclick', openFromEvent, capture)
    shadow.addEventListener('keydown', keyOpen, capture)
    return (): void => {
      shadow.removeEventListener('click', openFromEvent, capture)
      shadow.removeEventListener('auxclick', openFromEvent, capture)
      shadow.removeEventListener('keydown', keyOpen, capture)
    }
  }, [hostRef, shadowInnerHtml, logPrefix, viewerTheme, previewScale])
}
