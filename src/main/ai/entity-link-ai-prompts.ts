import type { AiPromptTier } from '@shared/ai-prompt-tier'
import type { EntityRefKind } from '@shared/entity-ref'
import type {
  AiLinkCustomDomainProfile,
  EntityLinkAiBuiltinDomainId,
  EntityLinkAiDomainProfileId,
  ResolvedAiLinkDomainProfile
} from '@shared/ai-link-domain'

const BUILTIN: Record<
  EntityLinkAiBuiltinDomainId,
  Omit<ResolvedAiLinkDomainProfile, 'id' | 'label'>
> = {
  general: {
    subjectKeywords: [],
    systemPromptAddon: ''
  },
  workshop_honorar: {
    subjectKeywords: ['workshop', 'honorar', 'honorarium', 'vortrag', 'referent', 'rechnung', 'invoice'],
    kindBoost: ['people_contact', 'calendar_event', 'mail'],
    systemPromptAddon: `Domäne Workshop/Honorar: Priorisiere Verbindungen zwischen Person (Referent/Kunde), Kalendertermin (Workshop/Vortrag) und Mails zu Honorar, Rechnung oder Organisation.`
  },
  travel: {
    subjectKeywords: ['flug', 'flight', 'hotel', 'bahn', 'zug', 'buchung', 'booking', 'reise', 'trip', 'ticket'],
    kindBoost: ['mail', 'calendar_event', 'people_contact'],
    systemPromptAddon: `Domäne Reise: Priorisiere Buchungs-Mails, Reisetermine und Anbieter-/Kontakt-Verbindungen (Flug, Hotel, Bahn).`
  }
}

const BUILTIN_LABELS: Record<EntityLinkAiBuiltinDomainId, string> = {
  general: 'Allgemein',
  workshop_honorar: 'Workshop / Honorar',
  travel: 'Reise'
}

function isBuiltinId(id: string): id is EntityLinkAiBuiltinDomainId {
  return id === 'general' || id === 'workshop_honorar' || id === 'travel'
}

export function listBuiltinDomainProfiles(): ResolvedAiLinkDomainProfile[] {
  return (Object.keys(BUILTIN) as EntityLinkAiBuiltinDomainId[]).map((id) => ({
    id,
    label: BUILTIN_LABELS[id],
    ...BUILTIN[id]
  }))
}

export function resolveDomainProfile(
  profileId: EntityLinkAiDomainProfileId | null | undefined,
  customProfiles: AiLinkCustomDomainProfile[]
): ResolvedAiLinkDomainProfile {
  const id = (profileId?.trim() || 'general') as EntityLinkAiDomainProfileId
  if (isBuiltinId(id)) {
    return { id, label: BUILTIN_LABELS[id], ...BUILTIN[id] }
  }
  const custom = customProfiles.find((p) => p.id === id)
  if (custom && custom.keywords.length > 0) {
    return {
      id: custom.id,
      label: custom.label,
      subjectKeywords: custom.keywords,
      systemPromptAddon: `Benutzerdefinierte Domäne „${custom.label}“: Bevorzuge Objekte mit Bezug zu: ${custom.keywords.join(', ')}.`
    }
  }
  return { id: 'general', label: BUILTIN_LABELS.general, ...BUILTIN.general }
}

const SLIM_FIELD_KEYS = [
  'subject',
  'title',
  'name',
  'displayName',
  'start',
  'end',
  'date',
  'snippet',
  'text_excerpt',
  'preview',
  'email',
  'accountEmail'
] as const

export function slimFieldsForPrompt(
  fields: Record<string, unknown>,
  includeTextExcerpt: boolean
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of SLIM_FIELD_KEYS) {
    if (!(key in fields)) continue
    const val = fields[key]
    if (val == null || val === '') continue
    if (key === 'text_excerpt' && !includeTextExcerpt) continue
    out[key] = val
  }
  return Object.keys(out).length > 0 ? out : { note: 'metadata_only' }
}

export function buildSuggestPromptPackage(
  anchorId: string,
  anchor: { id: string; kind: string; fields: Record<string, unknown> },
  candidates: Array<{ candId: string; kind: string; fields: Record<string, unknown> }>,
  includeTextExcerpt: boolean,
  domain?: ResolvedAiLinkDomainProfile,
  tier: AiPromptTier = 'full'
): { systemPrompt: string; userPrompt: string } {
  const compact = tier === 'compact'
  const dataPolicy = compact
    ? includeTextExcerpt
      ? 'Nur Metadaten + kurzer Auszug (text_excerpt).'
      : 'Nur Metadaten.'
    : includeTextExcerpt
      ? 'Es werden Metadaten plus optional ein gekürzter Textauszug (text_excerpt, max. ~500 Zeichen) gesendet – kein vollständiger Mail- oder Notiztext.'
      : 'Es werden NUR Metadaten gesendet (Betreff, Namen, Daten, Kurzinfos) – kein Mail-Volltext.'
  const domainBlock =
    !compact && domain?.systemPromptAddon?.trim() ? `\n${domain.systemPromptAddon.trim()}` : ''
  const systemPrompt = compact
    ? `Verbindungsvorschläge. ${dataPolicy}
JSON: {"suggestions":[{"fromId":"anchor","toId":"cand_1","confidence":0.0,"reason":"kurz DE"}],"chains":[]}
Regeln: nur cand_* IDs; eine Seite = ${anchorId}; max. 4 suggestions, max. 2 chains; confidence 0–1.`
    : `Du bist ein Assistent für Verbindungsvorschläge in einer Produktivitäts-App.
${dataPolicy}${domainBlock}
Antworte ausschließlich mit gültigem JSON im Format:
{"suggestions":[{"fromId":"anchor","toId":"cand_1","confidence":0.0,"reason":"ein Satz auf Deutsch"}],"chains":[{"pathIds":["anchor","cand_1","cand_2"],"confidence":0.0,"reason":"ein Satz auf Deutsch"}]}
Regeln:
- Verwende nur fromId/toId aus der Kandidatenliste (cand_1, cand_2, …).
- Mindestens eine Seite jedes Paares muss der Anker (${anchorId}) sein.
- Erfinde keine IDs. Keine Verbindung ohne klaren semantischen oder zeitlichen Bezug.
- confidence zwischen 0 und 1. Maximal 8 Vorschläge, maximal 4 Ketten (2–4 Schritte, pathIds in Reihenfolge).`

  const capped = compact ? candidates.slice(0, 6) : candidates
  const userPrompt = JSON.stringify({ anchorId, anchor, candidates: capped }, null, 0)
  return { systemPrompt, userPrompt }
}

export function buildQualityPromptPackage(
  anchorId: string,
  anchor: { id: string; kind: string; fields: Record<string, unknown> },
  links: Array<{ linkId: string; kind: string; fields: Record<string, unknown>; title: string }>,
  includeTextExcerpt: boolean,
  tier: AiPromptTier = 'full'
): { systemPrompt: string; userPrompt: string } {
  const compact = tier === 'compact'
  const dataPolicy = compact
    ? includeTextExcerpt
      ? 'Metadaten + Auszug.'
      : 'Nur Metadaten.'
    : includeTextExcerpt
      ? 'Metadaten plus optional Textauszüge – kein Volltext.'
      : 'NUR Metadaten – kein Mail-Volltext.'
  const systemPrompt = compact
    ? `Bewerte Verbindungen. ${dataPolicy}
JSON: {"evaluations":[{"linkId":"link_1","quality":"strong|moderate|weak|questionable","confidence":0.0,"reason":"kurz DE"}]}
Nur link_* IDs; eine Bewertung pro linkId.`
    : `Du bewertest bestehende Verbindungen eines Anker-Objekts in einer Produktivitäts-App.
${dataPolicy}
Antworte ausschließlich mit gültigem JSON:
{"evaluations":[{"linkId":"link_1","quality":"strong|moderate|weak|questionable","confidence":0.0,"reason":"ein Satz auf Deutsch"}]}
Regeln:
- Nur linkIds aus der Liste verwenden (link_1, link_2, …).
- quality: strong = klarer fachlicher Bezug; moderate = plausibel; weak = unsicher; questionable = eher falsch oder Zufall.
- confidence 0–1. Maximal eine Bewertung pro linkId.`

  const capped = compact ? links.slice(0, 6) : links
  const userPrompt = JSON.stringify({ anchorId, anchor, existingLinks: capped }, null, 0)
  return { systemPrompt, userPrompt }
}

export function normalizeCustomDomainProfiles(raw: unknown): AiLinkCustomDomainProfile[] {
  if (!Array.isArray(raw)) return []
  const out: AiLinkCustomDomainProfile[] = []
  for (const item of raw.slice(0, 8)) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const id = typeof row.id === 'string' ? row.id.trim().slice(0, 40) : ''
    const label = typeof row.label === 'string' ? row.label.trim().slice(0, 60) : ''
    let keywords: string[] = []
    if (Array.isArray(row.keywords)) {
      keywords = row.keywords
        .filter((k): k is string => typeof k === 'string')
        .map((k) => k.trim().toLowerCase())
        .filter((k) => k.length >= 2)
        .slice(0, 12)
    } else if (typeof row.keywords === 'string') {
      keywords = row.keywords
        .split(/[,;]+/)
        .map((k) => k.trim().toLowerCase())
        .filter((k) => k.length >= 2)
        .slice(0, 12)
    }
    if (!id || !label || keywords.length === 0) continue
    if (isBuiltinId(id)) continue
    out.push({ id, label, keywords })
  }
  return out
}

export function kindBoostOrder(kinds: EntityRefKind[] | undefined): EntityRefKind[] | undefined {
  return kinds?.length ? kinds : undefined
}
