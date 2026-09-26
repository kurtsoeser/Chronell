import { describe, expect, it } from 'vitest'
import { extractDataUriImagesToCidAttachments } from './extract-data-uri-images-to-cid'

describe('extractDataUriImagesToCidAttachments', () => {
  it('ersetzt data-URL durch cid und liefert Inline-Anhang', () => {
    const b64 = 'iVBORw0KGgo='
    const html = `<p><img src="data:image/png;base64,${b64}" alt="Hero" style="max-width:100%"></p>`
    const out = extractDataUriImagesToCidAttachments(html)
    expect(out.attachments).toHaveLength(1)
    expect(out.attachments[0].isInline).toBe(true)
    expect(out.attachments[0].contentId).toBeTruthy()
    expect(out.attachments[0].dataBase64).toBe(b64)
    expect(out.html).toContain(`src="cid:${out.attachments[0].contentId}"`)
    expect(out.html).not.toContain('data:image')
  })

  it('laesst normale https-Bilder unveraendert', () => {
    const html = '<img src="https://example.com/a.png" alt="">'
    const out = extractDataUriImagesToCidAttachments(html)
    expect(out.attachments).toHaveLength(0)
    expect(out.html).toBe(html)
  })
})
