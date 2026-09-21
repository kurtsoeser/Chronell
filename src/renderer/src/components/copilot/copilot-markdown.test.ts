import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/sanitize-compose-html', () => ({
  sanitizeComposeHtmlFragment: (html: string): string => html
}))

import { copilotMarkdownToSafeHtml, preprocessCopilotMarkdown } from './copilot-markdown'

describe('preprocessCopilotMarkdown', () => {
  it('turns office person links into bold names', () => {
    const input =
      '[Bernhard Ziegl](https://www.office.com/search?q=Bernhard+Ziegl&EntityRepresentationId=4d18fc51)'
    expect(preprocessCopilotMarkdown(input)).toBe('**Bernhard Ziegl**')
  })

  it('strips bare office search urls', () => {
    const input = 'Text\n\nhttps://www.office.com/search?q=Bernhard+Ziegl&EntityRepresentationId=x\n'
    expect(preprocessCopilotMarkdown(input)).toBe('Text')
  })
})

describe('copilotMarkdownToSafeHtml', () => {
  it('renders headings and lists', () => {
    const html = copilotMarkdownToSafeHtml('## Kernaussagen\n\n- Eins\n- Zwei')
    expect(html).toContain('<h2')
    expect(html).toContain('<li>')
    expect(html).toContain('Eins')
  })
})
