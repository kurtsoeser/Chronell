const HTML_ROOT_TAG =
  /^<(p|div|h[1-6]|ul|ol|blockquote|table|hr|br|img|span|strong|em|a)\b/i

/** Plain-Text aus Notiz-Body für FTS und Listen-Vorschau (ohne volles HTML). */
export function noteBodyFtsText(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''

  if (HTML_ROOT_TAG.test(trimmed) || trimmed.startsWith('<')) {
    return trimmed
      .slice(0, 24_000)
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<\/p>/gi, ' ')
      .replace(/<\/li>/gi, ' ')
      .replace(/<\/h[1-6]>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 8_000)
  }

  return trimmed
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 8_000)
}
