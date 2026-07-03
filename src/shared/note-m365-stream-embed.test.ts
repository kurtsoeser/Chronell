import { describe, expect, it } from 'vitest'
import {
  buildM365StreamEmbedSrc,
  buildSharePointStreamEmbedUrl,
  deriveSharePointSiteUrl,
  parseSharePointStreamPageEmbedSrc
} from './note-m365-stream-embed'

describe('note-m365-stream-embed', () => {
  it('leitet Site-URL aus webUrl ab', () => {
    expect(
      deriveSharePointSiteUrl(
        'https://contoso.sharepoint.com/sites/Community/Shared%20Documents/Clip.mp4'
      )
    ).toBe('https://contoso.sharepoint.com/sites/Community')
  })

  it('baut embed.aspx für Stream-Player', () => {
    const embed = buildSharePointStreamEmbedUrl(
      'https://contoso.sharepoint.com/sites/Community',
      '32977b69-0556-4990-a089-ee2e96dc88c9'
    )
    expect(embed).toContain('/_layouts/15/embed.aspx')
    expect(embed).toContain('UniqueId=32977b69-0556-4990-a089-ee2e96dc88c9')
  })

  it('kombiniert Graph-Metadaten zu Stream-Embed', () => {
    const embed = buildM365StreamEmbedSrc({
      webUrl: 'https://contoso.sharepoint.com/sites/Demo/Shared Documents/video.mp4',
      listItemUniqueId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
    })
    expect(embed).toContain('contoso.sharepoint.com/sites/Demo/_layouts/15/embed.aspx')
  })

  it('erkennt SharePoint stream.aspx mit Server-Relativpfad', () => {
    const url =
      'https://kurtrocks.sharepoint.com/sites/kurtrocksCommunity/_layouts/15/stream.aspx?id=%2Fsites%2FkurtrocksCommunity%2FAufzeichnungen%2F2026%2F2026%2D01%2D22%20%2D%20Microsoft%20Agents%20zum%20Selbermachen%20%2D%20PH%20Wien%2Emp4&referrer=StreamWebApp%2EWeb&referrerScenario=AddressBarCopied%2Eview&isDarkMode=true'
    const embed = parseSharePointStreamPageEmbedSrc(url)
    expect(embed).toContain('stream.aspx')
    expect(embed).toContain('id=%2Fsites%2FkurtrocksCommunity%2F')
    expect(embed).toContain('isDarkMode=true')
    expect(embed).not.toContain('referrer=')
  })
})
