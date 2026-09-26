import {
  applyWebinarLayoutThemeColors,
  WEBINAR_LAYOUT_THEME_ACCENTS,
  type WebinarLayoutThemeId
} from '@/lib/webinar-invitation-layout-themes'

export const WEBINAR_INVITATION_DYNAMIC_PLACEHOLDERS = [
  'titleBlock',
  'scheduleBlock',
  'heroImageBlock',
  'teamsBlock',
  'surveyBlock',
  'websiteBlock'
] as const

/** Layout-Version — bei Erhoehung wird die gespeicherte Vorlage migriert (nicht geloescht). */
export const WEBINAR_INVITATION_LAYOUT_TEMPLATE_VERSION = 6

export const WEBINAR_HERO_PLACEHOLDER_SLOT_ID = 'chronell-webinar-hero-slot'

/** Ersetzt fest eingebackenen Hero-Platzhalter wieder durch {{heroImageBlock}}. */
export function normalizeWebinarLayoutTemplateSlots(template: string): string {
  let html = template.trim()
  if (!html) return html
  html = ensureWebinarLayoutCoreSlots(html)
  if (html.includes('{{heroImageBlock}}')) return html
  const heroTableRe = new RegExp(
    `<table\\b[\\s\\S]*?\\bid="${WEBINAR_HERO_PLACEHOLDER_SLOT_ID}"[\\s\\S]*?<\\/table>`,
    'i'
  )
  if (heroTableRe.test(html)) {
    html = html.replace(heroTableRe, '{{heroImageBlock}}')
  }
  return html
}

const WEBINAR_CORE_LAYOUT_SLOTS = ['greetingBlock', 'titleBlock', 'scheduleBlock'] as const

const WEBINAR_CORE_SLOT_INSERT_AFTER: Partial<
  Record<(typeof WEBINAR_CORE_LAYOUT_SLOTS)[number], string>
> = {
  titleBlock: '{{greetingBlock}}',
  scheduleBlock: '{{titleBlock}}'
}

/** Fehlende Kern-Slots (Begruessung, Titel, Termin) in aelteren Vorlagen ergaenzen. */
export function ensureWebinarLayoutCoreSlots(template: string): string {
  let html = template.trim()
  if (!html) return html
  for (const slot of WEBINAR_CORE_LAYOUT_SLOTS) {
    if (html.includes(`{{${slot}}}`)) continue
    const anchor = WEBINAR_CORE_SLOT_INSERT_AFTER[slot]
    if (anchor && html.includes(anchor)) {
      html = html.replace(anchor, `${anchor}\n{{${slot}}}`)
      continue
    }
    html = `{{${slot}}}\n${html}`
  }
  return html
}

/** @deprecated — nutzt {@link ensureWebinarLayoutCoreSlots}. */
export function ensureWebinarLayoutGreetingSlot(template: string): string {
  return ensureWebinarLayoutCoreSlots(template)
}

export function replaceBakedWebinarHeroPlaceholder(html: string, heroImageBlock: string): string {
  const block = heroImageBlock.trim()
  if (!block) return html
  const heroTableRe = new RegExp(
    `<table\\b[\\s\\S]*?\\bid="${WEBINAR_HERO_PLACEHOLDER_SLOT_ID}"[\\s\\S]*?<\\/table>`,
    'i'
  )
  return heroTableRe.test(html) ? html.replace(heroTableRe, block) : html
}

/** Legacy + dynamische Platzhalter — alte Vorlagen bleiben gueltig. */
export const WEBINAR_INVITATION_LAYOUT_PLACEHOLDERS = [
  'greetingBlock',
  ...WEBINAR_INVITATION_DYNAMIC_PLACEHOLDERS,
  'supplementBlock',
  'tipsBlock',
  'signOffBlock',
  'signature'
] as const

export type WebinarInvitationRenderContext = Record<
  (typeof WEBINAR_INVITATION_LAYOUT_PLACEHOLDERS)[number],
  string
>

const C = {
  outer: '#0f0f0f',
  inner: '#141414',
  border: '#2e2e2e',
  gold: WEBINAR_LAYOUT_THEME_ACCENTS.gold.accent,
  goldDark: WEBINAR_LAYOUT_THEME_ACCENTS.gold.accentDark
} as const

const FONT = 'Segoe UI, Helvetica Neue, Arial, sans-serif'

/** Kurtrocks-Standardlayout v3 — abgerundet, Icons, sichtbarer Hero-Slot. */
export function getDefaultWebinarInvitationLayoutTemplate(
  theme: WebinarLayoutThemeId = 'gold'
): string {
  const goldHtml = [
    '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" bgcolor="' + C.outer + '" style="max-width:640px;width:100%;border-collapse:collapse;background-color:' + C.outer + ';border:1px solid ' + C.border + ';border-radius:12px">',
    `<tr><td height="5" bgcolor="${C.gold}" style="background-color:${C.gold};font-size:0;line-height:0">&nbsp;</td></tr>`,
    `<tr><td bgcolor="${C.inner}" style="background-color:${C.inner};padding:10px 28px 0;font-family:${FONT}">`,
    '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin:0 0 18px">',
    '<tr><td align="center">',
    `<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr><td bgcolor="${C.outer}" style="background-color:${C.outer};border:1px solid ${C.goldDark};border-radius:999px;padding:7px 16px">`,
    `<span style="font:700 10px/1.2 ${FONT};letter-spacing:0.16em;text-transform:uppercase;color:${C.gold}">✨&nbsp; #kurtrocks · Webinar-Einladung</span>`,
    '</td></tr></table>',
    '</td></tr></table>',
    '</td></tr>',
    `<tr><td bgcolor="${C.inner}" style="background-color:${C.inner};padding:0 28px 28px;font-family:${FONT}">`,
    '{{greetingBlock}}',
    '{{titleBlock}}',
    '{{scheduleBlock}}',
    '{{heroImageBlock}}',
    '{{surveyBlock}}',
    '{{websiteBlock}}',
    '{{teamsBlock}}',
    '{{supplementBlock}}',
    '{{tipsBlock}}',
    '{{signOffBlock}}',
    '{{signature}}',
    '</td></tr></table>'
  ].join('\n')
  return applyWebinarLayoutThemeColors(goldHtml, theme)
}

export function renderWebinarInvitationLayoutTemplate(
  template: string,
  context: WebinarInvitationRenderContext
): string {
  let html = template
  for (const key of WEBINAR_INVITATION_LAYOUT_PLACEHOLDERS) {
    html = html.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), context[key] ?? '')
  }
  return html
}

export function webinarInvitationLayoutTemplateIssues(template: string): string[] {
  const issues: string[] = []
  const trimmed = template.trim()
  if (!trimmed) return issues
  if (!/chronell-webinar-teams-slot/i.test(trimmed) && !/\{\{teamsBlock\}\}/.test(trimmed)) {
    issues.push('missingTeamsSlot')
  }
  return issues
}
