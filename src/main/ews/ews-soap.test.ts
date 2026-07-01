import { describe, expect, it } from 'vitest'
import { escapeXmlText } from './ews-soap'
import { isEwsSyncableMailFolder } from './ews-sync-folder-items'

describe('ews-soap', () => {
  it('escapeXmlText escapes special characters', () => {
    expect(escapeXmlText(`a&b<c>d"e'f`)).toBe('a&amp;b&lt;c&gt;d&quot;e&apos;f')
  })

  it('isEwsSyncableMailFolder skips hierarchy-only folders', () => {
    expect(isEwsSyncableMailFolder('inbox')).toBe(true)
    expect(isEwsSyncableMailFolder('searchfolders')).toBe(false)
    expect(isEwsSyncableMailFolder(null)).toBe(true)
  })
})
