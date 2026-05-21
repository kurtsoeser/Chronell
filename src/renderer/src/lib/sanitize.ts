import DOMPurify from 'dompurify'
import { normalizeExternalOpenUrl } from '@shared/external-open-url'

const ALLOWED_TAGS = [
  'a','b','blockquote','br','div','em','figure','figcaption','h1','h2','h3','h4','h5','h6',
  'hr','i','img','li','ol','p','pre','small','span','strong','sub','sup','table','tbody','td',
  'tfoot','th','thead','tr','u','ul','code'
]

const ALLOWED_ATTR = [
  'href',
  'target',
  'rel',
  'src',
  'alt',
  'title',
  'style',
  'class',
  'width',
  'height',
  'colspan',
  'rowspan',
  /** Ziel-URL nach Neutralisierung von `href` (kein Subframe-Load / keine App-CSP). */
  'data-mail-external',
  'xlink:href'
]

let mailAnchorNeutralizeInstalled = false

/**
 * Erzwingt, dass externe Ziele nie als echtes `href` im Iframe landen (sonst CSP
 * ERR_BLOCKED_BY_CSP bevor `preventDefault` zuverlaessig greift). Stattdessen
 * `href="#"` + `data-mail-external` — der Renderer oeffnet per IPC im OS-Browser.
 */
function installMailAnchorNeutralizer(): void {
  if (mailAnchorNeutralizeInstalled) return
  mailAnchorNeutralizeInstalled = true
  DOMPurify.addHook('afterSanitizeAttributes', (node: Node) => {
    if (node.nodeType !== 1) return
    const el = node as Element
    if (el.nodeName.toLowerCase() !== 'a') return
    const raw = (el.getAttribute('href') || el.getAttribute('xlink:href') || '').trim()
    if (!raw || raw === '#' || raw.startsWith('#')) return
    const normalized = normalizeExternalOpenUrl(raw)
    if (!normalized) return
    el.setAttribute('data-mail-external', normalized)
    el.setAttribute('href', '#')
    el.removeAttribute('xlink:href')
  })
}

/**
 * Ersetzt im HTML alle `src="cid:..."`-Referenzen durch die passenden
 * Data-URIs aus der uebergebenen Map. ContentIds koennen optional in
 * Spitzklammern stehen (RFC 2392) – diese werden vor dem Lookup entfernt.
 *
 * Faellt das direkte CID-Matching fehl, versuchen wir Fallbacks:
 *  - Lookup nach Inhalt ohne Spitzklammern bzw. mit Decode-URI
 *  - Suffix-/Prefix-Match (z.B. cid:image001@... matcht "image001")
 *
 * Zusaetzlich werden `<img>`-Tags ohne `src` mit `originalsrc="cid:..."`,
 * `data-cid-src="..."` oder `xsrc="..."` rekonstruiert – Outlook strippt
 * die `src` gerne, wenn externe Bilder geblockt sind.
 */
export function replaceInlineCidImages(
  html: string,
  cidMap: Record<string, string>
): string {
  if (!html) return html
  if (Object.keys(cidMap).length === 0) return html

  const keys = Object.keys(cidMap)

  function lookup(rawCid: string): string | null {
    try {
      const decoded = decodeURIComponent(rawCid)
      const stripped = decoded.replace(/^<|>$/g, '')
      const hit =
        cidMap[stripped] ??
        cidMap[decoded] ??
        cidMap[rawCid] ??
        cidMap[rawCid.replace(/^<|>$/g, '')]
      if (hit) return hit

      // Heuristik: Suffix-/Prefix-Match (cid:image001 matcht
      // "image001@01D7...").
      const candidate = stripped.split('@')[0]
      if (candidate) {
        const hit2 = keys.find((k) => k === candidate || k.startsWith(`${candidate}@`))
        if (hit2) return cidMap[hit2]
      }
      return null
    } catch {
      return null
    }
  }

  let out = html.replace(
    /\bsrc\s*=\s*(["'])cid:([^"'>\s]+)\1/gi,
    (full, quote: string, rawCid: string) => {
      const uri = lookup(rawCid)
      return uri ? `src=${quote}${uri}${quote}` : full
    }
  )

  // Outlook setzt manchmal `originalsrc="cid:..."` und entfernt `src`.
  // Wir bauen die `src` zurueck, wenn wir das Bild kennen.
  out = out.replace(
    /<img\b([^>]*)\boriginalsrc\s*=\s*(["'])cid:([^"'>\s]+)\2([^>]*)>/gi,
    (full, pre: string, quote: string, rawCid: string, post: string) => {
      const uri = lookup(rawCid)
      if (!uri) return full
      const hasSrc = /\bsrc\s*=/.test(pre) || /\bsrc\s*=/.test(post)
      if (hasSrc) {
        return full.replace(/\bsrc\s*=\s*["'][^"']*["']/i, `src=${quote}${uri}${quote}`)
      }
      return `<img${pre} src=${quote}${uri}${quote}${post}>`
    }
  )

  return out
}

/** Transparentes 1×1-GIF – verhindert Browser-Ladefehler für unaufgelöste cid:-Referenzen. */
const CID_PLACEHOLDER_DATA_URI =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

/**
 * Ersetzt verbleibende `cid:`-URLs (kein Treffer in der Inline-Map, Race vor dem Nachladen)
 * durch ein transparentes Platzhalterbild, damit der Browser kein `cid:`-Schema anfragt.
 */
export function stripUnresolvedCidUrls(html: string): string {
  if (!html || !/cid:/i.test(html)) return html

  let out = html.replace(
    /\b(src|originalsrc|data-cid-src|xsrc)\s*=\s*(["'])cid:[^"']+\2/gi,
    (_full, attr: string, quote: string) => `${attr}=${quote}${CID_PLACEHOLDER_DATA_URI}${quote}`
  )

  out = out.replace(
    /\b(src|originalsrc|data-cid-src|xsrc)\s*=\s*cid:[^\s>]+/gi,
    (_full, attr: string) => `${attr}="${CID_PLACEHOLDER_DATA_URI}"`
  )

  out = out.replace(/url\s*\(\s*["']?cid:[^)"']+["']?\s*\)/gi, `url(${CID_PLACEHOLDER_DATA_URI})`)

  return out
}

/**
 * Sanitisiert HTML-Mail-Inhalt fuer die sichere Anzeige im srcdoc-Iframe (CSP ohne JS).
 * Externe Bilder werden standardmaessig blockiert (Privacy: kein Tracker-Pixel-Load).
 */
export function sanitizeMailHtml(html: string, options: { loadImages?: boolean } = {}): string {
  const loadImages = options.loadImages ?? false
  installMailAnchorNeutralizer()

  const cleaned = DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|data):|(?:[a-z\-]+):|#)/i,
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'link', 'meta', 'form'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur'],
    KEEP_CONTENT: true,
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false
  })

  // `target=_blank` oeffnet sonst (mit allow-popups) ein Electron-Fenster unter App-CSP.
  const noBlankTargets = cleaned.replace(
    /<a\b([^>]*)\btarget\s*=\s*(["'])[^"']*\2/gi,
    '<a$1'
  )

  if (loadImages) return noBlankTargets

  return noBlankTargets.replace(
    /<img\b[^>]*\bsrc\s*=\s*["']?(https?:[^"'\s>]+)["']?[^>]*>/gi,
    (match) => match.replace(/\bsrc\s*=\s*["']?https?:[^"'\s>]+["']?/i, 'data-original-src="blocked"')
  )
}

import { DARK_PALETTE_SURFACES } from '@/lib/dark-palette-presets'
import { normalizeHex } from '@/lib/theme-color-utils'

/** Shadow-Host setzt diese Variable (computed .chronell-surface-flat). */
const MAIL_MODULE_SURFACE_VAR = '--chronell-mail-module-surface'

export type MailViewerTheme = 'light' | 'dark'

/** Standard: Kartenfarbe der App (Fluent Graphite), nicht neutrales Grau. */
export const MAIL_DARK_SURFACE_DEFAULT_HEX = DARK_PALETTE_SURFACES.graphite.card

export function resolveMailDarkViewerSurfaceHex(surfaceHex?: string): string {
  return normalizeHex(surfaceHex ?? '') ?? MAIL_DARK_SURFACE_DEFAULT_HEX
}

/** CSP fuer Mail-/Kalender-srcdoc: kein JS, aber inline-Styles und Bilder (DOMPurify bleibt Pflicht). */
const mailIframeCspMeta = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data: http: https: blob:; font-src data: http: https:; script-src 'none'; object-src 'none'; base-uri 'none';">`

export function buildIframeSrcDoc(
  html: string,
  theme: MailViewerTheme = 'light',
  darkSurfaceHex?: string
): string {
  if (theme === 'dark') {
    const softened = softenLightEmailBackgroundsForDarkViewer(html)
    return `<!doctype html><html lang="de"><head><meta charset="utf-8">${mailIframeCspMeta}${buildMailIframeDarkThemeCss(darkSurfaceHex)}</head><body>${wrapMailDarkHtmlContent(softened)}</body></html>`
  }
  return `<!doctype html><html lang="de"><head><meta charset="utf-8">${mailIframeCspMeta}${lightThemeCss}</head><body>${html}</body></html>`
}

/**
 * Markup fuer Shadow-Root der Mail-Leseansicht (kein iframe): gleiche Styles wie im srcdoc,
 * aber `html, body` -> `:host`, damit Klicks zuverlässig im Electron-Hauptdokument landen.
 */
function mailPreviewScaleHostStyle(scale: number): string {
  const clamped = Math.min(2, Math.max(0.75, scale))
  return `<style>:host { --mail-preview-scale: ${clamped}; }</style>`
}

function applyMailPreviewScaleToCss(css: string): string {
  return css
    .replace(/\b14px\b/g, 'calc(14px * var(--mail-preview-scale, 1))')
    .replace(/\b12px\b/g, 'calc(12px * var(--mail-preview-scale, 1))')
    .replace(/\b18px\b/g, 'calc(18px * var(--mail-preview-scale, 1))')
}

export type MailShadowRootBuildOptions = {
  /** Kein unteres Innenpadding — Notiz/Kontext schliesst direkt an den Mail-Body an. */
  flushContextBelow?: boolean
}

function mailShadowRootContentPadding(flushContextBelow?: boolean): string {
  return flushContextBelow ? '14px 18px 0' : '14px 18px'
}

function buildMailShadowLightThemeCss(contentPadding: string): string {
  return `
  <style>
    :root { color-scheme: light; }
    html, body { margin: 0; padding: 0; background: #ffffff; color: #1f1f23;
      font: 14px/1.55 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
      word-wrap: break-word; forced-color-adjust: none; }
    .mail-html-root--light {
      padding: ${contentPadding};
      min-height: 0;
      background: #ffffff;
      color: #1f1f23;
      forced-color-adjust: none;
    }
    a { color: #0b66c2; }
    img { max-width: 100%; height: auto; }
    blockquote { border-left: 3px solid #d6d6db; margin: 0 0 0 4px; padding: 4px 12px;
      color: #555; }
    table { max-width: 100%; }
    pre, code { background: #f4f4f6; padding: 2px 4px; border-radius: 3px; font-size: 12px;
      color: #1f1f23; }
    pre { padding: 8px 12px; overflow: auto; }
    hr { border: 0; border-top: 1px solid #e5e5ea; margin: 12px 0; }
  </style>
`
}

export function buildMailShadowRootInnerHtml(
  html: string,
  theme: MailViewerTheme,
  scale = 1,
  darkSurfaceHex?: string,
  options?: MailShadowRootBuildOptions
): string {
  const adapt = (css: string): string => css.replace(':root', ':host').replace(/html,\s*body/g, ':host')
  const scaleHost = mailPreviewScaleHostStyle(scale)
  const contentPadding = mailShadowRootContentPadding(options?.flushContextBelow)
  if (theme === 'dark') {
    const softened = softenLightEmailBackgroundsForDarkViewer(html)
    return `${scaleHost}${applyMailPreviewScaleToCss(buildMailShadowDarkThemeCss(darkSurfaceHex, contentPadding))}${wrapMailDarkHtmlContent(softened)}`
  }
  return `${scaleHost}${applyMailPreviewScaleToCss(adapt(buildMailShadowLightThemeCss(contentPadding)))}<div class="mail-html-root mail-html-root--light">${html}</div>`
}

const lightThemeCss = buildMailShadowLightThemeCss('14px 18px')

/**
 * Dunkelmodus: Flaeche = Host-Variable (gleiche computed color wie .chronell-surface-flat).
 * Invert nur auf Inhalt; Layer-Hintergrund transparent → Rand/Padding = Modulflaeche, kein Sepia-Rand.
 */
function mailDarkSurfaceCss(surfaceHex?: string): string {
  const surface = resolveMailDarkViewerSurfaceHex(surfaceHex)
  return `var(${MAIL_MODULE_SURFACE_VAR}, ${surface})`
}

function buildMailDarkHtmlShellCss(
  surfaceCss: string,
  hostSelector: ':root' | ':host',
  bodyPadding: string,
  rootMinHeight: string,
  rootContentPadding = '14px 18px'
): string {
  const hostBlock =
    hostSelector === ':host'
      ? `
    :host {
      color-scheme: light;
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      display: block;
      background: ${surfaceCss};
      font: 14px/1.55 'Noto Sans', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      word-wrap: break-word;
    }`
      : `
    :root { color-scheme: light; }
    html, body {
      margin: 0;
      padding: ${bodyPadding};
      box-sizing: border-box;
      min-height: ${rootMinHeight};
      background: ${surfaceCss};
      font: 14px/1.55 'Noto Sans', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      word-wrap: break-word;
      color-scheme: light;
    }`

  return `
  <style>
    ${hostBlock}
    *, *::before, *::after { box-sizing: inherit; }
    .mail-html-root {
      forced-color-adjust: none;
      min-height: ${hostSelector === ':host' ? '0' : 'calc(100vh - 28px)'};
      padding: ${hostSelector === ':host' ? rootContentPadding : '0'};
      margin: 0;
      background: ${surfaceCss};
    }
    .mail-html-invert-layer {
      isolation: isolate;
      forced-color-adjust: none;
      margin: 0;
      border-radius: 0;
      background: transparent;
      color: #1f1f23;
      filter: invert(1);
    }
    .mail-html-invert-layer img,
    .mail-html-invert-layer svg,
    .mail-html-invert-layer video {
      filter: invert(1);
      forced-color-adjust: none;
    }
    /* Vor Invert: Brauntoene → nach Invert dezentes Blau statt Gelb (#0b66c2 invertiert). */
    .mail-html-invert-layer a,
    .mail-html-invert-layer a:link,
    .mail-html-invert-layer a:visited {
      color: #915700 !important;
      text-decoration-color: #915700 !important;
    }
    img { max-width: 100%; height: auto; }
    table { max-width: 100%; }
  </style>
`
}

function wrapMailDarkHtmlContent(html: string): string {
  return `<div class="mail-html-root"><div class="mail-html-invert-layer">${html}</div></div>`
}

/** Entfernt helle Vollflaechen im HTML, damit Invert nicht bräunlich-sepia wirkt. */
export function softenLightEmailBackgroundsForDarkViewer(html: string): string {
  if (!html) return html
  return html
    .replace(
      /\bbgcolor\s*=\s*(["']?)(?:#(?:f{3,8}|ffffff)|white)\1/gi,
      'bgcolor="transparent"'
    )
    .replace(
      /background(?:-color)?\s*:\s*(?:#(?:f{3,8}|ffffff)|white|rgb\s*\(\s*255\s*,\s*255\s*,\s*255\s*\))/gi,
      'background-color:transparent'
    )
}

function buildMailIframeDarkThemeCss(surfaceHex?: string): string {
  return buildMailDarkHtmlShellCss(mailDarkSurfaceCss(surfaceHex), ':root', '14px 18px', '100%')
}

/** Shadow-Root Mail-Leseansicht: kein 100vh-Mindestmaß (iframe-Überbleibsel), sonst kein Scroll im Panel. */
function buildMailShadowDarkThemeCss(
  surfaceHex?: string,
  rootContentPadding = '14px 18px'
): string {
  return buildMailDarkHtmlShellCss(mailDarkSurfaceCss(surfaceHex), ':host', '0', '0', rootContentPadding)
}

/** Kalender-Beschreibung: kein Vollbild-Mindestmaß wie bei Mail (vermeidet leere Scrollbars). */
export function isEffectivelyEmptyDescriptionHtml(html: string): boolean {
  const t = html.replace(/<[^>]+>/gi, '').replace(/\u00a0/g, ' ').trim()
  return t.length === 0
}

function buildCalendarDescriptionDarkThemeCss(surfaceHex?: string): string {
  return `${buildMailDarkHtmlShellCss(mailDarkSurfaceCss(surfaceHex), ':root', '14px 18px', '100%')}
  <style>
    html, body { overflow: hidden; }
    pre { padding: 8px 12px; overflow: auto; scrollbar-width: thin; }
  </style>`
}

const calendarDescriptionLightThemeCss = `
  <style>
    :root { color-scheme: light; }
    html, body {
      margin: 0;
      padding: 14px 18px;
      background: #ffffff;
      color: #1f1f23;
      font: 14px/1.55 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
      word-wrap: break-word;
      overflow: hidden;
    }
    a { color: #0b66c2; }
    img { max-width: 100%; height: auto; }
    blockquote { border-left: 3px solid #d6d6db; margin: 0 0 0 4px; padding: 4px 12px; color: #555; }
    table { max-width: 100%; }
    pre, code { background: #f4f4f6; padding: 2px 4px; border-radius: 3px; font-size: 12px; color: #1f1f23; }
    pre { padding: 8px 12px; overflow: auto; scrollbar-width: thin; }
    hr { border: 0; border-top: 1px solid #e5e5ea; margin: 12px 0; }
  </style>
`

export function buildCalendarDescriptionIframeSrcDoc(
  html: string,
  theme: MailViewerTheme = 'light',
  darkSurfaceHex?: string
): string {
  if (theme === 'dark') {
    const softened = softenLightEmailBackgroundsForDarkViewer(html)
    return `<!doctype html><html lang="de"><head><meta charset="utf-8">${mailIframeCspMeta}${buildCalendarDescriptionDarkThemeCss(darkSurfaceHex)}</head><body>${wrapMailDarkHtmlContent(softened)}</body></html>`
  }
  return `<!doctype html><html lang="de"><head><meta charset="utf-8">${mailIframeCspMeta}${calendarDescriptionLightThemeCss}</head><body>${html}</body></html>`
}
