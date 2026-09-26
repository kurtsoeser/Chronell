/**
 * Lokaler Katalog fuer Teams-Premium-Besprechungsvorlagen (meetingTemplateId).
 * Microsoft Graph liefert keine Endnutzer-API zum Auflisten — IDs kommen aus
 * Teams Admin Center / PowerShell (Get-CsTeamsMeetingTemplateConfiguration).
 */

export interface TeamsMeetingTemplate {
  id: string
  /** Anzeigename in Chronell. */
  name: string
  /**
   * Graph `meetingTemplateId` (GUID oder `firstparty_…` / `customtemplate_…`).
   * Beim API-Aufruf wird auf die GUID normalisiert.
   */
  meetingTemplateId: string
  /** Eingebaute Vorlage (nicht loeschbar, bearbeitbar). */
  builtin?: boolean
  updatedAt: string
}

const STORAGE_KEY = 'mailclient.calendar.teamsMeetingTemplates.v1'

/** Bekannte First-Party-IDs (Teams Admin / PowerShell). */
export const BUILTIN_TEAMS_MEETING_TEMPLATES: Omit<TeamsMeetingTemplate, 'updatedAt'>[] = [
  {
    id: 'builtin-virtual-appointment',
    name: 'Virtueller Termin',
    meetingTemplateId: 'firstparty_e514e598-fba6-4e1f-b8b3-138dd3bca748',
    builtin: true
  },
  {
    id: 'builtin-townhall',
    name: 'Townhall',
    meetingTemplateId: 'firstparty_21f91ef7-6265-4064-b78b-41ab66889d90',
    builtin: true
  }
]

/** Graph erwartet die GUID; Prefix `firstparty_` / `customtemplate_` entfernen. */
export function normalizeTeamsMeetingTemplateIdForGraph(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim()
  if (!trimmed) return null
  const withoutPrefix = trimmed.replace(/^(firstparty_|customtemplate_)/i, '')
  const guid = withoutPrefix.match(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  )
  return guid ? guid[0] : trimmed
}

function isValidTemplate(v: unknown): v is TeamsMeetingTemplate {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  return (
    typeof o.id === 'string' &&
    typeof o.name === 'string' &&
    typeof o.meetingTemplateId === 'string' &&
    o.meetingTemplateId.trim().length > 0
  )
}

function normalizeTemplate(t: TeamsMeetingTemplate): TeamsMeetingTemplate {
  return {
    id: t.id,
    name: t.name.trim().slice(0, 80) || t.meetingTemplateId.trim(),
    meetingTemplateId: t.meetingTemplateId.trim(),
    builtin: t.builtin === true,
    updatedAt: typeof t.updatedAt === 'string' ? t.updatedAt : new Date().toISOString()
  }
}

function withBuiltins(stored: TeamsMeetingTemplate[]): TeamsMeetingTemplate[] {
  const byId = new Map(stored.map((t) => [t.id, t]))
  const now = new Date().toISOString()
  const builtins = BUILTIN_TEAMS_MEETING_TEMPLATES.map((b) => {
    const existing = byId.get(b.id)
    if (existing) {
      byId.delete(b.id)
      return normalizeTemplate({
        ...existing,
        builtin: true,
        // Builtin-Name/ID aus Katalog behalten, falls Nutzer umbenannt hat: Name erlauben
        meetingTemplateId: existing.meetingTemplateId.trim() || b.meetingTemplateId
      })
    }
    return normalizeTemplate({ ...b, updatedAt: now })
  })
  const custom = [...byId.values()].filter((t) => !t.builtin).map(normalizeTemplate)
  return [...builtins, ...custom]
}

export function readTeamsMeetingTemplates(): TeamsMeetingTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return withBuiltins([])
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return withBuiltins([])
    return withBuiltins(parsed.filter(isValidTemplate).map(normalizeTemplate))
  } catch {
    return withBuiltins([])
  }
}

export function writeTeamsMeetingTemplates(templates: TeamsMeetingTemplate[]): void {
  try {
    // Builtins nur speichern wenn umbenannt/angepasst — immer volle Liste ok
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates.map(normalizeTemplate)))
    window.dispatchEvent(new CustomEvent('mailclient:teams-meeting-templates-changed'))
  } catch {
    // ignore
  }
}

export function saveTeamsMeetingTemplate(template: TeamsMeetingTemplate): void {
  const all = readTeamsMeetingTemplates()
  const next = normalizeTemplate({ ...template, updatedAt: new Date().toISOString() })
  const idx = all.findIndex((t) => t.id === next.id)
  if (idx >= 0) all[idx] = next
  else all.push(next)
  writeTeamsMeetingTemplates(all)
}

export function removeTeamsMeetingTemplate(id: string): void {
  const all = readTeamsMeetingTemplates()
  const target = all.find((t) => t.id === id)
  if (!target || target.builtin) return
  writeTeamsMeetingTemplates(all.filter((t) => t.id !== id))
}

export function createEmptyTeamsMeetingTemplate(): TeamsMeetingTemplate {
  return {
    id: `tm_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: '',
    meetingTemplateId: '',
    builtin: false,
    updatedAt: new Date().toISOString()
  }
}
