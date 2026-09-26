/**
 * Festes Webinar-Einladungs-HTML (#kurtrocks): Outlook/Graph-tauglich mit bgcolor + Inline-Styles.
 * Den echten Microsoft-Teams-Meeting-Blob liefert Graph separat — kein eigener Meet-Link hier.
 */

import {
  getDefaultWebinarInvitationLayoutTemplate,
  normalizeWebinarLayoutTemplateSlots,
  renderWebinarInvitationLayoutTemplate,
  replaceBakedWebinarHeroPlaceholder,
  WEBINAR_HERO_PLACEHOLDER_SLOT_ID,
  type WebinarInvitationRenderContext
} from '@/lib/webinar-invitation-layout-template'
import {
  applyWebinarLayoutThemeColors,
  type WebinarLayoutThemeId
} from '@/lib/webinar-invitation-layout-themes'
import { isChronellWebinarInvitationHtml } from '@shared/chronell-webinar-calendar'

export { getDefaultWebinarInvitationLayoutTemplate, WEBINAR_HERO_PLACEHOLDER_SLOT_ID } from '@/lib/webinar-invitation-layout-template'
export type {
  WebinarLayoutColorId,
  WebinarLayoutModeId,
  WebinarLayoutThemeId
} from '@/lib/webinar-invitation-layout-themes'
export {
  WEBINAR_LAYOUT_COLOR_IDS,
  WEBINAR_LAYOUT_MODE_IDS,
  WEBINAR_LAYOUT_THEME_ACCENTS,
  WEBINAR_LAYOUT_THEME_IDS,
  makeWebinarLayoutThemeId,
  webinarLayoutThemeAccents,
  webinarLayoutThemeParts
} from '@/lib/webinar-invitation-layout-themes'

export type WebinarInvitationFields = {
  title: string
  /** data:, https: oder cid: fuer Hero/Plakat. */
  heroImageSrc: string | null
  surveyUrl: string
  surveyLabel: string
  websiteUrl: string
  websiteLabel: string
  scheduleLabel: string | null
  teamsJoinUrl?: string | null
  /** Leer = Standard-Begruessung. Plain-Text oder HTML. */
  greetingHtml?: string | null
  /** Zusaetzlicher Block vor „Hinweise & Hilfen“ (HTML). */
  supplementHtml?: string | null
  tipsHtml?: string | null
  /** Leer = Standard-Grußformel. Plain-Text oder HTML. */
  signOffHtml?: string | null
  signatureHtml?: string | null
  /** Optionales Layout mit {{greetingBlock}} … Platzhaltern (Einstellungen). */
  layoutHtmlTemplate?: string | null
  /** Baked-in Farbvariante (Standard/Blau/Gruen). */
  layoutTheme?: WebinarLayoutThemeId | null
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/'/g, '&#39;')
}

function normalizeHttpUrl(raw: string): string | null {
  const t = raw.trim()
  if (!t) return null
  if (/^https?:\/\//i.test(t)) return t
  if (/^mailto:/i.test(t)) return t
  if (/^www\./i.test(t)) return `https://${t}`
  return null
}

/** Farben — zusätzlich bgcolor auf <td> fuer Outlook. */
const C = {
  outer: '#0f0f0f',
  card: '#181818',
  panel: '#1f1f1f',
  border: '#2e2e2e',
  borderSoft: '#3a3a3a',
  text: '#f4f1ea',
  muted: '#b8b2a6',
  gold: '#c9a962',
  goldDark: '#8a7340',
  goldGlow: '#3d3420',
  link: '#e8d5a3',
  teamsPanel: '#151b28',
  teamsAccent: '#4f6bed',
  surveyBtn: '#234832',
  surveyBorder: '#3d6b4a',
  surveyText: '#e8f5ea',
  webBtn: '#242424',
  webBorder: '#3a3a3a'
} as const

const R = {
  sm: '6px',
  md: '10px',
  lg: '12px',
  pill: '999px'
} as const

const FONT = "Segoe UI, Helvetica Neue, Arial, sans-serif"

/** Outlook/Word: Link-Farbe nur mit innerem <span> zuverlaessig auf dunklem Hintergrund. */
export function webinarOutlookSafeLink(
  href: string,
  label: string,
  color: string = C.link
): string {
  const safeHref = escapeAttr(href)
  const safeLabel = escapeHtml(label)
  return [
    `<a href="${safeHref}" target="_blank" rel="noopener noreferrer"`,
    `style="color:${color};text-decoration:none;font-weight:500;mso-style-priority:100">`,
    `<span style="color:${color};text-decoration:none;font-weight:500">${safeLabel}</span>`,
    '</a>'
  ].join('')
}

export function hardenWebinarInvitationLinksForOutlook(html: string): string {
  if (!/<a\b/i.test(html)) return html
  return html.replace(/<a\b([^>]*?)>([\s\S]*?)<\/a>/gi, (_full, attrs: string, inner: string) => {
    const styleMatch = attrs.match(/\bstyle="([^"]*)"/i)
    const style = styleMatch?.[1] ?? ''
    const colorMatch = style.match(/(?:^|;)\s*color:\s*([^;'"]+)/i)
    const color = colorMatch?.[1]?.trim() || C.link
    let nextStyle = style
    if (!/color\s*:/i.test(nextStyle)) {
      nextStyle = `color:${color};text-decoration:none;${nextStyle}`.replace(/;+$/, '')
    }
    if (!/text-decoration\s*:/i.test(nextStyle)) {
      nextStyle = `${nextStyle};text-decoration:none`
    }
    if (!/mso-style-priority/i.test(nextStyle)) {
      nextStyle = `${nextStyle};mso-style-priority:100`
    }
    const nextAttrs = styleMatch
      ? attrs.replace(/\bstyle="[^"]*"/i, `style="${nextStyle}"`)
      : `${attrs.trim()} style="${nextStyle}"`
    const innerTrim = inner.trim()
    if (/^<span\b/i.test(innerTrim) && /style="[^"]*color:/i.test(innerTrim)) {
      return `<a${nextAttrs.startsWith(' ') ? nextAttrs : ` ${nextAttrs}`}>${inner}</a>`
    }
    return `<a${nextAttrs.startsWith(' ') ? nextAttrs : ` ${nextAttrs}`}><span style="color:${color};text-decoration:none;font-weight:inherit">${inner}</span></a>`
  })
}

const DEFAULT_GREETING_LINES_DE = [
  'Liebe Webinarteilnehmerin!',
  'Lieber Webinarteilnehmer!',
  'Mit dieser Nachricht bekommst du alle wichtigen Informationen zu folgendem Webinar'
] as const

const DEFAULT_GREETING_DE = DEFAULT_GREETING_LINES_DE.join('\n')

const DEFAULT_TIPS_DE = [
  'Keine Teams-Installation nötig — der Browser reicht.',
  'Tritt bitte kurz vor Beginn bei.',
  'Nutze deinen realen Namen (Teilnehmerliste).',
  'Am besten mit Microsoft-365-/Education-Konto.',
  'Zwei Bildschirme sind hilfreich, aber nicht Pflicht.',
  'Mikrofon und Kamera sind optional.',
  'Bei Problemen: Veranstaltungsseite bzw. Backup-Stream prüfen.'
]

const DEFAULT_SIGNOFF_DE =
  'Ich freue mich auf die Fortbildung und das gemeinsame Lernen!<br/>Mit lieben Grüßen'

export function defaultKurtrocksWebinarSignatureHtml(): string {
  const link = (href: string, label: string): string => webinarOutlookSafeLink(href, label, C.link)

  return [
    '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:640px;border-collapse:collapse;margin-top:4px">',
    `<tr><td bgcolor="${C.panel}" style="background-color:${C.panel};border:0;border-radius:${R.md};padding:22px 18px 10px;color:${C.text}">`,
    `<p style="margin:0 0 2px;font:700 16px/1.3 ${FONT};color:${C.text}">Kurt Söser</p>`,
    `<p style="margin:0 0 14px;font:600 11px/1.4 ${FONT};letter-spacing:0.06em;text-transform:uppercase;color:${C.gold}">Chief Inspiration Officer</p>`,
    `<p style="margin:0 0 8px;font:400 13px/1.6 ${FONT};color:${C.muted}">`,
    `<span style="color:${C.muted}">📧 </span>${link('mailto:kontakt@kurtrocks.com', 'kontakt@kurtrocks.com')}`,
    `<span style="color:${C.muted}"> &nbsp;&bull;&nbsp; 💬 </span>${link('https://teams.microsoft.com/l/chat/0/0?users=kontakt@kurtrocks.com', 'Connect via Teams')}`,
    `<span style="color:${C.muted}"> &nbsp;&bull;&nbsp; 📆 </span>${link('https://www.kurtrocks.com', 'Termin buchen')}`,
    '</p>',
    `<p style="margin:0 0 10px;font:400 13px/1.6 ${FONT};color:${C.muted}">`,
    `<span style="color:${C.muted}">🌍 </span>${link('https://www.kurtrocks.com', 'www.kurtrocks.com')}`,
    `<span style="color:${C.muted}"> &nbsp;&bull;&nbsp; </span>${link('https://www.ms365.schule', 'www.ms365.schule')}`,
    `<span style="color:${C.muted}"> &nbsp;&bull;&nbsp; 🕝 </span>${link('https://chronell.app', 'chronell.app')}`,
    '</p>',
    `<p style="margin:0;font:600 12px/1.4 ${FONT};color:${C.gold}"><span style="color:${C.gold}"><strong>#kurtrocks</strong></span> <span style="color:${C.muted}">edu.innovation.consulting</span></p>`,
    '</td></tr></table>'
  ].join('')
}

function buildDefaultWebinarGreetingParagraphsHtml(): string {
  const [line1, line2, line3] = DEFAULT_GREETING_LINES_DE
  const p = (text: string, marginBottom: string): string =>
    `<p style="margin:0 0 ${marginBottom};font:400 14px/1.6 ${FONT};color:${C.muted}">${escapeHtml(text)}</p>`
  return [p(line1, '10px'), p(line2, '10px'), p(line3, '0')].join('')
}

export function defaultWebinarGreetingHtml(): string {
  return buildDefaultWebinarGreetingParagraphsHtml()
}

function buildWebinarTipsTableRows(lines: string[]): string {
  return lines
    .map((line) => line.trim())
    .filter(Boolean)
    .map(
      (tip) =>
        `<tr><td width="26" valign="top" style="padding:0 0 12px">` +
        `<span style="display:inline-block;width:20px;height:20px;line-height:20px;text-align:center;border-radius:50%;background-color:${C.goldGlow};border:1px solid ${C.goldDark};color:${C.gold};font-size:11px">✦</span></td>` +
        `<td valign="top" style="padding:0 0 12px;font:400 13px/1.55 ${FONT};color:${C.muted}">${escapeHtml(tip)}</td></tr>`
    )
    .join('')
}

export function defaultWebinarTipsPlainText(): string {
  return DEFAULT_TIPS_DE.join('\n')
}

export function defaultWebinarTipsHtml(): string {
  return buildWebinarTipsTableRows(DEFAULT_TIPS_DE)
}

/** Plain-Text (eine Zeile = ein Tipp) oder fertige HTML-Tabellenzeilen. */
export function normalizeWebinarTipsHtmlInput(raw: string | null | undefined): string {
  const trimmed = raw?.trim() ?? ''
  if (!trimmed) return ''
  if (/<tr\b/i.test(trimmed)) return trimmed
  if (/<[a-z][\s\S]*>/i.test(trimmed)) return trimmed
  return buildWebinarTipsTableRows(trimmed.split(/\r?\n/))
}

export function defaultWebinarSignOffHtml(): string {
  return DEFAULT_SIGNOFF_DE
}

/** Plain-Text oder HTML aus Formularfeldern — Zeilenumbrueche werden zu <br>. */
export function normalizeWebinarUserHtmlInput(raw: string | null | undefined): string {
  const trimmed = raw?.trim() ?? ''
  if (!trimmed) return ''
  if (/<[a-z][\s\S]*>/i.test(trimmed)) return trimmed
  return escapeHtml(trimmed).replace(/\n/g, '<br/>')
}

function buildWebinarGreetingHtml(fields: WebinarInvitationFields): string {
  const custom = normalizeWebinarUserHtmlInput(fields.greetingHtml)
  return custom || defaultWebinarGreetingHtml()
}

function buildWebinarSignOffHtml(fields: WebinarInvitationFields): string {
  const custom = normalizeWebinarUserHtmlInput(fields.signOffHtml)
  return custom || defaultWebinarSignOffHtml()
}

export function buildWebinarTeamsSlotInnerHtml(teamsJoinUrl?: string | null): string {
  const joinUrl = teamsJoinUrl?.trim()
  if (joinUrl) {
    return [
      `<p style="margin:10px 0 0;font:400 13px/1.5 ${FONT};color:${C.muted}">`,
      `<a href="${escapeAttr(joinUrl)}" target="_blank" rel="noopener noreferrer" style="color:${C.link};font-weight:600;text-decoration:none;mso-style-priority:100">`,
      `<span style="color:${C.link};font-weight:600;text-decoration:none">▶ Teams-Besprechung beitreten</span>`,
      '</a>',
      '</p>'
    ].join('')
  }
  return [
    `<p style="margin:10px 0 0;font:400 13px/1.5 ${FONT};color:${C.muted}">`,
    'Der Beitritt erfolgt über die ',
    `<strong style="color:${C.text}">Teams-Besprechung</strong> dieses Termins. `,
    'Beim Speichern wird hier der offizielle Microsoft-Zugangsblock eingefügt.',
    '</p>'
  ].join('')
}

function ctaRow(
  href: string,
  label: string,
  bg: string,
  color: string,
  _borderColor: string,
  icon: string
): string {
  const safeLabel = escapeHtml(label)
  return [
    '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:640px;border-collapse:collapse;margin:12px 0 8px">',
    `<tr><td align="center" bgcolor="${bg}" style="background-color:${bg};border:0;border-radius:${R.md}">`,
    `<a href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer" style="display:block;padding:14px 20px;font:700 15px/1.2 ${FONT};color:${color};text-decoration:none;text-align:center;mso-style-priority:100">`,
    `<span style="color:${color};text-decoration:none;font-weight:700">${icon}&nbsp; ${safeLabel}</span>`,
    '</a>',
    '</td></tr></table>'
  ].join('')
}

export function buildWebinarHeroImageBlockHtml(heroSrc: string, title: string): string {
  const hero = heroSrc.trim()
  return [
    '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin:0 0 24px">',
    `<tr><td bgcolor="${C.card}" style="background-color:${C.card};border:0;border-radius:${R.lg};padding:0">`,
    '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse">',
    '<tr><td align="center">',
    `<img src="${escapeAttr(hero)}" alt="${escapeAttr(title)}" width="540" style="display:block;width:100%;max-width:540px;height:auto;border:0;border-radius:${R.md}" />`,
    '</td></tr></table>',
    '</td></tr></table>'
  ].join('')
}

/** Sichtbarer Hero-Platzhalter in Vorlage & Editor. */
export function buildWebinarHeroImageSlotPreviewHtml(label: string): string {
  return [
    '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin:0 0 24px">',
    `<tr><td id="${WEBINAR_HERO_PLACEHOLDER_SLOT_ID}" bgcolor="${C.goldGlow}" style="background-color:${C.goldGlow};border:2px dashed ${C.gold};border-radius:${R.lg};padding:40px 20px;text-align:center">`,
    `<p style="margin:0 0 10px;font-size:36px;line-height:1">🖼️</p>`,
    `<p style="margin:0 0 6px;font:700 11px/1.3 ${FONT};letter-spacing:0.14em;text-transform:uppercase;color:${C.gold}">Hero-Bild · Plakat</p>`,
    `<p style="margin:0 0 8px;font:500 14px/1.5 ${FONT};color:${C.text}">${escapeHtml(label)}</p>`,
    `<p style="margin:0;font:400 11px/1.5 ${FONT};color:${C.muted}">Empfohlen 1200 × 630 px · JPG oder PNG · pro Termin im Webinar-Dialog</p>`,
    '</td></tr></table>'
  ].join('')
}

function buildWebinarSectionHeading(icon: string, title: string): string {
  return [
    `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin:0 0 10px">`,
    `<tr><td style="padding:0">`,
    `<span style="font:700 11px/1.2 ${FONT};letter-spacing:0.12em;text-transform:uppercase;color:${C.gold}">${icon}&nbsp; ${escapeHtml(title)}</span>`,
    `<span style="display:block;margin-top:8px;height:1px;background-color:${C.border}"></span>`,
    '</td></tr></table>'
  ].join('')
}

export function buildWebinarInvitationRenderContext(
  fields: WebinarInvitationFields
): WebinarInvitationRenderContext {
  const title = fields.title.trim() || 'Webinar'
  const schedule = fields.scheduleLabel?.trim() || ''
  const surveyUrl = normalizeHttpUrl(fields.surveyUrl)
  const websiteUrl = normalizeHttpUrl(fields.websiteUrl)
  const hero = fields.heroImageSrc?.trim() || null
  const surveyLabel = fields.surveyLabel.trim() || 'Umfrage ausfüllen'
  const websiteLabel = fields.websiteLabel.trim() || 'Veranstaltungsseite'
  const greeting = buildWebinarGreetingHtml(fields)
  const tipsRows = normalizeWebinarTipsHtmlInput(fields.tipsHtml) || defaultWebinarTipsHtml()
  const signOff = buildWebinarSignOffHtml(fields)
  const supplement = normalizeWebinarUserHtmlInput(fields.supplementHtml)
  const signature = fields.signatureHtml?.trim() || defaultKurtrocksWebinarSignatureHtml()

  const greetingBlock = [
    '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin:0 0 20px">',
    `<tr><td bgcolor="${C.card}" style="background-color:${C.card};border:1px solid ${C.border};border-left:4px solid ${C.gold};border-radius:0 ${R.md} ${R.md} 0;padding:16px 18px">`,
    greeting,
    '</td></tr></table>'
  ].join('')

  const titleBlock = [
    '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin:0 0 16px">',
    `<tr><td bgcolor="${C.card}" style="background-color:${C.card};border:0;border-radius:${R.md};padding:18px 20px">`,
    `<p style="margin:0 0 8px;font:700 11px/1.2 ${FONT};letter-spacing:0.14em;text-transform:uppercase;color:${C.gold}">🎓&nbsp; Webinar</p>`,
    `<p style="margin:0 0 12px;font:700 28px/1.2 ${FONT};color:${C.text}">${escapeHtml(title)}</p>`,
    `<table role="presentation" cellpadding="0" cellspacing="0" width="72" style="border-collapse:collapse;margin:0"><tr><td height="3" bgcolor="${C.gold}" style="background-color:${C.gold};border-radius:${R.pill};font-size:0;line-height:0">&nbsp;</td></tr></table>`,
    '</td></tr></table>'
  ].join('')

  const scheduleBlock = schedule
    ? [
        '<table id="chronell-webinar-schedule" role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 22px">',
        `<tr><td bgcolor="${C.panel}" style="background-color:${C.panel};border:0;border-radius:${R.pill};padding:9px 16px">`,
        `<span style="font:500 13px/1.4 ${FONT};letter-spacing:0.02em;color:${C.gold}">📅&nbsp;</span>`,
        `<span style="font:500 13px/1.4 ${FONT};letter-spacing:0.02em;color:${C.text}">${escapeHtml(schedule)}</span>`,
        '</td></tr></table>'
      ].join('')
    : ''

  const heroImageBlock = hero ? buildWebinarHeroImageBlockHtml(hero, title) : ''

  const teamsBlock = [
    '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin:0 0 24px">',
    `<tr><td bgcolor="${C.teamsPanel}" style="background-color:${C.teamsPanel};border:1px solid #2a3348;border-left:4px solid ${C.teamsAccent};border-radius:0 ${R.md} ${R.md} 0;padding:16px 18px">`,
    `<p style="margin:0 0 4px;font:700 11px/1.2 ${FONT};letter-spacing:0.1em;text-transform:uppercase;color:${C.gold}">🎥&nbsp; Microsoft Teams</p>`,
    `<p style="margin:0 0 2px;font:400 13px/1.45 ${FONT};color:${C.muted}">Live dabei sein — Link bzw. Microsoft-Zugangsblock:</p>`,
    `<span id="chronell-webinar-teams-slot">${buildWebinarTeamsSlotInnerHtml(fields.teamsJoinUrl)}</span>`,
    '</td></tr></table>'
  ].join('')

  const surveyParts: string[] = []
  if (surveyUrl) {
    surveyParts.push(buildWebinarSectionHeading('📋', 'Kurze Umfrage'))
    surveyParts.push(
      `<p style="margin:0 0 2px;font:400 14px/1.5 ${FONT};color:${C.muted}">Zur Vorbereitung — dauert nur eine Minute:</p>`
    )
    surveyParts.push(ctaRow(surveyUrl, surveyLabel, C.surveyBtn, C.surveyText, C.surveyBorder, '📝'))
  }

  const websiteParts: string[] = []
  if (websiteUrl) {
    websiteParts.push(buildWebinarSectionHeading('🌐', 'Veranstaltungsseite'))
    websiteParts.push(
      `<p style="margin:0 0 2px;font:400 14px/1.5 ${FONT};color:${C.muted}">Infos, Unterlagen und Aufzeichnungen:</p>`
    )
    websiteParts.push(ctaRow(websiteUrl, websiteLabel, C.webBtn, C.text, C.webBorder, '🔗'))
  }

  const supplementBlock = supplement
    ? [
        `<div id="chronell-webinar-supplement" style="margin:18px 0 24px;padding:14px 16px;border:1px solid ${C.border};border-radius:${R.md};background-color:${C.card};font:400 14px/1.55 ${FONT};color:${C.muted}">`,
        supplement,
        '</div>'
      ].join('')
    : ''

  const tipsBlock = [
    buildWebinarSectionHeading('💡', 'Hinweise & Hilfen'),
    '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin:0 0 24px">',
    `<tr><td bgcolor="${C.card}" style="background-color:${C.card};border:1px solid ${C.border};border-radius:${R.md};padding:16px 18px">`,
    `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse">${tipsRows}</table>`,
    '</td></tr></table>'
  ].join('\n')

  const signOffBlock = [
    '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin:8px 0 16px">',
    `<tr><td style="padding:0 0 0 4px;border-left:2px solid ${C.goldDark}">`,
    `<p style="margin:0;font:400 14px/1.6 ${FONT};color:${C.muted}">✨ ${signOff}</p>`,
    '</td></tr></table>'
  ].join('')

  return {
    greetingBlock,
    titleBlock,
    scheduleBlock,
    heroImageBlock,
    teamsBlock,
    surveyBlock: surveyParts.join('\n'),
    websiteBlock: websiteParts.join('\n'),
    supplementBlock,
    tipsBlock,
    signOffBlock,
    signature
  }
}

export function buildWebinarInvitationHtml(fields: WebinarInvitationFields): string {
  const theme: WebinarLayoutThemeId = fields.layoutTheme ?? 'gold'
  const title = fields.title.trim() || 'Webinar'
  const hero = fields.heroImageSrc?.trim() || null
  const context = buildWebinarInvitationRenderContext(fields)
  if (hero) {
    context.heroImageBlock = buildWebinarHeroImageBlockHtml(hero, title)
  }
  // Custom-Layout aus Katalog/Defaults fuer alle Themes (Basis-Hex → Recolor).
  const customLayout = fields.layoutHtmlTemplate?.trim()
  const template = normalizeWebinarLayoutTemplateSlots(
    customLayout || getDefaultWebinarInvitationLayoutTemplate('gold')
  )
  const html = replaceBakedWebinarHeroPlaceholder(
    renderWebinarInvitationLayoutTemplate(template, context),
    context.heroImageBlock
  )
  return applyWebinarLayoutThemeColors(html, theme)
}

/** Aktualisiert nur die Terminzeile — ohne restliches TN-HTML zu ueberschreiben. */
export function patchWebinarInvitationScheduleLabel(
  html: string,
  scheduleLabel: string | null
): string {
  const label = scheduleLabel?.trim()
  if (!label) return html
  const escaped = label
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  const replacement = [
    '<table id="chronell-webinar-schedule" role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 22px">',
    `<tr><td bgcolor="#1f1f1f" style="background-color:#1f1f1f;border:0;border-radius:999px;padding:9px 16px">`,
    `<span style="font:500 13px/1.4 Segoe UI, Helvetica Neue, Arial, sans-serif;letter-spacing:0.02em;color:#c9a962">📅&nbsp;</span>`,
    `<span style="font:500 13px/1.4 Segoe UI, Helvetica Neue, Arial, sans-serif;letter-spacing:0.02em;color:#f4f1ea">${escaped}</span>`,
    '</td></tr></table>'
  ].join('')
  const schedulePattern = /<table id="chronell-webinar-schedule"[\s\S]*?<\/table>/i
  if (schedulePattern.test(html)) {
    return html.replace(schedulePattern, replacement)
  }
  const legacySchedulePattern =
    /<p style="margin:0 0 20px;font:500 13px\/1\.4[^"]*"[^>]*>[\s\S]*?<\/p>/i
  if (legacySchedulePattern.test(html)) {
    return html.replace(legacySchedulePattern, replacement)
  }
  const titleHeadingPattern =
    /(<p style="margin:0 0 12px;font:700 28px[^"]*"[^>]*>[\s\S]*?<\/p>[\s\S]*?<table role="presentation" cellpadding="0" cellspacing="0" width="72"[\s\S]*?<\/table>)/i
  if (titleHeadingPattern.test(html)) {
    return html.replace(titleHeadingPattern, `$1\n${replacement}`)
  }
  return html.replace(
    /(<p style="margin:0 0 6px;font:700 24px[^"]*"[^>]*>[\s\S]*?<\/p>)/i,
    `$1\n${replacement}`
  )
}

/** Aktualisiert nur den Webinar-Titel — ohne restliches TN-HTML zu ueberschreiben. */
export function patchWebinarInvitationTitle(html: string, title: string | null): string {
  const label = title?.trim()
  if (!label) return html
  const escaped = label
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  const replacement = `<p style="margin:0 0 12px;font:700 28px/1.2 Segoe UI, Helvetica Neue, Arial, sans-serif;color:#f4f1ea">${escaped}</p>`
  const currentTitlePattern =
    /<p style="margin:0 0 12px;font:700 28px[^"]*"[^>]*>[\s\S]*?<\/p>/i
  if (currentTitlePattern.test(html)) {
    return html.replace(currentTitlePattern, replacement)
  }
  const legacyTitlePattern = /<p style="margin:0 0 6px;font:700 24px[^"]*"[^>]*>[\s\S]*?<\/p>/i
  if (legacyTitlePattern.test(html)) {
    return html.replace(legacyTitlePattern, replacement)
  }
  return html
}

function patchWebinarCtaHrefByBgcolor(html: string, bgcolor: string, url: string): string {
  const safe = escapeAttr(url)
  const re = new RegExp(
    `((?:bgcolor="${bgcolor}"|background-color:\\s*${bgcolor})[\\s\\S]*?<a\\b)([^>]*)(>)`,
    'i'
  )
  return html.replace(re, (_m, before: string, attrs: string, after: string) => {
    let next = attrs.replace(/\bhref\s*=\s*["'][^"']*["']/i, `href="${safe}"`)
    if (!/\bhref\s*=/i.test(next)) next = `${next} href="${safe}"`
    next = next.replace(/\s*\bdata-mail-external\s*=\s*["'][^"']*["']/i, '')
    return `${before}${next}${after}`
  })
}

/**
 * Schreibt Umfrage-/Website-URLs aus dem Formular zurueck in die CTA-Buttons —
 * damit Speichern die Links behält, auch ohne „Layout wiederherstellen“.
 */
export function patchWebinarInvitationCtaLinks(
  html: string,
  opts: { surveyUrl?: string | null; websiteUrl?: string | null }
): string {
  let out = html
  const survey = opts.surveyUrl?.trim()
  const website = opts.websiteUrl?.trim()
  if (survey && /^https?:\/\//i.test(survey)) {
    out = patchWebinarCtaHrefByBgcolor(out, '#234832', survey)
    out = patchWebinarCtaHrefByBgcolor(out, '#2f5a3a', survey)
  }
  if (website && /^https?:\/\//i.test(website)) {
    out = patchWebinarCtaHrefByBgcolor(out, '#242424', website)
    out = patchWebinarCtaHrefByBgcolor(out, '#2a2a2a', website)
  }
  return out
}

function buildWebinarSurveyBlockHtml(url: string, label: string): string {
  return [
    buildWebinarSectionHeading('📋', 'Kurze Umfrage'),
    `<p style="margin:0 0 2px;font:400 14px/1.5 ${FONT};color:${C.muted}">Zur Vorbereitung — dauert nur eine Minute:</p>`,
    ctaRow(url, label, C.surveyBtn, C.surveyText, C.surveyBorder, '📝')
  ].join('\n')
}

function buildWebinarWebsiteBlockHtml(url: string, label: string): string {
  return [
    buildWebinarSectionHeading('🌐', 'Veranstaltungsseite'),
    `<p style="margin:0 0 2px;font:400 14px/1.5 ${FONT};color:${C.muted}">Infos, Unterlagen und Aufzeichnungen:</p>`,
    ctaRow(url, label, C.webBtn, C.text, C.webBorder, '🔗')
  ].join('\n')
}

/** Fuegt fehlende Umfrage-/Website-Bloecke vor dem Teams-Panel ein (Truncation-sicher). */
export function ensureWebinarInvitationCtaSections(
  html: string,
  opts: {
    surveyUrl?: string | null
    surveyLabel?: string | null
    websiteUrl?: string | null
    websiteLabel?: string | null
  }
): string {
  if (!isChronellWebinarInvitationHtml(html)) return html
  let out = html
  const surveyUrl = normalizeHttpUrl(opts.surveyUrl ?? '')
  const websiteUrl = normalizeHttpUrl(opts.websiteUrl ?? '')
  const surveyLabel = opts.surveyLabel?.trim() || 'Umfrage ausfüllen'
  const websiteLabel = opts.websiteLabel?.trim() || 'Veranstaltungsseite'

  const insertBeforeTeamsOrTips = (block: string): void => {
    if (!block.trim()) return
    // Vor Microsoft-Teams-Panel (dekorative Ueberschrift)
    const teamsPanel = /<table\b[^>]*>\s*<tr>\s*<td\b[^>]*bgcolor="#151b28"[^>]*>/i
    if (teamsPanel.test(out)) {
      out = out.replace(teamsPanel, `${block}\n$&`)
      return
    }
    const teamsHeading =
      /<p\b[^>]*>[\s\S]*?Microsoft\s+Teams[\s\S]*?<\/p>/i
    if (teamsHeading.test(out)) {
      out = out.replace(teamsHeading, `${block}\n$&`)
      return
    }
    const tips = /Hinweise\s*(?:&amp;|&)\s*Hilfen/i
    if (tips.test(out)) {
      const idx = out.search(tips)
      // vor dem Tips-Heading-Table
      const before = out.slice(0, idx)
      const tableStart = Math.max(before.lastIndexOf('<table'), before.lastIndexOf('<div'))
      const at = tableStart >= 0 ? tableStart : idx
      out = `${out.slice(0, at)}${block}\n${out.slice(at)}`
      return
    }
    out = `${out.trimEnd()}\n${block}`
  }

  const hasSurveySection = /📋[\s\S]{0,80}Kurze\s+Umfrage|bgcolor="#234832"/i.test(out)
  const hasWebsiteSection = /🌐[\s\S]{0,80}Veranstaltungsseite|bgcolor="#242424"/i.test(out)

  if (surveyUrl && !hasSurveySection) {
    insertBeforeTeamsOrTips(buildWebinarSurveyBlockHtml(surveyUrl, surveyLabel))
  }
  // Nach Survey-Insert erneut pruefen (out kann sich geaendert haben)
  const outAfterSurvey = out
  const hasWebsiteAfter = /🌐[\s\S]{0,80}Veranstaltungsseite|bgcolor="#242424"/i.test(outAfterSurvey)
  if (websiteUrl && !hasWebsiteAfter) {
    insertBeforeTeamsOrTips(buildWebinarWebsiteBlockHtml(websiteUrl, websiteLabel))
  }

  return patchWebinarInvitationCtaLinks(out, {
    surveyUrl: surveyUrl ?? undefined,
    websiteUrl: websiteUrl ?? undefined
  })
}
