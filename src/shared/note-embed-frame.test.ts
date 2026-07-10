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

  it('erlaubt SharePoint-/M365-Auth-Redirects fuer Stream-Embeds', () => {
    expect(
      isAllowedNoteEmbedSubFrameUrl(
        'https://kurtrocks-my.sharepoint.com/personal/user/_layouts/15/Authenticate.aspx?Source=%2Fstream'
      )
    ).toBe(true)
    expect(
      isAllowedNoteEmbedSubFrameUrl(
        'https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=abc'
      )
    ).toBe(true)
    expect(isAllowedNoteEmbedSubFrameUrl('https://evil.example/Authenticate.aspx')).toBe(false)
  })

  it('exportiert eine stabile Embed-Origin', () => {
    expect(NOTE_EMBED_HTTP_ORIGIN).toBe('https://chronell.app')
  })
})
