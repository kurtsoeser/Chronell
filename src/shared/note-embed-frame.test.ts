import { describe, expect, it } from 'vitest'
import { isAllowedNoteEmbedSubFrameUrl, NOTE_EMBED_HTTP_ORIGIN } from './note-embed-frame'

describe('isAllowedNoteEmbedSubFrameUrl', () => {
  it('erlaubt YouTube- und Forms-Embed-URLs', () => {
    expect(
      isAllowedNoteEmbedSubFrameUrl('https://www.youtube.com/embed/dQw4w9WgXcQ?origin=https://chronell.app')
    ).toBe(true)
    expect(
      isAllowedNoteEmbedSubFrameUrl(
        'https://forms.office.com/Pages/ResponsePage.aspx?id=abc&embed=true'
      )
    ).toBe(true)
    expect(
      isAllowedNoteEmbedSubFrameUrl(
        'https://www.geogebra.org/material/iframe/id/dwhhteev/width/960/height/560'
      )
    ).toBe(true)
    expect(isAllowedNoteEmbedSubFrameUrl('https://example.com/embed/x')).toBe(false)
  })

  it('exportiert eine stabile Embed-Origin', () => {
    expect(NOTE_EMBED_HTTP_ORIGIN).toBe('https://chronell.app')
  })
})
