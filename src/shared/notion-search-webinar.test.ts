import { describe, expect, it } from 'vitest'
import { plainTextToWebinarSupplementHtml } from './notion-search'

describe('plainTextToWebinarSupplementHtml', () => {
  it('escapes and wraps paragraphs', () => {
    const html = plainTextToWebinarSupplementHtml('Hallo <Welt>\n\nZeile 2')
    expect(html).toContain('<p>Hallo &lt;Welt&gt;</p>')
    expect(html).toContain('<p>Zeile 2</p>')
  })

  it('returns empty for blank', () => {
    expect(plainTextToWebinarSupplementHtml('  ')).toBe('')
  })
})
