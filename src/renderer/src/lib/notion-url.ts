/** Erlaubte Notion-Hosts (API liefert inzwischen oft `app.notion.com`, nicht nur `notion.so`). */
const NOTION_HOST_RE =
  /^(?:www\.)?notion\.so$|^(?:www\.)?notion\.com$|^app\.notion\.com$|(?:^|\.)notion\.site$/i

/**
 * Web-URL der Notion-Seite → Deep-Link für die Desktop-App (`notion://…`).
 * Akzeptiert klassische `notion.so`-Links und neue `app.notion.com/p/…`-URLs.
 */
export function toNotionAppUrl(webUrl: string): string {
  const trimmed = webUrl.trim()
  if (!trimmed) throw new Error('Keine Notion-URL.')
  if (/^notion:\/\//i.test(trimmed)) return trimmed

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    throw new Error('Ungueltige Notion-Web-URL.')
  }

  if (!/^https?:$/i.test(parsed.protocol) || !NOTION_HOST_RE.test(parsed.hostname)) {
    throw new Error('Ungueltige Notion-Web-URL.')
  }

  // Deep-Link: gleiches Pfad/Query, nur Schema notion://
  return `notion://${parsed.host}${parsed.pathname}${parsed.search}${parsed.hash}`
}
