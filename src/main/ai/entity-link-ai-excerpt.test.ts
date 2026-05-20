import { describe, expect, it } from 'vitest'
import { excerptPlainText, AI_TEXT_EXCERPT_MAX } from './entity-link-ai-excerpt'

describe('excerptPlainText', () => {
  it('strips HTML and collapses whitespace', () => {
    expect(excerptPlainText('<p>Hello <b>world</b></p>')).toBe('Hello world')
  })

  it('truncates long text', () => {
    const long = 'a'.repeat(AI_TEXT_EXCERPT_MAX + 10)
    const out = excerptPlainText(long)
    expect(out).toHaveLength(AI_TEXT_EXCERPT_MAX + 1)
    expect(out?.endsWith('…')).toBe(true)
  })

  it('returns null for empty input', () => {
    expect(excerptPlainText('   ')).toBeNull()
  })
})
