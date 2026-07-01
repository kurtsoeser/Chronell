import { sanitizeComposeHtmlFragment } from '@/lib/sanitize-compose-html'
import { isBuiltinNotePageTemplateId } from '@/lib/note-page-templates'

const STORAGE_KEY = 'mailclient.notePageTemplatesCustom.v1'
export const NOTE_PAGE_TEMPLATES_CUSTOM_CHANGED = 'mailclient:notePageTemplatesCustomChanged'

export interface CustomNotePageTemplate {
  id: string
  name: string
  description: string
  bodyHtml: string
  updatedAt: string
}

export function newCustomNotePageTemplateId(): string {
  return `custom-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function sortByName(templates: CustomNotePageTemplate[]): CustomNotePageTemplate[] {
  return [...templates].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
}

function readRaw(): CustomNotePageTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const out: CustomNotePageTemplate[] = []
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue
      const o = item as Record<string, unknown>
      const id = typeof o.id === 'string' ? o.id.trim() : ''
      const name = typeof o.name === 'string' ? o.name.trim() : ''
      const description = typeof o.description === 'string' ? o.description.trim() : ''
      const bodyHtml = typeof o.bodyHtml === 'string' ? o.bodyHtml : ''
      const updatedAt = typeof o.updatedAt === 'string' ? o.updatedAt : ''
      if (!id || !name) continue
      out.push({
        id,
        name,
        description,
        bodyHtml: sanitizeComposeHtmlFragment(bodyHtml),
        updatedAt
      })
    }
    return sortByName(out)
  } catch {
    return []
  }
}

function persist(templates: CustomNotePageTemplate[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sortByName(templates)))
  window.dispatchEvent(new Event(NOTE_PAGE_TEMPLATES_CUSTOM_CHANGED))
}

export function loadCustomNotePageTemplates(): CustomNotePageTemplate[] {
  return readRaw()
}

export function saveCustomNotePageTemplates(templates: CustomNotePageTemplate[]): void {
  persist(templates)
}

export function upsertCustomNotePageTemplate(
  templates: CustomNotePageTemplate[],
  entry: { id?: string; name: string; description?: string; bodyHtml: string }
): CustomNotePageTemplate[] {
  const name = entry.name.trim()
  const description = (entry.description ?? '').trim()
  const bodyHtml = sanitizeComposeHtmlFragment(entry.bodyHtml)
  const now = new Date().toISOString()
  const id = entry.id ?? newCustomNotePageTemplateId()
  const next: CustomNotePageTemplate = { id, name, description, bodyHtml, updatedAt: now }
  const idx = templates.findIndex((t) => t.id === id)
  const merged =
    idx >= 0
      ? templates.map((t, i) => (i === idx ? next : t))
      : [...templates, next]
  persist(merged)
  return merged
}

export function removeCustomNotePageTemplate(
  templates: CustomNotePageTemplate[],
  id: string
): CustomNotePageTemplate[] {
  const merged = templates.filter((t) => t.id !== id)
  persist(merged)
  return merged
}

export function isKnownNotePageTemplateId(id: string): boolean {
  if (isBuiltinNotePageTemplateId(id)) return true
  return loadCustomNotePageTemplates().some((t) => t.id === id)
}

export function normalizeNotePageTemplateId(id: string): string {
  return isKnownNotePageTemplateId(id) ? id : 'blank'
}
