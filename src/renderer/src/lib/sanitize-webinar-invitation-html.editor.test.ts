/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest'
import { buildWebinarSettingsLayoutEditorHtml } from '@/lib/webinar-invitation-layout-wysiwyg'
import { DEFAULT_WEBINAR_INVITATION_DEFAULTS } from '@/lib/webinar-invitation-defaults-storage'
import { sanitizeWebinarInvitationHtml } from '@/lib/sanitize-webinar-invitation-html'
import { buildHtmlDocumentWysiwygShell } from '@/lib/html-document-wysiwyg'

describe('sanitize webinar editor html', () => {
  it('behält expandiertes Einstellungs-HTML', () => {
    const html = buildWebinarSettingsLayoutEditorHtml(
      DEFAULT_WEBINAR_INVITATION_DEFAULTS,
      'Hero-Bild — pro Webinar-Termin'
    )
    expect(html.length).toBeGreaterThan(500)
    const safe = sanitizeWebinarInvitationHtml(html)
    expect(safe.length).toBeGreaterThan(500)
    expect(safe).toContain('#kurtrocks')
    expect(safe).toContain('Beispiel-Webinar')
  })

  it('behält HTML nach iframe-Shell-Roundtrip', () => {
    const html = buildWebinarSettingsLayoutEditorHtml(
      DEFAULT_WEBINAR_INVITATION_DEFAULTS,
      'Hero'
    )
    const doc = document.implementation.createHTMLDocument('')
    doc.open()
    doc.write(buildHtmlDocumentWysiwygShell(sanitizeWebinarInvitationHtml(html)))
    doc.close()
    const round = sanitizeWebinarInvitationHtml(doc.body.innerHTML.trim())
    expect(round.length).toBeGreaterThan(500)
    expect(round).toContain('Beispiel-Webinar')
  })
})
