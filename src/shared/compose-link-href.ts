/**
 * Normalisiert Link-URLs fuer Compose/Versand:
 * relative Werte wie `www.example.com` werden zu absoluten `https://…` Links.
 */

const BARE_PROTOCOL_ONLY = /^(https?:\/\/)$/i
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i
const SAFE_SCHEMES =
  /^(https?|mailto|tel|sms|callto|msteams|ms-teams|ms-outlook|outlook|notion|microsoft-edge):/i

function decodeBasicHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
}

function escapeHtmlAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

/** Liefert eine absolute, klickbare URL oder null bei ungueltiger Eingabe. */
export function normalizeComposeLinkHref(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed || BARE_PROTOCOL_ONLY.test(trimmed)) return null

  if (trimmed.startsWith('//')) {
    try {
      return new URL(`https:${trimmed}`).href
    } catch {
      return null
    }
  }

  if (HAS_SCHEME.test(trimmed)) {
    if (!SAFE_SCHEMES.test(trimmed)) return null
    if (/^(mailto|tel|sms|callto):/i.test(trimmed)) return trimmed
    if (/^https?:\/\//i.test(trimmed)) {
      try {
        // Validieren, aber Original beibehalten (kein trailing-slash von URL.href).
        void new URL(trimmed)
        return trimmed
      } catch {
        return null
      }
    }
    try {
      return new URL(trimmed).href
    } catch {
      return null
    }
  }

  try {
    return new URL(`https://${trimmed}`).href
  } catch {
    return null
  }
}

/**
 * Macht relative/fehlende Protokoll-hrefs in bestehenden `<a>`-Tags absolut,
 * damit Empfaenger-Clients die Links oeffnen koennen.
 */
export function normalizeAnchorHrefsInHtmlFragment(html: string): string {
  if (!html || !/<a\b/i.test(html)) return html

  return html.replace(/<a\b([^>]*)>/gi, (full, attrs: string) => {
    const match = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrs)
    if (!match) return full

    const raw = decodeBasicHtmlEntities((match[1] ?? match[2] ?? match[3] ?? '').trim())
    const normalized = normalizeComposeLinkHref(raw)
    if (!normalized || normalized === raw) return full

    const nextAttrs = attrs.replace(
      /\bhref\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/i,
      `href="${escapeHtmlAttr(normalized)}"`
    )
    return `<a${nextAttrs}>`
  })
}
