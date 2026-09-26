import type { WebinarInvitationFields } from '@/lib/build-webinar-invitation-html'
import {
  normalizeWebinarLayoutTemplateSlots,
  WEBINAR_INVITATION_LAYOUT_TEMPLATE_VERSION
} from '@/lib/webinar-invitation-layout-template'
import {
  isWebinarLayoutColorId,
  isWebinarLayoutModeId,
  makeWebinarLayoutThemeId,
  type WebinarLayoutColorId,
  type WebinarLayoutModeId,
  type WebinarLayoutThemeId
} from '@/lib/webinar-invitation-layout-themes'
import {
  getWebinarInvitationLayoutTemplateById,
  migrateLegacyWebinarLayoutTemplateFromDefaults,
  readWebinarInvitationLayoutTemplates,
  resolveWebinarLayoutTemplateHtml,
  WEBINAR_BUILTIN_LAYOUT_TEMPLATE_ID
} from '@/lib/webinar-invitation-layout-templates-storage'

const STORAGE_KEY = 'mailclient.webinarInvitationDefaults.v3'

export type WebinarInvitationDefaults = Pick<
  WebinarInvitationFields,
  | 'surveyLabel'
  | 'websiteLabel'
  | 'greetingHtml'
  | 'tipsHtml'
  | 'signOffHtml'
  | 'signatureHtml'
> & {
  defaultSurveyUrl: string
  defaultWebsiteUrl: string
  defaultHeroImageSrc: string | null
  layoutTemplateVersion?: number
  /** @deprecated Single-Vorlage — migriert nach Layout-Katalog. */
  layoutHtmlTemplate?: string | null
  /** Standard-Layout-Vorlage aus dem Katalog. */
  defaultLayoutTemplateId?: string
  defaultLayoutColor?: WebinarLayoutColorId
  defaultLayoutMode?: WebinarLayoutModeId
}

export const DEFAULT_WEBINAR_INVITATION_DEFAULTS: WebinarInvitationDefaults = {
  defaultSurveyUrl: '',
  defaultWebsiteUrl: '',
  defaultHeroImageSrc: null,
  surveyLabel: 'Umfrage ausfüllen',
  websiteLabel: 'Veranstaltungsseite',
  greetingHtml: null,
  tipsHtml: null,
  signOffHtml: null,
  signatureHtml: null,
  layoutHtmlTemplate: null,
  layoutTemplateVersion: WEBINAR_INVITATION_LAYOUT_TEMPLATE_VERSION,
  defaultLayoutTemplateId: WEBINAR_BUILTIN_LAYOUT_TEMPLATE_ID,
  defaultLayoutColor: 'gold',
  defaultLayoutMode: 'dark'
}

export function resolveDefaultWebinarLayoutTheme(
  defaults: Pick<WebinarInvitationDefaults, 'defaultLayoutColor' | 'defaultLayoutMode'>
): WebinarLayoutThemeId {
  const color = isWebinarLayoutColorId(defaults.defaultLayoutColor)
    ? defaults.defaultLayoutColor
    : 'gold'
  const mode = isWebinarLayoutModeId(defaults.defaultLayoutMode)
    ? defaults.defaultLayoutMode
    : 'dark'
  return makeWebinarLayoutThemeId(color, mode)
}

/** HTML der Standard- bzw. angegebenen Layout-Vorlage. */
export function resolveWebinarDefaultsLayoutHtml(
  defaults: Pick<WebinarInvitationDefaults, 'defaultLayoutTemplateId' | 'layoutHtmlTemplate'>
): string {
  const id = defaults.defaultLayoutTemplateId?.trim() || WEBINAR_BUILTIN_LAYOUT_TEMPLATE_ID
  const tpl = getWebinarInvitationLayoutTemplateById(id)
  const fromCatalog = resolveWebinarLayoutTemplateHtml(tpl)
  if (tpl.id !== WEBINAR_BUILTIN_LAYOUT_TEMPLATE_ID || tpl.layoutHtml?.trim()) {
    return fromCatalog
  }
  // Fallback: Legacy-Single-Feld (vor Katalog-Migration)
  const legacy = defaults.layoutHtmlTemplate?.trim()
  if (legacy) return normalizeWebinarLayoutTemplateSlots(legacy)
  return fromCatalog
}

/**
 * Custom-Vorlage behalten und nur technische Fixes anwenden.
 */
export function upgradeWebinarLayoutTemplateHtml(
  html: string | null | undefined,
  fromVersion: number
): string | null {
  const raw = html?.trim() ?? ''
  if (!raw) return null
  let out = normalizeWebinarLayoutTemplateSlots(raw)
  if (fromVersion < 6) {
    out = out.replace(/;?\s*overflow\s*:\s*hidden\s*;?/gi, ';')
    out = out.replace(/style="([^"]*);+"/gi, (_m, styles: string) => {
      const cleaned = styles.replace(/;;+/g, ';').replace(/^;|;$/g, '')
      return cleaned ? `style="${cleaned}"` : ''
    })
  }
  return out.trim() || null
}

function migrateWebinarInvitationDefaults(
  parsed: Partial<WebinarInvitationDefaults>
): WebinarInvitationDefaults {
  const merged = { ...DEFAULT_WEBINAR_INVITATION_DEFAULTS, ...parsed }
  if (!isWebinarLayoutColorId(merged.defaultLayoutColor)) {
    merged.defaultLayoutColor = 'gold'
  }
  if (!isWebinarLayoutModeId(merged.defaultLayoutMode)) {
    merged.defaultLayoutMode = 'dark'
  }

  const version = merged.layoutTemplateVersion ?? 0
  if (version < WEBINAR_INVITATION_LAYOUT_TEMPLATE_VERSION) {
    merged.layoutHtmlTemplate = upgradeWebinarLayoutTemplateHtml(
      merged.layoutHtmlTemplate,
      version
    )
    merged.layoutTemplateVersion = WEBINAR_INVITATION_LAYOUT_TEMPLATE_VERSION
  } else if (merged.layoutHtmlTemplate?.trim()) {
    merged.layoutHtmlTemplate = normalizeWebinarLayoutTemplateSlots(merged.layoutHtmlTemplate)
  }

  // Single-Vorlage → Katalog (einmalig)
  if (merged.layoutHtmlTemplate?.trim()) {
    migrateLegacyWebinarLayoutTemplateFromDefaults(merged.layoutHtmlTemplate)
    if (
      !merged.defaultLayoutTemplateId ||
      merged.defaultLayoutTemplateId === WEBINAR_BUILTIN_LAYOUT_TEMPLATE_ID
    ) {
      const user = readWebinarInvitationLayoutTemplates().find(
        (t) => !t.builtin && t.layoutHtml?.trim()
      )
      if (user) merged.defaultLayoutTemplateId = user.id
    }
    merged.layoutHtmlTemplate = null
  }

  if (!merged.defaultLayoutTemplateId?.trim()) {
    merged.defaultLayoutTemplateId = WEBINAR_BUILTIN_LAYOUT_TEMPLATE_ID
  }

  return merged
}

export function readWebinarInvitationDefaults(): WebinarInvitationDefaults {
  try {
    const rawV3 = localStorage.getItem(STORAGE_KEY)
    if (rawV3) {
      const parsed = JSON.parse(rawV3) as Partial<WebinarInvitationDefaults>
      const migrated = migrateWebinarInvitationDefaults(parsed)
      const needsPersist =
        (parsed.layoutTemplateVersion ?? 0) < WEBINAR_INVITATION_LAYOUT_TEMPLATE_VERSION ||
        Boolean(parsed.layoutHtmlTemplate?.trim()) ||
        !parsed.defaultLayoutTemplateId
      if (needsPersist) {
        saveWebinarInvitationDefaults(migrated)
      }
      return migrated
    }
    const rawV2 = localStorage.getItem('mailclient.webinarInvitationDefaults.v2')
    if (rawV2) {
      const migrated = migrateWebinarInvitationDefaults(
        JSON.parse(rawV2) as Partial<WebinarInvitationDefaults>
      )
      saveWebinarInvitationDefaults(migrated)
      return migrated
    }
    const rawV1 = localStorage.getItem('mailclient.webinarInvitationDefaults.v1')
    if (rawV1) {
      const migrated = migrateWebinarInvitationDefaults(
        JSON.parse(rawV1) as Partial<WebinarInvitationDefaults>
      )
      saveWebinarInvitationDefaults(migrated)
      return migrated
    }
    return { ...DEFAULT_WEBINAR_INVITATION_DEFAULTS }
  } catch {
    return { ...DEFAULT_WEBINAR_INVITATION_DEFAULTS }
  }
}

export function saveWebinarInvitationDefaults(next: WebinarInvitationDefaults): void {
  const toStore: WebinarInvitationDefaults = {
    ...next,
    layoutHtmlTemplate: null,
    defaultLayoutTemplateId:
      next.defaultLayoutTemplateId?.trim() || WEBINAR_BUILTIN_LAYOUT_TEMPLATE_ID,
    defaultLayoutColor: isWebinarLayoutColorId(next.defaultLayoutColor)
      ? next.defaultLayoutColor
      : 'gold',
    defaultLayoutMode: isWebinarLayoutModeId(next.defaultLayoutMode)
      ? next.defaultLayoutMode
      : 'dark',
    layoutTemplateVersion: WEBINAR_INVITATION_LAYOUT_TEMPLATE_VERSION
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore))
}
