import type { WebinarContentFormValues } from '@/app/calendar/CalendarEventDialogWebinarContentForm'
import { isChronellWebinarInvitationHtml } from '@shared/chronell-webinar-calendar'

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function cleanWebinarButtonLabel(raw: string): string {
  return decodeHtmlEntities(raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
    .replace(/&nbsp;/gi, ' ')
    .replace(/^(\p{Extended_Pictographic}\uFE0F?\s*)+/u, '')
    .trim()
}

/** Erkennt gespeicherte #kurtrocks-Webinar-Einladungen (nicht TipTap-Plaintext). */
export function isWebinarInvitationHtml(html: string | null | undefined): boolean {
  return isChronellWebinarInvitationHtml(html)
}

export type ParsedWebinarInvitation = WebinarContentFormValues & {
  parsed: boolean
}

function attrValue(attrs: string, name: string): string {
  const re = new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, 'i')
  const m = attrs.match(re)
  return m?.[1] ? decodeHtmlEntities(m[1]) : ''
}

/**
 * Echte Ziel-URL — auch nach Mail-Sanitize (`href="#"` + `data-mail-external`).
 */
export function resolveWebinarAnchorUrl(attrs: string): string {
  const href = attrValue(attrs, 'href').trim()
  const external = attrValue(attrs, 'data-mail-external').trim()
  if (external && (!href || href === '#' || href.startsWith('#'))) return external
  if (href && href !== '#' && !href.startsWith('#')) return href
  return external || href
}

function matchCtaAnchor(
  html: string,
  bgcolor: string
): { url: string; label: string } | null {
  const re = new RegExp(
    `(?:bgcolor="${bgcolor}"|background-color:\\s*${bgcolor})[\\s\\S]*?<a\\b([^>]*)>([\\s\\S]*?)<\\/a>`,
    'i'
  )
  const m = html.match(re)
  if (!m) return null
  return {
    url: resolveWebinarAnchorUrl(m[1] ?? ''),
    label: m[2] ? cleanWebinarButtonLabel(m[2]) : ''
  }
}

/** Liest die Vorlagen-Felder aus gespeichertem Einladungs-HTML. */
export function parseWebinarInvitationHtml(html: string): ParsedWebinarInvitation {
  const empty: ParsedWebinarInvitation = {
    title: '',
    heroImageSrc: null,
    surveyUrl: '',
    surveyLabel: '',
    websiteUrl: '',
    websiteLabel: '',
    parsed: false
  }
  const raw = html.trim()
  if (!isWebinarInvitationHtml(raw)) return empty

  const titleMatch =
    raw.match(
      /<p style="margin:0 0 12px;font:700 28px[^"]*"[^>]*>([\s\S]*?)<\/p>/i
    ) ||
    raw.match(/<p style="margin:0 0 6px;font:700 24px[^"]*"[^>]*>([\s\S]*?)<\/p>/i)
  const heroMatch =
    raw.match(
      /<img\b[^>]*\bsrc="((?:cid:[^"]+|data:image[^"]+|https?:[^"]+))"[^>]*>/i
    ) ||
    raw.match(
      new RegExp(
        `id="${'chronell-webinar-hero-slot'}"[\\s\\S]*?<img\\b[^>]*\\bsrc="([^"]+)"`,
        'i'
      )
    )

  const survey =
    matchCtaAnchor(raw, '#234832') || matchCtaAnchor(raw, '#2f5a3a')
  const website =
    matchCtaAnchor(raw, '#242424') || matchCtaAnchor(raw, '#2a2a2a')

  return {
    title: titleMatch?.[1] ? decodeHtmlEntities(titleMatch[1].replace(/<[^>]+>/g, '').trim()) : '',
    heroImageSrc: heroMatch?.[1]?.trim() || null,
    surveyUrl: survey?.url && survey.url !== '#' ? survey.url : '',
    surveyLabel: survey?.label ?? '',
    websiteUrl: website?.url && website.url !== '#' ? website.url : '',
    websiteLabel: website?.label ?? '',
    parsed: true
  }
}
