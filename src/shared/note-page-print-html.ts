function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const PRINT_CSS = `
  @page { margin: 18mm; }
  * { box-sizing: border-box; }
  body {
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    font-size: 11pt;
    line-height: 1.55;
    color: #111827;
    margin: 0;
    padding: 0;
  }
  h1 {
    font-size: 20pt;
    font-weight: 600;
    margin: 0 0 1.25rem;
    line-height: 1.25;
  }
  article { max-width: 100%; }
  article p { margin: 0.5em 0; }
  article h2, article h3 { margin: 1em 0 0.4em; }
  article ul, article ol { margin: 0.5em 0; padding-left: 1.5em; }
  article blockquote {
    margin: 0.75em 0;
    padding-left: 0.75em;
    border-left: 3px solid #d1d5db;
    color: #4b5563;
  }
  article pre, article code {
    font-family: ui-monospace, Consolas, monospace;
    font-size: 0.92em;
  }
  article pre {
    background: #f3f4f6;
    padding: 0.75em 1em;
    border-radius: 4px;
    overflow-x: auto;
    white-space: pre-wrap;
  }
  article img { max-width: 100%; height: auto; }
  article table {
    border-collapse: collapse;
    width: 100%;
    margin: 0.75em 0;
  }
  article th, article td {
    border: 1px solid #d1d5db;
    padding: 0.35em 0.6em;
    vertical-align: top;
  }
  article th { background: #f9fafb; font-weight: 600; }
  article a { color: #2563eb; text-decoration: underline; }
  article hr { border: none; border-top: 1px solid #e5e7eb; margin: 1em 0; }
  article input[type="checkbox"] { margin-right: 0.35em; }
`

export function buildNotePagePrintHtml(title: string, bodyHtml: string): string {
  const safeTitle = escapeHtml(title.trim() || 'Notiz')
  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <title>${safeTitle}</title>
  <style>${PRINT_CSS}</style>
</head>
<body>
  <h1>${safeTitle}</h1>
  <article>${bodyHtml}</article>
</body>
</html>`
}
