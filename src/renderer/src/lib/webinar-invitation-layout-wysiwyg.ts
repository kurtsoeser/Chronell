import type { WebinarInvitationFields } from '@/lib/build-webinar-invitation-html'
import {
  buildWebinarHeroImageSlotPreviewHtml,
  buildWebinarInvitationRenderContext
} from '@/lib/build-webinar-invitation-html'
import type { WebinarInvitationDefaults } from '@/lib/webinar-invitation-defaults-storage'
import { resolveWebinarDefaultsLayoutHtml } from '@/lib/webinar-invitation-defaults-storage'
import {
  getDefaultWebinarInvitationLayoutTemplate,
  normalizeWebinarLayoutTemplateSlots,
  WEBINAR_INVITATION_DYNAMIC_PLACEHOLDERS,
  WEBINAR_INVITATION_LAYOUT_PLACEHOLDERS,
  type WebinarInvitationRenderContext
} from '@/lib/webinar-invitation-layout-template'
import { WEBINAR_HERO_PLACEHOLDER_SLOT_ID } from '@/lib/webinar-invitation-layout-template'

export const WEBINAR_LAYOUT_WYSIWYG_PROTECTED_SELECTORS = [
  '#chronell-webinar-teams-slot',
  `#${WEBINAR_HERO_PLACEHOLDER_SLOT_ID}`,
  '[data-chronell-layout-slot]'
] as const

const SAMPLE_TITLE = 'Beispiel-Webinar'
const SAMPLE_SCHEDULE = 'Freitag, 1. Januar 2027 | 18:00 – 19:00'
const SAMPLE_TEAMS_URL = 'https://teams.microsoft.com/l/meetup-join/beispiel'

export function buildWebinarSettingsSampleFields(
  defaults: WebinarInvitationDefaults
): WebinarInvitationFields {
  return {
    title: SAMPLE_TITLE,
    heroImageSrc: defaults.defaultHeroImageSrc,
    surveyUrl: defaults.defaultSurveyUrl.trim() || 'https://forms.office.com/beispiel',
    surveyLabel: defaults.surveyLabel.trim() || 'Umfrage ausfüllen',
    websiteUrl: defaults.defaultWebsiteUrl.trim() || 'https://www.kurtrocks.com/beispiel',
    websiteLabel: defaults.websiteLabel.trim() || 'Veranstaltungsseite',
    scheduleLabel: SAMPLE_SCHEDULE,
    teamsJoinUrl: SAMPLE_TEAMS_URL,
    greetingHtml: defaults.greetingHtml,
    tipsHtml: defaults.tipsHtml,
    signOffHtml: defaults.signOffHtml,
    signatureHtml: defaults.signatureHtml
  }
}

export function buildWebinarSettingsSampleContext(
  defaults: WebinarInvitationDefaults,
  heroPreviewLabel: string
): WebinarInvitationRenderContext {
  const context = buildWebinarInvitationRenderContext(buildWebinarSettingsSampleFields(defaults))
  if (!context.heroImageBlock.trim()) {
    context.heroImageBlock = buildWebinarHeroImageSlotPreviewHtml(heroPreviewLabel)
  }
  return context
}

const SLOT_INSERT_AFTER: Partial<
  Record<(typeof WEBINAR_INVITATION_DYNAMIC_PLACEHOLDERS)[number], string>
> = {
  titleBlock: '{{greetingBlock}}',
  scheduleBlock: '{{titleBlock}}',
  heroImageBlock: '{{scheduleBlock}}',
  surveyBlock: '{{heroImageBlock}}',
  websiteBlock: '{{surveyBlock}}',
  teamsBlock: '{{websiteBlock}}'
}

export function webinarLayoutTemplateHasSlot(
  template: string,
  slot: (typeof WEBINAR_INVITATION_DYNAMIC_PLACEHOLDERS)[number]
): boolean {
  return template.includes(`{{${slot}}}`)
}

export function insertWebinarLayoutSlotIntoTemplate(
  template: string,
  slot: (typeof WEBINAR_INVITATION_DYNAMIC_PLACEHOLDERS)[number]
): string {
  if (webinarLayoutTemplateHasSlot(template, slot)) return template
  const anchor = SLOT_INSERT_AFTER[slot]
  if (anchor && template.includes(anchor)) {
    return template.replace(anchor, `${anchor}\n{{${slot}}}`)
  }
  if (template.includes('{{teamsBlock}}')) {
    return template.replace('{{teamsBlock}}', `{{${slot}}}\n{{teamsBlock}}`)
  }
  return `${template.trim()}\n{{${slot}}}`
}

export function insertWebinarLayoutSlotIntoEditorHtml(
  editorHtml: string,
  slot: (typeof WEBINAR_INVITATION_DYNAMIC_PLACEHOLDERS)[number],
  slotInnerHtml: string
): string {
  if (editorHtml.includes(`data-chronell-layout-slot="${slot}"`)) return editorHtml
  const wrapped = wrapProtectedLayoutSlot(slot, slotInnerHtml)
  if (typeof DOMParser === 'undefined') return `${editorHtml}\n${wrapped}`

  const doc = new DOMParser().parseFromString(
    `<div id="chronell-layout-root">${editorHtml}</div>`,
    'text/html'
  )
  const root = doc.getElementById('chronell-layout-root')
  if (!root) return `${editorHtml}\n${wrapped}`

  const afterSlot = SLOT_INSERT_AFTER[slot]?.replace(/\{\{|\}\}/g, '') ?? 'scheduleBlock'
  const anchor = root.querySelector(`[data-chronell-layout-slot="${afterSlot}"]`)
  if (anchor) {
    anchor.insertAdjacentHTML('afterend', wrapped)
    return root.innerHTML.trim()
  }

  const teams = root.querySelector('[data-chronell-layout-slot="teamsBlock"]')
  if (teams) {
    teams.insertAdjacentHTML('beforebegin', wrapped)
    return root.innerHTML.trim()
  }

  root.insertAdjacentHTML('beforeend', wrapped)
  return root.innerHTML.trim()
}

function wrapProtectedLayoutSlot(slot: string, innerHtml: string): string {
  return [
    `<div data-chronell-layout-slot="${slot}" contenteditable="false" data-wysiwyg-protected="true"`,
    `style="display:block;outline:1px dashed rgba(201,169,98,0.35);outline-offset:3px">`,
    innerHtml,
    '</div>'
  ].join('')
}

/** Vollstaendiges TN-HTML fuer den Einstellungs-WYSIWYG (Beispieldaten, geschuetzte Termin-Slots). */
export function expandWebinarLayoutTemplateForSettingsEditor(
  template: string,
  context: WebinarInvitationRenderContext
): string {
  let working = normalizeWebinarLayoutTemplateSlots(
    template.trim() || getDefaultWebinarInvitationLayoutTemplate()
  )
  for (const key of WEBINAR_INVITATION_LAYOUT_PLACEHOLDERS) {
    working = working.replace(
      new RegExp(`\\{\\{${key}\\}\\}`, 'g'),
      wrapProtectedLayoutSlot(key, context[key] ?? '')
    )
  }
  return working
}

/** WYSIWYG-HTML zurueck in Layout-Vorlage mit {{teamsBlock}} usw. */
export function collapseWebinarLayoutEditorHtmlToTemplate(html: string): string {
  const trimmed = html.trim()
  if (!trimmed) return ''

  if (typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(`<div id="chronell-layout-root">${trimmed}</div>`, 'text/html')
    const root = doc.getElementById('chronell-layout-root')
    if (root) {
      for (const key of WEBINAR_INVITATION_LAYOUT_PLACEHOLDERS) {
        root.querySelectorAll(`[data-chronell-layout-slot="${key}"]`).forEach((node) => {
          node.replaceWith(doc.createTextNode(`{{${key}}}`))
        })
      }
      const heroCell = root.querySelector(`#${WEBINAR_HERO_PLACEHOLDER_SLOT_ID}`)
      const heroTable = heroCell?.closest('table')
      if (heroTable && !root.textContent?.includes('{{heroImageBlock}}')) {
        heroTable.replaceWith(doc.createTextNode('{{heroImageBlock}}'))
      }
      root.querySelectorAll('[data-wysiwyg-protected]').forEach((node) => {
        node.removeAttribute('contenteditable')
        node.removeAttribute('data-wysiwyg-protected')
        node.removeAttribute('data-chronell-layout-slot')
        node.removeAttribute('style')
      })
      return root.innerHTML.trim()
    }
  }

  let template = trimmed
  for (const key of WEBINAR_INVITATION_LAYOUT_PLACEHOLDERS) {
    template = replaceProtectedLayoutSlotByDepth(template, key)
  }
  return normalizeWebinarLayoutTemplateSlots(
    template
      .replace(/\scontenteditable="false"/gi, '')
      .replace(/\sdata-wysiwyg-protected="true"/gi, '')
      .replace(/\sdata-chronell-layout-slot="[^"]*"/gi, '')
      .replace(/\sstyle="display:block;outline:1px dashed rgba\(201,169,98,0\.35\);outline-offset:3px"/gi, '')
      .trim()
  )
}

function replaceProtectedLayoutSlotByDepth(html: string, key: string): string {
  const openRe = new RegExp(`<div[^>]*data-chronell-layout-slot="${key}"[^>]*>`, 'i')
  const match = openRe.exec(html)
  if (!match) return html
  const start = match.index
  const contentStart = start + match[0].length
  let depth = 1
  let i = contentStart
  while (i < html.length && depth > 0) {
    const nextOpen = html.indexOf('<div', i)
    const nextClose = html.indexOf('</div>', i)
    if (nextClose === -1) break
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth += 1
      i = nextOpen + 4
      continue
    }
    depth -= 1
    if (depth === 0) {
      return `${html.slice(0, start)}{{${key}}}${html.slice(nextClose + 6)}`
    }
    i = nextClose + 6
  }
  return html
}

export function buildWebinarSettingsLayoutEditorHtml(
  defaults: WebinarInvitationDefaults,
  heroPreviewLabel: string,
  layoutHtml?: string | null
): string {
  const template =
    layoutHtml?.trim() ||
    resolveWebinarDefaultsLayoutHtml(defaults) ||
    getDefaultWebinarInvitationLayoutTemplate()
  const context = buildWebinarSettingsSampleContext(defaults, heroPreviewLabel)
  return expandWebinarLayoutTemplateForSettingsEditor(template, context)
}

export function normalizeWebinarLayoutTemplateForStorage(
  editorHtml: string,
  defaults: WebinarInvitationDefaults,
  heroPreviewLabel: string
): string | null {
  const collapsed = collapseWebinarLayoutEditorHtmlToTemplate(editorHtml)
  const defaultExpanded = expandWebinarLayoutTemplateForSettingsEditor(
    getDefaultWebinarInvitationLayoutTemplate(),
    buildWebinarSettingsSampleContext(defaults, heroPreviewLabel)
  )
  const defaultCollapsed = collapseWebinarLayoutEditorHtmlToTemplate(defaultExpanded)
  if (collapsed.trim() === defaultCollapsed.trim()) return null
  return collapsed
}
