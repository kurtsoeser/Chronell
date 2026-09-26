/**
 * Katalog benannter Webinar-HTML-Layout-Vorlagen (Struktur/Slots).
 * Farbe/Hell-Dunkel bleiben global in webinar-invitation-defaults-storage.
 */

import {
  getDefaultWebinarInvitationLayoutTemplate,
  normalizeWebinarLayoutTemplateSlots,
  WEBINAR_INVITATION_LAYOUT_TEMPLATE_VERSION
} from '@/lib/webinar-invitation-layout-template'

export const WEBINAR_BUILTIN_LAYOUT_TEMPLATE_ID = 'builtin-default'

export interface WebinarInvitationLayoutTemplate {
  id: string
  name: string
  /**
   * HTML mit {{greetingBlock}} … Platzhaltern.
   * `null` = baked Kurtrocks-Standard (`getDefaultWebinarInvitationLayoutTemplate`).
   */
  layoutHtml: string | null
  layoutTemplateVersion: number
  builtin?: boolean
  updatedAt: string
}

const STORAGE_KEY = 'mailclient.webinarInvitationLayoutTemplates.v1'
export const WEBINAR_LAYOUT_TEMPLATES_CHANGED_EVENT = 'mailclient:webinar-layout-templates-changed'

function nowIso(): string {
  return new Date().toISOString()
}

function newTemplateId(): string {
  return `wil_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function normalizeLayoutHtml(html: string | null | undefined): string | null {
  const raw = html?.trim() ?? ''
  if (!raw) return null
  return normalizeWebinarLayoutTemplateSlots(raw)
}

function isValidTemplate(v: unknown): v is WebinarInvitationLayoutTemplate {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  return typeof o.id === 'string' && typeof o.name === 'string' && o.id.trim().length > 0
}

function normalizeTemplate(t: WebinarInvitationLayoutTemplate): WebinarInvitationLayoutTemplate {
  return {
    id: t.id.trim(),
    name: t.name.trim().slice(0, 80) || 'Vorlage',
    layoutHtml: normalizeLayoutHtml(t.layoutHtml),
    layoutTemplateVersion:
      typeof t.layoutTemplateVersion === 'number'
        ? t.layoutTemplateVersion
        : WEBINAR_INVITATION_LAYOUT_TEMPLATE_VERSION,
    builtin: t.builtin === true,
    updatedAt: typeof t.updatedAt === 'string' ? t.updatedAt : nowIso()
  }
}

function builtinDefault(existing?: WebinarInvitationLayoutTemplate | null): WebinarInvitationLayoutTemplate {
  return normalizeTemplate({
    id: WEBINAR_BUILTIN_LAYOUT_TEMPLATE_ID,
    name: existing?.name?.trim() || 'Kurtrocks Standard',
    layoutHtml: existing?.layoutHtml ?? null,
    layoutTemplateVersion: WEBINAR_INVITATION_LAYOUT_TEMPLATE_VERSION,
    builtin: true,
    updatedAt: existing?.updatedAt ?? nowIso()
  })
}

function withBuiltin(stored: WebinarInvitationLayoutTemplate[]): WebinarInvitationLayoutTemplate[] {
  const byId = new Map(stored.map((t) => [t.id, t]))
  const existingBuiltin = byId.get(WEBINAR_BUILTIN_LAYOUT_TEMPLATE_ID) ?? null
  byId.delete(WEBINAR_BUILTIN_LAYOUT_TEMPLATE_ID)
  const custom = [...byId.values()].filter((t) => !t.builtin).map(normalizeTemplate)
  return [builtinDefault(existingBuiltin), ...custom]
}

function readStoredRaw(): WebinarInvitationLayoutTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isValidTemplate).map(normalizeTemplate)
  } catch {
    return []
  }
}

/**
 * Einmalig: alte Single-Vorlage aus Defaults in den Katalog uebernehmen.
 */
export function migrateLegacyWebinarLayoutTemplateFromDefaults(
  legacyHtml: string | null | undefined
): void {
  const html = normalizeLayoutHtml(legacyHtml)
  if (!html) return
  try {
    const existing = readStoredRaw()
    if (existing.some((t) => t.id !== WEBINAR_BUILTIN_LAYOUT_TEMPLATE_ID && t.layoutHtml)) {
      return
    }
    const builtin = existing.find((t) => t.id === WEBINAR_BUILTIN_LAYOUT_TEMPLATE_ID)
    if (builtin?.layoutHtml?.trim()) return
    const migrated: WebinarInvitationLayoutTemplate = normalizeTemplate({
      id: newTemplateId(),
      name: 'Meine Vorlage',
      layoutHtml: html,
      layoutTemplateVersion: WEBINAR_INVITATION_LAYOUT_TEMPLATE_VERSION,
      builtin: false,
      updatedAt: nowIso()
    })
    writeWebinarInvitationLayoutTemplates(withBuiltin([...existing, migrated]))
  } catch {
    // ignore
  }
}

export function readWebinarInvitationLayoutTemplates(): WebinarInvitationLayoutTemplate[] {
  return withBuiltin(readStoredRaw())
}

export function writeWebinarInvitationLayoutTemplates(
  templates: WebinarInvitationLayoutTemplate[]
): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(withBuiltin(templates).map(normalizeTemplate)))
    window.dispatchEvent(new CustomEvent(WEBINAR_LAYOUT_TEMPLATES_CHANGED_EVENT))
  } catch {
    // ignore
  }
}

export function getWebinarInvitationLayoutTemplateById(
  id: string | null | undefined
): WebinarInvitationLayoutTemplate {
  const all = readWebinarInvitationLayoutTemplates()
  const hit = all.find((t) => t.id === (id?.trim() || WEBINAR_BUILTIN_LAYOUT_TEMPLATE_ID))
  return hit ?? all[0]!
}

/** Aufgeloestes HTML fuer Generator (baked Default wenn null). */
export function resolveWebinarLayoutTemplateHtml(
  template: Pick<WebinarInvitationLayoutTemplate, 'layoutHtml'> | null | undefined
): string {
  const custom = template?.layoutHtml?.trim()
  if (custom) return normalizeWebinarLayoutTemplateSlots(custom)
  return getDefaultWebinarInvitationLayoutTemplate('gold')
}

export function saveWebinarInvitationLayoutTemplate(
  template: WebinarInvitationLayoutTemplate
): void {
  const all = readWebinarInvitationLayoutTemplates()
  const next = normalizeTemplate({ ...template, updatedAt: nowIso() })
  const idx = all.findIndex((t) => t.id === next.id)
  if (idx >= 0) all[idx] = next
  else all.push(next)
  writeWebinarInvitationLayoutTemplates(all)
}

export function removeWebinarInvitationLayoutTemplate(id: string): void {
  if (id === WEBINAR_BUILTIN_LAYOUT_TEMPLATE_ID) return
  const all = readWebinarInvitationLayoutTemplates().filter((t) => t.id !== id)
  writeWebinarInvitationLayoutTemplates(all)
}

export function createEmptyWebinarInvitationLayoutTemplate(
  name = 'Neue Vorlage'
): WebinarInvitationLayoutTemplate {
  return normalizeTemplate({
    id: newTemplateId(),
    name,
    layoutHtml: getDefaultWebinarInvitationLayoutTemplate('gold'),
    layoutTemplateVersion: WEBINAR_INVITATION_LAYOUT_TEMPLATE_VERSION,
    builtin: false,
    updatedAt: nowIso()
  })
}

export function duplicateWebinarInvitationLayoutTemplate(
  source: WebinarInvitationLayoutTemplate,
  name?: string
): WebinarInvitationLayoutTemplate {
  return normalizeTemplate({
    id: newTemplateId(),
    name: (name?.trim() || `${source.name.trim()} (Kopie)`).slice(0, 80),
    layoutHtml: source.layoutHtml?.trim()
      ? source.layoutHtml
      : getDefaultWebinarInvitationLayoutTemplate('gold'),
    layoutTemplateVersion: WEBINAR_INVITATION_LAYOUT_TEMPLATE_VERSION,
    builtin: false,
    updatedAt: nowIso()
  })
}
