import { describe, expect, it } from 'vitest'
import { buildCopilotSourcePills, linkifyCopilotCitationMarkers } from './copilot-sources'

describe('buildCopilotSourcePills', () => {
  it('numbers and dedupes by url', () => {
    const pills = buildCopilotSourcePills([
      { attributionType: 'citation', providerDisplayName: 'Mail A', seeMoreWebUrl: 'https://a' },
      { attributionType: 'citation', providerDisplayName: 'Mail A copy', seeMoreWebUrl: 'https://a' },
      { attributionType: 'citation', providerDisplayName: 'Doc', seeMoreWebUrl: 'https://b' }
    ])
    expect(pills).toEqual([
      { index: 1, label: 'Mail A', url: 'https://a' },
      { index: 2, label: 'Doc', url: 'https://b' }
    ])
  })

  it('falls back to citation numbers from reply text', () => {
    const pills = buildCopilotSourcePills([], 'Ort statt. 23\n\nDatei. 4')
    expect(pills.map((p) => p.index)).toEqual([2, 3, 4])
  })

  it('extracts markdown links when attributions empty', () => {
    const pills = buildCopilotSourcePills(
      [],
      'Siehe [Honorarnotiz](https://contoso.sharepoint.com/doc.xlsx) und [1](https://a.example)'
    )
    expect(pills).toEqual([
      { index: 1, label: 'Honorarnotiz', url: 'https://contoso.sharepoint.com/doc.xlsx' },
      { index: 2, label: 'a.example', url: 'https://a.example' }
    ])
  })
})

describe('linkifyCopilotCitationMarkers', () => {
  it('converts [^n^] markers', () => {
    expect(linkifyCopilotCitationMarkers('Text[^1^] weiter')).toContain('href="#copilot-cite-1"')
  })

  it('splits digit runs after punctuation into per-digit cites', () => {
    const out = linkifyCopilotCitationMarkers('Ort statt. 23')
    expect(out).toContain('href="#copilot-cite-2"')
    expect(out).toContain('href="#copilot-cite-3"')
  })
})
