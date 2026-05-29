import { describe, expect, it } from 'vitest'
import { escapeXmlText } from './ews-soap'

describe('ews-soap', () => {
  it('escapeXmlText escapes special characters', () => {
    expect(escapeXmlText(`a&b<c>d"e'f`)).toBe('a&amp;b&lt;c&gt;d&quot;e&apos;f')
  })

  it('isEwsSyncableMailFolder skips hierarchy-only folders', async () => {
    const { isEwsSyncableMailFolder } = await import('./ews-sync-folder-items')
    expect(isEwsSyncableMailFolder('inbox')).toBe(true)
    expect(isEwsSyncableMailFolder('searchfolders')).toBe(false)
    expect(isEwsSyncableMailFolder(null)).toBe(true)
  })
})
