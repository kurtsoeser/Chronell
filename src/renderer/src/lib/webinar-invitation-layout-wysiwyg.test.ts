/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest'
import { DEFAULT_WEBINAR_INVITATION_DEFAULTS } from '@/lib/webinar-invitation-defaults-storage'
import {
  buildWebinarSettingsLayoutEditorHtml,
  buildWebinarSettingsSampleFields,
  collapseWebinarLayoutEditorHtmlToTemplate,
  expandWebinarLayoutTemplateForSettingsEditor,
  insertWebinarLayoutSlotIntoTemplate,
  normalizeWebinarLayoutTemplateForStorage
} from '@/lib/webinar-invitation-layout-wysiwyg'
import {
  getDefaultWebinarInvitationLayoutTemplate,
  renderWebinarInvitationLayoutTemplate
} from '@/lib/webinar-invitation-layout-template'
import {
  buildWebinarInvitationHtml,
  buildWebinarHeroImageSlotPreviewHtml,
  buildWebinarInvitationRenderContext
} from '@/lib/build-webinar-invitation-html'

describe('webinar invitation layout wysiwyg', () => {
  it('expandiert dynamische Slots als geschuetzte Bereiche', () => {
    const context = buildWebinarInvitationRenderContext(
      buildWebinarSettingsSampleFields(DEFAULT_WEBINAR_INVITATION_DEFAULTS)
    )
    const html = expandWebinarLayoutTemplateForSettingsEditor(
      getDefaultWebinarInvitationLayoutTemplate(),
      context
    )
    expect(html).toContain('data-chronell-layout-slot="titleBlock"')
    expect(html).toContain('Beispiel-Webinar')
    expect(html).toContain('chronell-webinar-teams-slot')
    expect(html).not.toContain('{{titleBlock}}')
  })

  it('roundtrip expand → collapse behaelt teamsBlock-Platzhalter', () => {
    const context = buildWebinarInvitationRenderContext(
      buildWebinarSettingsSampleFields(DEFAULT_WEBINAR_INVITATION_DEFAULTS)
    )
    const expanded = expandWebinarLayoutTemplateForSettingsEditor(
      getDefaultWebinarInvitationLayoutTemplate(),
      context
    )
    const collapsed = collapseWebinarLayoutEditorHtmlToTemplate(expanded)
    expect(collapsed).toContain('{{teamsBlock}}')
    expect(collapsed).toContain('{{titleBlock}}')
    expect(collapsed).toContain('{{greetingBlock}}')
    expect(renderWebinarInvitationLayoutTemplate(collapsed, context)).toContain('Beispiel-Webinar')
    expect(renderWebinarInvitationLayoutTemplate(collapsed, context)).toContain('Webinarteilnehmerin')
  })

  it('baut Einstellungs-Editor-HTML aus gespeicherten Defaults', () => {
    const html = buildWebinarSettingsLayoutEditorHtml(
      DEFAULT_WEBINAR_INVITATION_DEFAULTS,
      'Hero-Bild — pro Webinar-Termin'
    )
    expect(html).toContain('Hinweise')
    expect(html).toContain('#kurtrocks')
    expect(html).toContain('Webinarteilnehmerin')
    expect(html).toContain('data-chronell-layout-slot="greetingBlock"')
    expect(html).toContain('data-chronell-layout-slot="heroImageBlock"')
  })

  it('fuegt fehlenden heroImageBlock in Vorlage ein', () => {
    const tpl = getDefaultWebinarInvitationLayoutTemplate().replace('{{heroImageBlock}}\n', '')
    const next = insertWebinarLayoutSlotIntoTemplate(tpl, 'heroImageBlock')
    expect(next).toContain('{{heroImageBlock}}')
  })

  it('ersetzt eingebackenen Hero-Platzhalter durch Bild beim Rendern', () => {
    const baked = getDefaultWebinarInvitationLayoutTemplate().replace(
      '{{heroImageBlock}}',
      buildWebinarHeroImageSlotPreviewHtml('Platzhalter')
    )
    const html = buildWebinarInvitationHtml({
      title: 'Test',
      heroImageSrc: 'data:image/png;base64,abc',
      surveyUrl: '',
      surveyLabel: '',
      websiteUrl: '',
      websiteLabel: '',
      scheduleLabel: null,
      layoutHtmlTemplate: baked
    })
    expect(html).toContain('data:image/png;base64,abc')
    expect(html).not.toContain('chronell-webinar-hero-slot')
  })

  it('speichert Standardlayout als null', () => {
    const context = buildWebinarInvitationRenderContext(
      buildWebinarSettingsSampleFields(DEFAULT_WEBINAR_INVITATION_DEFAULTS)
    )
    const expanded = expandWebinarLayoutTemplateForSettingsEditor(
      getDefaultWebinarInvitationLayoutTemplate(),
      context
    )
    expect(
      normalizeWebinarLayoutTemplateForStorage(
        expanded,
        DEFAULT_WEBINAR_INVITATION_DEFAULTS,
        'Hero-Bild — pro Webinar-Termin'
      )
    ).toBeNull()
  })
})
