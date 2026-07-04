// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { NOTE_INK_HTML_SOURCE_ATTR } from '@shared/note-ink-document'
import { rewriteInkBase64ToMediaUrls } from './note-ink-storage'

describe('rewriteInkBase64ToMediaUrls', () => {
  it('lässt HTML ohne Ink unverändert', async () => {
    const html = '<p>Hello</p>'
    await expect(rewriteInkBase64ToMediaUrls(1, html)).resolves.toBe(html)
  })

  it('ersetzt data:-URL durch note-media-Anhang-URL', async () => {
    const list = vi.fn().mockResolvedValue([
      {
        id: 11,
        noteId: 5,
        kind: 'local',
        name: 'Freihand 2026-07-02 14-30.ink.json',
        contentType: 'application/vnd.chronell.note-ink+json',
        size: 10,
        localPath: '/a.ink.json',
        sourceUrl: null,
        createdAt: '2026-07-02T12:00:00.000Z'
      },
      {
        id: 12,
        noteId: 5,
        kind: 'local',
        name: 'Freihand 2026-07-02 14-30.png',
        contentType: 'image/png',
        size: 20,
        localPath: '/a.png',
        sourceUrl: null,
        createdAt: '2026-07-02T12:00:00.000Z'
      }
    ])
    vi.stubGlobal('window', {
      mailClient: {
        notes: {
          attachments: { list }
        }
      }
    })

    const html = `<p><img src="data:image/png;base64,abc" class="note-ink-snapshot" ${NOTE_INK_HTML_SOURCE_ATTR}="11" /></p>`
    const next = await rewriteInkBase64ToMediaUrls(5, html)
    expect(next).toContain('note-media://attachment/5/12')
    expect(next).not.toContain('data:image/png')
    expect(next).toContain(`${NOTE_INK_HTML_SOURCE_ATTR}="11"`)
  })
})
