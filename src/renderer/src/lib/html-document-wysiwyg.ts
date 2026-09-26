/** Geschuetzte Bloecke (z. B. Teams-Slot) — nicht im WYSIWYG editierbar. */
export const HTML_DOCUMENT_WYSIWYG_DEFAULT_PROTECTED = ['#chronell-webinar-teams-slot'] as const

const WYSIWYG_IFRAME_STYLES = `
  html, body { margin: 0; padding: 0; }
  body {
    margin: 0;
    padding: 16px;
    min-height: 280px;
    background: #0d0d0d;
    outline: none;
    font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
    cursor: text;
  }
  body:focus { outline: none; }
  [data-wysiwyg-protected="true"] {
    outline: 1px dashed rgba(201, 169, 98, 0.45);
    outline-offset: 3px;
    user-select: none;
    cursor: default;
  }
  a { color: #e8d5a3; text-decoration: none; }
  a:hover { text-decoration: underline; }
  img { max-width: 100%; height: auto; display: block; }
`.trim()

/** Vollstaendiges iframe-Dokument fuer designMode-Bearbeitung. */
export function buildHtmlDocumentWysiwygShell(bodyHtml: string): string {
  return `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><style>${WYSIWYG_IFRAME_STYLES}</style></head><body>${bodyHtml}</body></html>`
}

export function applyHtmlDocumentWysiwygProtectedRegions(
  doc: Document,
  selectors: readonly string[]
): void {
  for (const selector of selectors) {
    doc.querySelectorAll(selector).forEach((node) => {
      node.setAttribute('contenteditable', 'false')
      node.setAttribute('data-wysiwyg-protected', 'true')
    })
  }
}

export function extractHtmlDocumentWysiwygBody(doc: Document | null | undefined): string {
  if (!doc?.body) return ''
  return doc.body.innerHTML.trim()
}

export function execHtmlDocumentWysiwygCommand(
  doc: Document | null | undefined,
  command: string,
  value?: string
): boolean {
  if (!doc) return false
  try {
    doc.execCommand('styleWithCSS', false, 'true')
    return doc.execCommand(command, false, value)
  } catch {
    return false
  }
}

export function focusHtmlDocumentWysiwyg(doc: Document | null | undefined): void {
  doc?.getSelection()?.removeAllRanges()
  doc?.body?.focus()
}

export function queryHtmlDocumentWysiwygCommandState(
  doc: Document | null | undefined,
  command: string
): boolean {
  if (!doc) return false
  try {
    return doc.queryCommandState(command)
  } catch {
    return false
  }
}
