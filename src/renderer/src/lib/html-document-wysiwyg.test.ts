/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest'
import {
  applyHtmlDocumentWysiwygProtectedRegions,
  buildHtmlDocumentWysiwygShell,
  extractHtmlDocumentWysiwygBody
} from './html-document-wysiwyg'

describe('html-document-wysiwyg', () => {
  it('baut iframe-Shell und extrahiert Body', () => {
    const body = '<p>Hello <strong>Webinar</strong></p>'
    const shell = buildHtmlDocumentWysiwygShell(body)
    expect(shell).toContain('<body>')
    expect(shell).toContain('Hello')

    const doc = document.implementation.createHTMLDocument('')
    doc.open()
    doc.write(shell)
    doc.close()
    expect(extractHtmlDocumentWysiwygBody(doc)).toContain('Hello')
  })

  it('schuetzt Teams-Slot', () => {
    const doc = document.implementation.createHTMLDocument('')
    doc.body.innerHTML =
      '<span id="chronell-webinar-teams-slot">Teams</span><p>Editierbar</p>'
    applyHtmlDocumentWysiwygProtectedRegions(doc, ['#chronell-webinar-teams-slot'])
    const slot = doc.querySelector('#chronell-webinar-teams-slot')
    expect(slot?.getAttribute('contenteditable')).toBe('false')
    expect(slot?.getAttribute('data-wysiwyg-protected')).toBe('true')
  })
})
