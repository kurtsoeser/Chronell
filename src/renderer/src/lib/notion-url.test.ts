import { describe, expect, it } from 'vitest'
import { toNotionAppUrl } from './notion-url'

describe('toNotionAppUrl', () => {
  it('konvertiert klassische notion.so-URLs', () => {
    expect(toNotionAppUrl('https://www.notion.so/Page-abc123')).toBe(
      'notion://www.notion.so/Page-abc123'
    )
    expect(toNotionAppUrl('https://notion.so/Page-abc123')).toBe('notion://notion.so/Page-abc123')
  })

  it('konvertiert neue app.notion.com-URLs', () => {
    expect(
      toNotionAppUrl('https://app.notion.com/p/Bug-bash-be633bf1dfa0436db259571129a590e5')
    ).toBe('notion://app.notion.com/p/Bug-bash-be633bf1dfa0436db259571129a590e5')
  })

  it('akzeptiert notion.site und notion.com', () => {
    expect(toNotionAppUrl('https://jm-testing.notion.site/p1-6df2c07bfc6b4c46815ad205d132e22d')).toBe(
      'notion://jm-testing.notion.site/p1-6df2c07bfc6b4c46815ad205d132e22d'
    )
    expect(toNotionAppUrl('https://www.notion.com/workspace/page')).toBe(
      'notion://www.notion.com/workspace/page'
    )
  })

  it('lässt notion:// unverändert', () => {
    expect(toNotionAppUrl('notion://www.notion.so/x')).toBe('notion://www.notion.so/x')
  })

  it('wirft bei ungueltigen URLs', () => {
    expect(() => toNotionAppUrl('')).toThrow('Keine Notion-URL.')
    expect(() => toNotionAppUrl('https://example.com/x')).toThrow('Ungueltige Notion-Web-URL.')
    expect(() => toNotionAppUrl('not-a-url')).toThrow('Ungueltige Notion-Web-URL.')
  })
})
