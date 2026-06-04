import { describe, expect, it } from 'vitest'
import { hasComposeDraftContent } from './compose-draft-save'
import type { ComposeDraft } from '@/stores/compose'

function minimalDraft(overrides: Partial<ComposeDraft> = {}): ComposeDraft {
  return {
    id: 'cmp-1',
    accountId: 'acc-1',
    mode: 'reply',
    to: '',
    cc: '',
    bcc: '',
    subject: '',
    prependRichHtml: '',
    prependPlain: '',
    signatureRichHtml: '',
    signatureTemplateId: null,
    quotedHtml: '<p>quote</p>',
    attachments: [],
    referenceAttachments: [],
    showCcBcc: false,
    importance: 'normal',
    isDeliveryReceiptRequested: false,
    isReadReceiptRequested: false,
    smimeEncrypt: false,
    smimeSign: false,
    scheduledSendAt: null,
    busy: false,
    error: null,
    ...overrides
  }
}

describe('hasComposeDraftContent', () => {
  it('erkennt vorausgefuelltes An-Feld bei Antwort', () => {
    expect(hasComposeDraftContent(minimalDraft({ to: 'a@b.c' }))).toBe(true)
  })

  it('ignoriert nur Zitat ohne Empfaenger oder Text', () => {
    expect(hasComposeDraftContent(minimalDraft())).toBe(false)
  })
})
