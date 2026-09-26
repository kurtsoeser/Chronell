import { describe, expect, it } from 'vitest'
import {
  buildWebinarInvitationHtml,
  buildWebinarInvitationRenderContext
} from '@/lib/build-webinar-invitation-html'
import {
  ensureWebinarLayoutCoreSlots,
  ensureWebinarLayoutGreetingSlot,
  getDefaultWebinarInvitationLayoutTemplate,
  renderWebinarInvitationLayoutTemplate,
  webinarInvitationLayoutTemplateIssues
} from '@/lib/webinar-invitation-layout-template'

describe('webinar invitation layout template', () => {
  it('default template enthaelt alle Platzhalter', () => {
    const tpl = getDefaultWebinarInvitationLayoutTemplate()
    expect(tpl).toContain('{{greetingBlock}}')
    expect(tpl).toContain('{{teamsBlock}}')
    expect(tpl).toContain('{{signature}}')
  })

  it('render ersetzt Platzhalter', () => {
    const ctx = buildWebinarInvitationRenderContext({
      title: 'Mein Webinar',
      heroImageSrc: null,
      surveyUrl: '',
      surveyLabel: '',
      websiteUrl: '',
      websiteLabel: '',
      scheduleLabel: 'Freitag 21:00',
      teamsJoinUrl: null
    })
    const html = renderWebinarInvitationLayoutTemplate(
      '<div>{{titleBlock}}|{{scheduleBlock}}|{{teamsBlock}}</div>',
      ctx
    )
    expect(html).toContain('Mein Webinar')
    expect(html).toContain('Freitag 21:00')
    expect(html).toContain('chronell-webinar-teams-slot')
  })

  it('custom layout aus Einstellungen wird verwendet', () => {
    const html = buildWebinarInvitationHtml({
      title: 'Custom Layout Test',
      heroImageSrc: null,
      surveyUrl: '',
      surveyLabel: '',
      websiteUrl: '',
      websiteLabel: '',
      scheduleLabel: null,
      layoutHtmlTemplate: '<section data-test="wrap">{{titleBlock}}{{teamsBlock}}</section>'
    })
    expect(html).toContain('data-test="wrap"')
    expect(html).toContain('Custom Layout Test')
    expect(html).toContain('chronell-webinar-teams-slot')
  })

  it('warnt wenn Teams-Slot fehlt', () => {
    expect(
      webinarInvitationLayoutTemplateIssues('<div>{{titleBlock}}</div>')
    ).toContain('missingTeamsSlot')
  })

  it('ergaenzt fehlenden greetingBlock vor titleBlock', () => {
    expect(ensureWebinarLayoutGreetingSlot('<div>{{titleBlock}}</div>')).toContain(
      '{{greetingBlock}}'
    )
  })

  it('ergaenzt fehlende titleBlock und scheduleBlock', () => {
    const fixed = ensureWebinarLayoutCoreSlots('<div>{{greetingBlock}}{{teamsBlock}}</div>')
    expect(fixed).toContain('{{titleBlock}}')
    expect(fixed).toContain('{{scheduleBlock}}')
  })
})
