import { isChronellWebinarInvitationHtml } from './chronell-webinar-calendar'
import { normalizeAnchorHrefsInHtmlFragment, normalizeComposeLinkHref } from './compose-link-href'
import { buildMsFormsResponseUrl, parseMsFormsUrl } from './note-msforms-embed'

/** http(s) und www.-URLs; Trailing-Satzzeichen bleiben ausserhalb des Matches. */
const URL_IN_TEXT_RE = /(?:https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)/gi
const IFRAME_SRC_RE =
  /<iframe\b[^>]*\bsrc=["']([^"']+)["'][^>]*(?:\/>|>[\s\S]*?<\/iframe>)/gi
/** HTML-Tags inkl. Attribute — URLs darin nicht linkifizieren. */
const HTML_TAG_OR_COMMENT_RE = /(<!--[\s\S]*?-->|<[^>]+>)/g

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function trimTrailingUrlPunctuation(url: string): { hrefPart: string; trailing: string } {
  const m = url.match(/^(.*?)([),.!?;:]+)$/)
  if (!m) return { hrefPart: url, trailing: '' }
  return { hrefPart: m[1], trailing: m[2] }
}

function linkifyMatchedUrl(url: string): string {
  const { hrefPart, trailing } = trimTrailingUrlPunctuation(url)
  const normalized = normalizeComposeLinkHref(hrefPart)
  const href = normalized ?? hrefPart
  return `<a href="${escapeHtml(href)}">${escapeHtml(hrefPart)}</a>${trailing}`
}

function linkifyEscapedHtml(escaped: string): string {
  return escaped.replace(URL_IN_TEXT_RE, (url) => linkifyMatchedUrl(url))
}

function calendarLinkParagraph(url: string, label?: string): string {
  const href = escapeHtml(url)
  const text = escapeHtml(label ?? url)
  return `<p><a href="${href}" rel="noopener noreferrer" target="_blank">${text}</a></p>`
}

/**
 * Ersetzt iframe-Einbettungen (z. B. Microsoft-Forms-Share-Code) durch klickbare Links,
 * bevor Sanitizer iframes entfernen.
 */
export function promoteIframeSourcesToLinksInHtml(html: string): string {
  if (!/<iframe\b/i.test(html)) return html

  return html.replace(IFRAME_SRC_RE, (_match, rawSrc: string) => {
    const src = rawSrc.trim()
    const formsRef = parseMsFormsUrl(src)
    if (formsRef) {
      const openUrl = buildMsFormsResponseUrl(formsRef)
      return calendarLinkParagraph(openUrl, openUrl)
    }
    if (/^https?:\/\//i.test(src)) {
      return calendarLinkParagraph(src)
    }
    return ''
  })
}

/** Editor-HTML fuer Graph/Google: iframe-Links erhalten, bereinigen, nackte URLs linkifizieren. */
export function prepareCalendarEventDescriptionFromEditorHtml(
  editorHtml: string,
  sanitizeHtml: (html: string) => string
): string | null {
  const promoted = promoteIframeSourcesToLinksInHtml(editorHtml.trim())
  const sanitized = sanitizeHtml(promoted)
  return prepareCalendarEventBodyHtml(sanitized)
}

export function isEffectivelyEmptyCalendarBodyHtml(html: string): boolean {
  const t = html
    .replace(/<[^>]+>/gi, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .trim()
  return t.length === 0
}

/**
 * Bare URLs nur im sichtbaren Text linkifizieren — nie in Tag-Attributen
 * (sonst zerstoert z. B. Teams-Firmenlogo `img src="https://…amsauth=…"` den Block).
 */
export function linkifyBareUrlsInHtmlFragment(html: string): string {
  const parts = html.split(/(<a\b[^>]*>[\s\S]*?<\/a>)/gi)
  const linkified = parts
    .map((part, index) => {
      if (index % 2 === 1) return part
      return linkifyUrlsOutsideHtmlTags(part)
    })
    .join('')
  return normalizeAnchorHrefsInHtmlFragment(linkified)
}

function linkifyUrlsOutsideHtmlTags(fragment: string): string {
  const chunks = fragment.split(HTML_TAG_OR_COMMENT_RE)
  return chunks
    .map((chunk) => {
      if (!chunk) return chunk
      if (chunk.startsWith('<') || chunk.startsWith('<!--')) return chunk
      return chunk.replace(URL_IN_TEXT_RE, (url) => linkifyMatchedUrl(url))
    })
    .join('')
}

/**
 * Teams `joinInformation` / Besprechungsblock: kurzlebige Org-Logos (asyncgw + amsauth)
 * und kaputte Restfragmente entfernen — der Text-/Link-Block bleibt.
 */
function removeOrphanImgAttributeTails(fragment: string): string {
  return fragment.replace(
    /(?:^|[\s>])(["']?\s*(?:alt|style|width|height|border)\s*=\s*["'][^"']*["'](?:\s*(?:alt|style|width|height|border)\s*=\s*["'][^"']*["'])*\s*\/?>)/gi,
    (match, _attrs, offset) => {
      const before = fragment.slice(Math.max(0, offset - 160), offset)
      if (/<img\b/i.test(before)) return match
      return match.startsWith('>') ? '>' : ''
    }
  )
}

export function cleanTeamsMeetingJoinInformationHtml(html: string): string {
  let out = html.trim()
  if (!out) return ''

  // joinInformation kommt oft als data:text/html — dekodieren, ohne Orphan-Strip
  // (Orphan-Strip nur bei Inject, sonst wuerde volles Webinar-HTML riskant gekuerzt).
  out = decodeTeamsJoinInformationPayload(out)
  if (!out) return ''

  const beforeImgStrip = out
  // img mit Teams-Asset-Gateway (Firmenlogo aus Admin-Center) — Token laeuft ab / bricht im Editor.
  out = out.replace(
    /<img\b[^>]*\bsrc=["'][^"']*asyncgw\.teams\.microsoft\.com[^"']*["'][^>]*>/gi,
    ''
  )
  out = out.replace(/<img\b[^>]*\bsrc=["'][^"']*amsauth=[^"']*["'][^>]*>/gi, '')
  const didStripImg = out !== beforeImgStrip

  const beforeUrlStrip = out
  // Bereits zerschossene Reste: nackte asyncgw-URL + haengende Attribute vom ehemaligen img.
  out = out.replace(
    /https?:\/\/[^\s<>"']*asyncgw\.teams\.microsoft\.com[^\s<>"']*/gi,
    ''
  )
  out = out.replace(/https?:\/\/[^\s<>"']*amsauth=[^\s<>"']*/gi, '')
  const didStripUrls = out !== beforeUrlStrip

  if (didStripImg || didStripUrls) {
    out = removeOrphanImgAttributeTails(out)
    out = out.replace(/^\s*["']\s*/, '')
    out = out.replace(/\s*\/?>\s*$/g, '')
  }

  // Leere Absaetze/Container nach Logo-Entfernung.
  out = out.replace(/<p>\s*<\/p>/gi, '')
  out = out.replace(/<div>\s*<\/div>/gi, '')
  return out.trim()
}

const TEAMS_JOIN_URL_RE = /teams\.microsoft\.com\/(?:meet|l\/meetup-join)|teams\.live\.com\/meet/i
const TEAMS_JOIN_HEADING_RE =
  /Microsoft\s+Teams[- ]?(?:Besprechung|meeting)|Join\s+(?:the\s+)?meeting|Teilnehmen\s*:|Teams-Zugangsdaten/i

/**
 * Abschnitte NACH dem Teams-Inhalt (alte Layouts: Umfrage nach Teams;
 * neue Layouts: Hinweise/#kurtrocks nach Teams — Umfrage liegt davor).
 */
const WEBINAR_POST_TEAMS_SECTION_RE =
  /Kurze\s+Umfrage|Veranstaltungsseite|Hinweise\s*(?:&amp;|&)\s*Hilfen|Mit lieben Gr[uü](?:&szlig;|ß)|#kurtrocks/i

/** Ob HTML bereits einen Teams-Join-Block (oder denselben Link) enthaelt. */
export function htmlAlreadyHasTeamsMeetingJoinBlock(
  html: string,
  joinUrl?: string | null
): boolean {
  const raw = html.trim()
  if (!raw) return false
  const url = joinUrl?.trim()
  if (url && raw.includes(url)) return true
  return TEAMS_JOIN_HEADING_RE.test(raw) && TEAMS_JOIN_URL_RE.test(raw)
}

function isWebinarTeamsChromePrefix(html: string, start: number, anchorIdx: number): boolean {
  const probe = html.slice(start, Math.min(html.length, anchorIdx + 48))
  const firstP = probe.match(/^<p\b[^>]*>[\s\S]*?<\/p>/i)?.[0]
  if (!firstP) return false
  if (/Live dabei sein/i.test(firstP)) return true
  if (
    /Microsoft\s+Teams/i.test(firstP) &&
    !/Teams[- ]?(?:Besprechung|meeting)/i.test(firstP)
  ) {
    return true
  }
  return false
}

function findTeamsBlobStart(html: string, anchorIdx: number, webinar: boolean): number {
  const before = html.slice(0, anchorIdx)
  /** Webinar: nur naher Wrapper — sonst greifen wir die Teams-Panel-<table>/Chrome-<p>s. */
  const lookback = webinar ? 160 : before.length
  const windowStart = Math.max(0, before.length - lookback)
  const window = before.slice(windowStart)
  const rel = Math.max(
    window.lastIndexOf('<div'),
    window.lastIndexOf('<table'),
    window.lastIndexOf('<p'),
    window.lastIndexOf('<h1'),
    window.lastIndexOf('<h2'),
    window.lastIndexOf('<h3'),
    window.lastIndexOf('<hr')
  )
  if (rel < 0) return anchorIdx
  const start = windowStart + rel
  if (webinar && isWebinarTeamsChromePrefix(html, start, anchorIdx)) return anchorIdx
  return start
}

function findWebinarPostTeamsSectionStart(html: string, from: number): number {
  const after = html.slice(from)
  const match = WEBINAR_POST_TEAMS_SECTION_RE.exec(after)
  if (!match || match.index == null || match.index <= 0) return -1
  const abs = from + match.index
  const beforeSec = html.slice(from, abs)
  const open = Math.max(
    beforeSec.lastIndexOf('<table'),
    beforeSec.lastIndexOf('<div'),
    beforeSec.lastIndexOf('<p')
  )
  return open >= 0 ? from + open : abs
}

function sliceTeamsMeetingBlob(html: string, start: number, webinar: boolean): string {
  let end = html.length
  if (webinar) {
    const sectionStart = findWebinarPostTeamsSectionStart(html, start)
    if (sectionStart > start) end = sectionStart
  } else {
    // Outlook-Dokument: nicht </body></html> mitschneiden.
    const docEnd = html.slice(start).search(/<\/(?:body|html)\b/i)
    if (docEnd > 0) end = start + docEnd
  }
  return html.slice(start, end).trim() || ''
}

const TEAMS_BLOB_VOID_TAGS = /^(br|hr|img|input|meta|link|col|wbr|area|base|source)$/i

function decodeTeamsJoinInformationPayload(html: string): string {
  let out = html.trim()
  if (!out) return ''

  if (/^data%3Atext%2Fhtml/i.test(out)) {
    try {
      out = decodeURIComponent(out)
    } catch {
      /* keep */
    }
  }
  if (/^data:text\/html/i.test(out)) {
    const comma = out.indexOf(',')
    if (comma >= 0) {
      const meta = out.slice(0, comma)
      let payload = out.slice(comma + 1)
      if (!/;base64/i.test(meta)) {
        payload = payload.replace(/\+/g, ' ')
        try {
          out = decodeURIComponent(payload)
        } catch {
          out = payload
        }
      }
    }
  }
  return out
}

/**
 * Outlook/Graph-Teams-Fragment fuer Injection in Webinar-Tabellen bereinigen:
 * - data:text/html dekodieren
 * - <html>/<body>/<head> entfernen
 * - verwaiste schliessende Tags strippen (sonst bricht Outlook die Tabellen nach dem Slot)
 */
export function normalizeTeamsMeetingBlobFragment(html: string): string {
  let out = decodeTeamsJoinInformationPayload(html)
  if (!out) return ''

  out = out.replace(/<head\b[^>]*>[\s\S]*?<\/head>/gi, '')
  out = out.replace(/<\/?(?:!doctype|html|body|meta|link)\b[^>]*>/gi, '')
  out = stripOrphanClosingTagsInTeamsBlob(out)
  return out.trim()
}

const TEAMS_BLOB_LIGHT_TEXT = '#ffffff'
const TEAMS_BLOB_ANCHOR_HOLD = '<!--CHRONELL_TEAMS_A_'

/**
 * Teams-Zugangsblock lesbar auf dunklem Webinar-Panel (#151b28):
 * alle Nicht-Link-Textfarben → Weiss (Outlook liefert Grau/Schwarz fuer hellen Mail-Hintergrund).
 * Links bleiben unveraendert (blau).
 */
export function lightenTeamsMeetingBlobForDarkPanel(html: string): string {
  let trimmed = html.trim()
  if (!trimmed) return ''

  // Idempotent: vorherigen Wrapper entfernen und Farben erneut erzwingen.
  const unwrap = /^<div\b[^>]*\bdata-chronell-teams-light\b[^>]*>([\s\S]*)<\/div>\s*$/i.exec(trimmed)
  if (unwrap) trimmed = unwrap[1].trim()

  const anchors: string[] = []
  let out = trimmed.replace(/<a\b[\s\S]*?<\/a>/gi, (m) => {
    const i = anchors.length
    anchors.push(m)
    return `${TEAMS_BLOB_ANCHOR_HOLD}${i}-->`
  })

  // Alle Inline-Farben ausserhalb von Links auf Weiss — auch mittelgrau / !important.
  out = out.replace(/\bcolor\s*:\s*[^;'"}]+/gi, `color:${TEAMS_BLOB_LIGHT_TEXT}`)
  out = out.replace(/\bcolor\s*=\s*(["'])[^"']*\1/gi, `color=$1${TEAMS_BLOB_LIGHT_TEXT}$1`)

  out = out.replace(
    new RegExp(`${TEAMS_BLOB_ANCHOR_HOLD.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\d+)-->`, 'g'),
    (_m, i: string) => anchors[Number(i)] ?? ''
  )

  return `<div data-chronell-teams-light="1" style="color:${TEAMS_BLOB_LIGHT_TEXT}">${out}</div>`
}

/**
 * Bereits eingebetteten Teams-Blob in Webinar-HTML aufhellen (Anzeige / alter Graph-Body).
 * Nur bei dunklem Teams-Panel (#151b28) — helle Vorlagen behalten Outlook-Dunkeltext.
 */
export function lightenEmbeddedTeamsMeetingBlobInWebinarHtml(html: string): string {
  const raw = html.trim()
  if (!raw || !isChronellWebinarInvitationHtml(raw)) return html
  const hasDarkTeamsPanel =
    /bgcolor\s*=\s*["']#151b28["']/i.test(raw) || /background-color\s*:\s*#151b28\b/i.test(raw)
  if (!hasDarkTeamsPanel) return html
  const blob = extractRawTeamsOnlineMeetingBlob(raw)
  if (!blob) return html
  const idx = raw.indexOf(blob)
  if (idx < 0) return html
  const light = lightenTeamsMeetingBlobForDarkPanel(blob)
  if (light === blob) return html
  return `${raw.slice(0, idx)}${light}${raw.slice(idx + blob.length)}`
}

/** Schneidet beim ersten schliessenden Tag ab, das im Fragment nie geoeffnet wurde. */
function stripOrphanClosingTagsInTeamsBlob(html: string): string {
  const re = /<!--[\s\S]*?-->|<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g
  const stack: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    if (m[0].startsWith('<!--')) continue
    const name = (m[1] || '').toLowerCase()
    if (TEAMS_BLOB_VOID_TAGS.test(name)) continue
    const selfClose = /\/>\s*$/.test(m[0])
    if (selfClose) continue
    if (!m[0].startsWith('</')) {
      stack.push(name)
      continue
    }
    const top = stack[stack.length - 1]
    if (top === name) {
      stack.pop()
      continue
    }
    const found = stack.lastIndexOf(name)
    if (found >= 0) {
      stack.splice(found)
      continue
    }
    // Orphan closer — Rest (weitere Closer inkl. </body></html>) verwerfen.
    return html.slice(0, m.index).trimEnd()
  }
  return html.trim()
}

function extractTeamsMeetingBlobFromHtml(html: string): string | null {
  const raw = html.trim()
  if (!raw || !TEAMS_JOIN_URL_RE.test(raw)) return null
  const webinar = isChronellWebinarInvitationHtml(raw)

  const headingIdx = raw.search(TEAMS_JOIN_HEADING_RE)
  if (headingIdx >= 0) {
    const start = findTeamsBlobStart(raw, headingIdx, webinar)
    return sliceTeamsMeetingBlob(raw, start, webinar) || null
  }

  const urlIdx = raw.search(TEAMS_JOIN_URL_RE)
  if (urlIdx < 0) return null
  const start = findTeamsBlobStart(raw, urlIdx, webinar)
  return sliceTeamsMeetingBlob(raw, start, webinar) || null
}

/**
 * Isoliert den Teams-Join-Block aus Body-/joinInformation-HTML,
 * damit der Editor-Inhalt beim Provisionieren nur ergaenzt (nicht ersetzt) wird.
 */
export function extractTeamsMeetingJoinBlockHtml(html: string | null | undefined): string | null {
  const cleaned = cleanTeamsMeetingJoinInformationHtml(html?.trim() || '')
  if (!cleaned) return null
  return extractTeamsMeetingBlobFromHtml(cleaned)
}

/**
 * Roher Teams-/Online-Meeting-Blob aus dem Graph-Body — ohne Clean/Sanitize.
 * Muss bei PATCH exakt erhalten bleiben, sonst deaktiviert Outlook die Online-Besprechung.
 */
export function extractRawTeamsOnlineMeetingBlob(html: string | null | undefined): string | null {
  return extractTeamsMeetingBlobFromHtml(html?.trim() ?? '')
}

const WEBINAR_TEAMS_SLOT_OPEN_RE =
  /<span\b[^>]*\bid\s*=\s*["']chronell-webinar-teams-slot["'][^>]*>/i

/**
 * Einfacher Slot-Match — bricht bei verschachtelten <span> (Join-Link) ab.
 * Fuer Erkennung der id ausreichend; fuer Extraktion/Replace `findWebinarTeamsBlobSlotRange` nutzen.
 */
export const WEBINAR_TEAMS_BLOB_SLOT_RE =
  /<span\b[^>]*\bid\s*=\s*["']chronell-webinar-teams-slot["'][^>]*>[\s\S]*?<\/span>/i

const WEBINAR_TEAMS_BLOB_SLOT_HOLD = '<!-- CHRONELL_WEBINAR_TEAMS_SLOT -->'

/** Vollstaendiger Slot inkl. verschachtelter <span> (Join-Button). */
export function findWebinarTeamsBlobSlotRange(
  html: string
): { start: number; end: number } | null {
  const openMatch = WEBINAR_TEAMS_SLOT_OPEN_RE.exec(html)
  if (!openMatch) return null
  const start = openMatch.index
  let i = start + openMatch[0].length
  let depth = 1
  const lower = html.toLowerCase()
  while (i < html.length && depth > 0) {
    const nextOpen = lower.indexOf('<span', i)
    const nextClose = lower.indexOf('</span>', i)
    if (nextClose === -1) return null
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth += 1
      i = nextOpen + 5
      continue
    }
    depth -= 1
    if (depth === 0) {
      return { start, end: nextClose + '</span>'.length }
    }
    i = nextClose + '</span>'.length
  }
  return null
}

export function replaceWebinarTeamsBlobSlot(html: string, replacement: string): string | null {
  const range = findWebinarTeamsBlobSlotRange(html)
  if (!range) return null
  return `${html.slice(0, range.start)}${replacement}${html.slice(range.end)}`
}

function preserveWebinarTeamsBlobSlot(html: string): { html: string; slotHtml: string | null } {
  const range = findWebinarTeamsBlobSlotRange(html)
  if (!range) return { html, slotHtml: null }
  const slotHtml = html.slice(range.start, range.end)
  return {
    html: `${html.slice(0, range.start)}${WEBINAR_TEAMS_BLOB_SLOT_HOLD}${html.slice(range.end)}`,
    slotHtml
  }
}

const TEAMS_PANEL_HEADING_RE = /<p[^>]*>\s*Microsoft\s+Teams\s*<\/p>/i

/** Entfernt doppelt angehaengte Hinweise/Signatur-Bloecke (Speicher-Bug-Fallback). */
export function dedupeRepeatedWebinarTailSections(html: string): string {
  if (!isChronellWebinarInvitationHtml(html)) return html
  const re = /Hinweise\s*(?:&amp;|&)\s*Hilfen/gi
  let first = -1
  let second = -1
  let match: RegExpExecArray | null
  while ((match = re.exec(html)) !== null) {
    if (first < 0) first = match.index
    else {
      second = match.index
      break
    }
  }
  if (second < 0) return html
  return html.slice(0, second).trimEnd()
}

/** Ersetzt den Webinar-Teams-Slot durch den originalen Graph-Meeting-Blob — idempotent. */
export function injectTeamsMeetingBlobIntoWebinarInvitation(
  userHtml: string,
  blob: string
): string {
  let trimmedBlob = normalizeTeamsMeetingBlobFragment(blob)
  if (!trimmedBlob) return userHtml.trim()

  let layout = userHtml.trim()
  if (isChronellWebinarInvitationHtml(layout)) {
    layout = stripTeamsMeetingJoinBlockHtml(layout) || layout
    layout = dedupeRepeatedWebinarTailSections(layout)
    // Weiss-Text nur auf dunklem Teams-Panel — helle Vorlagen behalten Outlook-Dunkeltext.
    const darkTeamsPanel =
      /bgcolor\s*=\s*["']#151b28["']/i.test(layout) ||
      /background-color\s*:\s*#151b28\b/i.test(layout)
    if (darkTeamsPanel) {
      trimmedBlob = lightenTeamsMeetingBlobForDarkPanel(trimmedBlob)
    }
  }

  const withBlob = replaceWebinarTeamsBlobSlot(layout, trimmedBlob)
  if (withBlob != null) return withBlob

  if (isChronellWebinarInvitationHtml(layout) && TEAMS_PANEL_HEADING_RE.test(layout)) {
    return layout.replace(TEAMS_PANEL_HEADING_RE, (heading) => `${heading}${trimmedBlob}`)
  }

  // Webinar: Blob nie ans Ende haengen — Slot oder Teams-Ueberschrift, sonst Layout unveraendert
  // (Graph haengt den Meeting-Block sonst zusaetzlich unten an und der Slot bleibt leer).
  if (isChronellWebinarInvitationHtml(layout)) {
    return layout
  }

  return `${layout}${trimmedBlob}`
}

/** Entfernt einen erkannten Teams-Join-Block aus HTML (fuer Merge vor Graph-Save). */
export function stripTeamsMeetingJoinBlockHtml(html: string | null | undefined): string {
  const raw = html?.trim() ?? ''
  if (!raw) return ''
  const preserved = preserveWebinarTeamsBlobSlot(raw)
  let working = preserved.html
  const block = extractTeamsMeetingJoinBlockHtml(working) || extractRawTeamsOnlineMeetingBlob(working)
  if (!block) {
    if (preserved.slotHtml) {
      return raw
    }
    return working
  }
  const idx = working.indexOf(block)
  if (idx >= 0) {
    working = `${working.slice(0, idx)}${working.slice(idx + block.length)}`.trim()
  } else if (!isChronellWebinarInvitationHtml(working)) {
    // Normaler Termin: Teams-Block liegt am Ende — ab Heading/URL abschneiden.
    const headingIdx = working.search(TEAMS_JOIN_HEADING_RE)
    if (headingIdx >= 0) working = working.slice(0, headingIdx).trim()
    else {
      const urlIdx = working.search(TEAMS_JOIN_URL_RE)
      if (urlIdx >= 0) {
        const before = working.slice(0, urlIdx)
        const blockStart = Math.max(
          before.lastIndexOf('<div'),
          before.lastIndexOf('<table'),
          before.lastIndexOf('<p'),
          before.lastIndexOf('<hr'),
          0
        )
        working = working.slice(0, blockStart).trim()
      }
    }
  }
  // Webinar ohne exakten Block-Match: nicht abschneiden — Layout (Umfrage/Hinweise) bleibt.
  if (preserved.slotHtml) {
    working = working.replace(WEBINAR_TEAMS_BLOB_SLOT_HOLD, preserved.slotHtml)
  }
  return working
}

/**
 * User-Beschreibung + originaler Graph-Meeting-Blob.
 * Laut Microsoft Learn: Body-Update einer Online-Besprechung muss den Meeting-Blob erhalten.
 */
export function mergeCalendarEventBodyPreservingTeamsMeetingBlob(
  userHtml: string | null | undefined,
  existingGraphBodyHtml: string | null | undefined
): string {
  const blob = extractRawTeamsOnlineMeetingBlob(existingGraphBodyHtml)
  const trimmedUser = userHtml?.trim() ?? ''
  const prepared = prepareCalendarEventBodyHtml(trimmedUser || null)

  if (isChronellWebinarInvitationHtml(trimmedUser) && prepared) {
    if (blob) {
      const layout = stripTeamsMeetingJoinBlockHtml(prepared) || prepared
      const merged = isEffectivelyEmptyCalendarBodyHtml(layout)
        ? injectTeamsMeetingBlobIntoWebinarInvitation(prepared, blob)
        : injectTeamsMeetingBlobIntoWebinarInvitation(layout, blob)
      return lightenEmbeddedTeamsMeetingBlobInWebinarHtml(
        dedupeRepeatedWebinarTailSections(merged)
      )
    }
    return lightenEmbeddedTeamsMeetingBlobInWebinarHtml(
      dedupeRepeatedWebinarTailSections(prepared)
    )
  }

  const userPart = prepared ? stripTeamsMeetingJoinBlockHtml(prepared) : ''

  if (blob) {
    if (!userPart || isEffectivelyEmptyCalendarBodyHtml(userPart)) {
      return blob
    }
    return injectTeamsMeetingBlobIntoWebinarInvitation(userPart, blob)
  }
  return prepared ?? '<p></p>'
}

/**
 * Kalender-Beschreibung fuer Microsoft Graph (contentType HTML) und Google `description`.
 * Wandelt Plain-Text in HTML um und linkifiziert nackte URLs.
 */
export function prepareCalendarEventBodyHtml(html: string | null | undefined): string | null {
  const trimmed = html?.trim().replace(/\0/g, '')
  if (!trimmed || isEffectivelyEmptyCalendarBodyHtml(trimmed)) return null

  const cleaned =
    !isChronellWebinarInvitationHtml(trimmed) &&
    /asyncgw\.teams\.microsoft\.com|amsauth=/i.test(trimmed)
      ? cleanTeamsMeetingJoinInformationHtml(trimmed)
      : trimmed

  if (!cleaned || isEffectivelyEmptyCalendarBodyHtml(cleaned)) return null

  if (/<[a-z][\s\S]*>/i.test(cleaned)) {
    return linkifyBareUrlsInHtmlFragment(cleaned)
  }

  return `<p>${linkifyEscapedHtml(escapeHtml(cleaned).replace(/\n/g, '<br>'))}</p>`
}
