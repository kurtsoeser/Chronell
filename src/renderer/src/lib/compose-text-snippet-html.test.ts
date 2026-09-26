import { describe, expect, it } from 'vitest'
import { isComposeSnippetHtmlEmpty } from './compose-text-snippet-selection'

describe('isComposeSnippetHtmlEmpty', () => {
  it('treats image-only snippets as non-empty', () => {
    expect(isComposeSnippetHtmlEmpty('<p><img src="data:image/png;base64,x" alt=""></p>')).toBe(
      false
    )
    expect(isComposeSnippetHtmlEmpty('<p></p>')).toBe(true)
    expect(isComposeSnippetHtmlEmpty('<p>Hi</p>')).toBe(false)
  })
})
