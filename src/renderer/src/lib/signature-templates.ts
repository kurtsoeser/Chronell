import type { AccountSignatureTemplate } from '@shared/types'
import { sanitizeComposeHtmlFragment } from '@/lib/sanitize-compose-html'
import { useAccountsStore } from '@/stores/accounts'

export function newSignatureTemplateId(): string {
  return `sig-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function sortSignatureTemplates(
  templates: AccountSignatureTemplate[]
): AccountSignatureTemplate[] {
  return [...templates].sort((a, b) => a.name.localeCompare(b.name, 'de'))
}

export function initialSignatureForAccount(accountId: string): {
  html: string
  templateId: string | null
} {
  const acc = useAccountsStore.getState().accounts.find((a) => a.id === accountId)
  if (!acc?.signatureTemplates?.length) return { html: '', templateId: null }
  const defId = acc.defaultSignatureTemplateId
  if (defId === null || defId === undefined || defId === '') {
    return { html: '', templateId: null }
  }
  const tpl = acc.signatureTemplates.find((t) => t.id === defId)
  const raw = tpl?.html?.trim() ?? ''
  if (!raw) return { html: '', templateId: null }
  return {
    html: sanitizeComposeHtmlFragment(raw),
    templateId: defId
  }
}

export function upsertSignatureTemplate(
  templates: AccountSignatureTemplate[],
  entry: { id?: string; name: string; html: string }
): AccountSignatureTemplate[] {
  const html = sanitizeComposeHtmlFragment(entry.html)
  const now = new Date().toISOString()
  const id = entry.id ?? newSignatureTemplateId()
  const idx = templates.findIndex((t) => t.id === id)
  if (idx >= 0) {
    const next = [...templates]
    next[idx] = { ...next[idx], name: entry.name.trim(), html, updatedAt: now }
    return next
  }
  return [...templates, { id, name: entry.name.trim(), html, updatedAt: now }]
}

export function removeSignatureTemplate(
  templates: AccountSignatureTemplate[],
  templateId: string
): AccountSignatureTemplate[] {
  return templates.filter((t) => t.id !== templateId)
}
