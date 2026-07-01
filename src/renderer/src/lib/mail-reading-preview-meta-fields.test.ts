import { describe, expect, it } from 'vitest'
import {
  DEFAULT_MAIL_READING_PREVIEW_META_FIELD_ORDER,
  getVisibleMailReadingPreviewMetaFields,
  parseMailReadingPreviewMetaFieldId,
  reconcileMailReadingPreviewMetaFieldOrder,
  type MailReadingPreviewMetaFieldContext
} from './mail-reading-preview-meta-fields'

const baseCtx: MailReadingPreviewMetaFieldContext = {
  dateTimeLabel: 'Mittwoch, 1. Juli 2026 · 18:23',
  folderLabel: 'Posteingang',
  fromLabel: 'Absender',
  fromAddrDetail: 'a@example.com',
  toAddrs: 'b@example.com',
  ccAddrs: null,
  categories: [],
  accountLabel: 'Konto',
  isFlagged: false,
  importance: null
}

describe('mail-reading-preview-meta-fields', () => {
  it('parses known field ids', () => {
    expect(parseMailReadingPreviewMetaFieldId('folder')).toBe('folder')
    expect(parseMailReadingPreviewMetaFieldId('unknown')).toBeNull()
  })

  it('reconciles order with missing ids appended', () => {
    const order = reconcileMailReadingPreviewMetaFieldOrder(['from', 'dateTime'])
    expect(order.indexOf('from')).toBeLessThan(order.indexOf('dateTime'))
    expect(order).toContain('categories')
    expect(order.length).toBe(DEFAULT_MAIL_READING_PREVIEW_META_FIELD_ORDER.length)
  })

  it('respects hidden fields and conditional data', () => {
    const prefs = {
      order: [...DEFAULT_MAIL_READING_PREVIEW_META_FIELD_ORDER],
      hidden: new Set(['cc', 'importance'] as const)
    }
    const visible = getVisibleMailReadingPreviewMetaFields(prefs, baseCtx)
    expect(visible).toContain('from')
    expect(visible).not.toContain('cc')
    expect(visible).not.toContain('importance')
  })
})
