/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest'
import {
  buildCopilotNoteSnippetHtml,
  buildCopilotSourcesNoteHtml,
  copilotReplyToNoteHtml
} from './copilot-to-object-note'

describe('copilotReplyToNoteHtml', () => {
  it('converts markdown and drops citation anchors', () => {
    const html = copilotReplyToNoteHtml('Punkt A. 1\n\n**Wichtig**')
    expect(html).toContain('Wichtig')
    expect(html).not.toContain('copilot-cite')
  })
})

describe('buildCopilotSourcesNoteHtml', () => {
  it('renders clickable links', () => {
    const html = buildCopilotSourcesNoteHtml({
      attributions: [
        {
          attributionType: 'citation',
          providerDisplayName: 'Doc',
          seeMoreWebUrl: 'https://contoso.sharepoint.com/doc'
        }
      ],
      replyText: '',
      hits: [{ extract: 'x', resourceTitle: 'Hit', resourceUrl: 'https://a.example', relevanceScore: 1 }],
      sourcesHeading: 'Quellen'
    })
    expect(html).toContain('href="https://contoso.sharepoint.com/doc"')
    expect(html).toContain('href="https://a.example"')
    expect(html).toContain('Quellen')
  })
})

describe('buildCopilotNoteSnippetHtml', () => {
  it('includes heading, body and sources', () => {
    const html = buildCopilotNoteSnippetHtml({
      replyText: 'Kurzfassung',
      attributions: [
        {
          attributionType: 'citation',
          providerDisplayName: 'Mail',
          seeMoreWebUrl: 'https://outlook.office.com/mail'
        }
      ],
      heading: 'Copilot · Work IQ',
      sourcesHeading: 'Quellen'
    })
    expect(html).toContain('Copilot · Work IQ')
    expect(html).toContain('Kurzfassung')
    expect(html).toContain('href="https://outlook.office.com/mail"')
  })
})
