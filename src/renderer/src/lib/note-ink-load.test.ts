import { describe, expect, it } from 'vitest'
import {
  findPngAttachmentForInkJson,
  pngAttachmentNameForInkJson
} from './note-ink-load'

describe('pngAttachmentNameForInkJson', () => {
  it('ersetzt .ink.json durch .png', () => {
    expect(pngAttachmentNameForInkJson('Freihand 2026-07-02 14-30.ink.json')).toBe(
      'Freihand 2026-07-02 14-30.png'
    )
  })
})

describe('findPngAttachmentForInkJson', () => {
  it('findet passenden PNG-Anhang', () => {
    const ink = {
      id: 1,
      noteId: 5,
      kind: 'local' as const,
      name: 'Freihand 2026-07-02 14-30.ink.json',
      contentType: 'application/vnd.chronell.note-ink+json',
      size: 10,
      localPath: '/a.ink.json',
      sourceUrl: null,
      createdAt: '2026-07-02T12:00:00.000Z'
    }
    const png = {
      ...ink,
      id: 2,
      name: 'Freihand 2026-07-02 14-30.png',
      contentType: 'image/png'
    }
    expect(findPngAttachmentForInkJson(ink, [ink, png])).toEqual(png)
  })
})
