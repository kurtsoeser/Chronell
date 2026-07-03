import { describe, expect, it } from 'vitest'
import {
  findNoteEmbedInsertTarget,
  findNoteEmbedProviderForUrl,
  listNoteEmbedProviders,
  noteEmbedUrlLooksInsertable
} from './note-embed-insert'

describe('note-embed-insert', () => {
  it('lists all registry providers', () => {
    expect(listNoteEmbedProviders().length).toBeGreaterThanOrEqual(20)
  })

  it('detects YouTube provider and insert target', () => {
    const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
    expect(findNoteEmbedProviderForUrl(url)).toBe('youtube')
    expect(findNoteEmbedInsertTarget(url)).toEqual({
      extensionName: 'noteYoutubeEmbed',
      attrs: { value: 'dQw4w9WgXcQ' }
    })
  })

  it('detects Microsoft Forms insert target', () => {
    const url =
      'https://forms.office.com/Pages/ResponsePage.aspx?id=AbCdEfGhIjKlMnOpQrStUvWxYz'
    expect(findNoteEmbedProviderForUrl(url)).toBe('msForms')
    expect(findNoteEmbedInsertTarget(url)).toEqual({
      extensionName: 'noteMsFormsEmbed',
      attrs: {
        formId: 'AbCdEfGhIjKlMnOpQrStUvWxYz',
        host: 'forms.office.com'
      }
    })
  })

  it('treats resolvable short links as insertable', () => {
    expect(noteEmbedUrlLooksInsertable('https://maps.app.goo.gl/abc123')).toBe(true)
  })
})
