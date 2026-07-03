import { describe, expect, it } from 'vitest'
import {
  buildM365VideoEmbedRefFromInput,
  encodeGraphShareToken,
  isM365VideoShareUrl,
  parseM365VideoEmbedRef,
  parseM365VideoShareUrl,
  serializeM365VideoEmbedRef
} from './note-m365-video-embed'
import { noteM365VideoUrl, parseNoteM365VideoUrl } from './note-m365-video-url'

describe('parseM365VideoShareUrl', () => {
  it('erkennt SharePoint :v:/r/sites/…/*.mp4 Links', () => {
    const url =
      'https://kurtrocks.sharepoint.com/:v:/r/sites/Community/Shared%20Documents/Video.mp4?csf=1&web=1&e=abc'
    expect(parseM365VideoShareUrl(url)).toBe(url)
    expect(isM365VideoShareUrl(url)).toBe(true)
  })

  it('erkennt OneDrive-Kurzlinks', () => {
    const url = 'https://1drv.ms/v/s!abc123'
    expect(parseM365VideoShareUrl(url)).toBe(url)
  })

  it('lehnt normale SharePoint-Seiten ab', () => {
    expect(
      parseM365VideoShareUrl('https://contoso.sharepoint.com/sites/demo/SitePages/Home.aspx')
    ).toBeNull()
  })

  it('erkennt stream.aspx-URLs als M365-Video', () => {
    const url =
      'https://kurtrocks.sharepoint.com/sites/kurtrocksCommunity/_layouts/15/stream.aspx?id=%2Fsites%2FkurtrocksCommunity%2Fvideo.mp4'
    expect(isM365VideoShareUrl(url)).toBe(true)
    const ref = buildM365VideoEmbedRefFromInput(url)
    expect(ref?.streamEmbedSrc).toContain('stream.aspx')
    expect(ref?.playback).toBeUndefined()
  })
})

describe('encodeGraphShareToken', () => {
  it('erzeugt u!-Präfix-Token', () => {
    const token = encodeGraphShareToken('https://contoso.sharepoint.com/:v:/r/sites/x/clip.mp4')
    expect(token.startsWith('u!')).toBe(true)
    expect(token).not.toContain('+')
    expect(token).not.toContain('/')
  })
})

describe('m365 video embed ref', () => {
  it('serialisiert und parst JSON-Refs', () => {
    const ref = {
      shareUrl: 'https://contoso.sharepoint.com/:v:/r/sites/x/v.mp4',
      accountId: 'ms:home',
      driveId: 'drive1',
      itemId: 'item1',
      title: 'Demo'
    }
    const raw = serializeM365VideoEmbedRef(ref)
    expect(parseM365VideoEmbedRef(raw)).toEqual(ref)
  })
})

describe('noteM365VideoUrl', () => {
  it('kodiert Konto-IDs mit Doppelpunkt', () => {
    const src = noteM365VideoUrl('ms:abc-123', 'drive', 'item')
    expect(parseNoteM365VideoUrl(src)).toEqual({
      accountId: 'ms:abc-123',
      driveId: 'drive',
      itemId: 'item'
    })
  })
})
