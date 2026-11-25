const MAX_BODY_CHARS = 80_000

export interface OneNoteMailPageInput {
  subject: string | null
  fromName: string | null
  fromAddr: string | null
  toAddrs: string | null
  ccAddrs: string | null
  dateLabel: string | null
  webLink: string | null
  bodyText: string | null
  bodyHtml: string | null
  hasAttachments: boolean
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Outlook-HTML auf Text reduzieren. OneNote lehnt das meiste Mail-Markup ab. */
export function htmlToPlainForOneNote(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h[1-6]|blockquote|pre|table)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function collapseTitle(subject: string | null): string {
  const raw = (subject || '').replace(/\s+/g, ' ').trim()
  const title = raw || '(Ohne Betreff)'
  return title.length > 180 ? `${title.slice(0, 177)}…` : title
}

function personLine(name: string | null, addr: string | null): string {
  const n = name?.trim() || ''
  const a = addr?.trim() || ''
  if (n && a && n !== a) return `${n} <${a}>`
  return n || a
}

function bodyPlain(input: OneNoteMailPageInput): string {
  const text = input.bodyText?.trim() || ''
  if (text) return text
  const html = input.bodyHtml?.trim() || ''
  if (html) return htmlToPlainForOneNote(html)
  return ''
}

function paragraphs(plain: string): string[] {
  return plain
    .split(/\n{2,}/)
    .map((block) => block.replace(/[ \t]+\n/g, '\n').trim())
    .filter(Boolean)
}

function safeHref(url: string | null): string | null {
  const raw = url?.trim() || ''
  if (!/^https?:\/\//i.test(raw)) return null
  return raw
}

/**
 * XHTML-Seite für `POST /me/onenote/sections/{id}/pages`.
 * Der Seitentitel kommt aus `<title>`.
 */
export function buildOneNoteMailPageHtml(input: OneNoteMailPageInput): string {
  const title = collapseTitle(input.subject)
  const lines: string[] = []
  const from = personLine(input.fromName, input.fromAddr)
  if (from) lines.push(`<p><b>Von:</b> ${escapeHtml(from)}</p>`)
  const to = input.toAddrs?.trim()
  if (to) lines.push(`<p><b>An:</b> ${escapeHtml(to)}</p>`)
  const cc = input.ccAddrs?.trim()
  if (cc) lines.push(`<p><b>Cc:</b> ${escapeHtml(cc)}</p>`)
  if (input.dateLabel?.trim()) {
    lines.push(`<p><b>Datum:</b> ${escapeHtml(input.dateLabel.trim())}</p>`)
  }
  const href = safeHref(input.webLink)
  if (href) {
    lines.push(`<p><a href="${escapeHtml(href)}">Mail öffnen</a></p>`)
  }
  if (input.hasAttachments) {
    lines.push('<p><i>Anhänge bleiben in der Mail und werden nicht mitkopiert.</i></p>')
  }

  let plain = bodyPlain(input)
  let truncated = false
  if (plain.length > MAX_BODY_CHARS) {
    plain = plain.slice(0, MAX_BODY_CHARS)
    truncated = true
  }
  if (lines.length > 0 && plain) lines.push('<p><br/></p>')
  for (const block of paragraphs(plain)) {
    lines.push(`<p>${escapeHtml(block).replace(/\n/g, '<br/>')}</p>`)
  }
  if (truncated) {
    lines.push('<p><i>Text gekürzt.</i></p>')
  }
  if (lines.length === 0) lines.push('<p><br/></p>')

  return [
    '<!DOCTYPE html>',
    '<html>',
    '<head>',
    `<title>${escapeHtml(title)}</title>`,
    '</head>',
    '<body>',
    ...lines,
    '</body>',
    '</html>'
  ].join('')
}
