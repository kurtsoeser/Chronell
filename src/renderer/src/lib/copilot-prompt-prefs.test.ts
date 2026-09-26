/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  persistCopilotPromptPrefs,
  readCopilotPromptPrefs,
  resetAllCopilotPromptPrefs,
  resolveCopilotPrompt,
  setCopilotPromptPref
} from './copilot-prompt-prefs'

describe('copilot-prompt-prefs', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    window.localStorage.clear()
  })

  it('resolves i18n default when empty', () => {
    const t = vi.fn((key: string) => `default:${key}`)
    expect(resolveCopilotPrompt('mail.summarize', t)).toBe(
      'default:copilot.mail.summarizePrompt'
    )
    expect(t).toHaveBeenCalledWith('copilot.mail.summarizePrompt')
  })

  it('persists and resolves custom prompt', () => {
    setCopilotPromptPref('mail.summarize', '  Mein Prompt  ')
    expect(readCopilotPromptPrefs()['mail.summarize']).toBe('Mein Prompt')
    expect(resolveCopilotPrompt('mail.summarize', () => 'default')).toBe('Mein Prompt')
  })

  it('clears blank customs', () => {
    persistCopilotPromptPrefs({ 'mail.summarize': 'x', 'compose.new': '  ' })
    expect(readCopilotPromptPrefs()).toEqual({ 'mail.summarize': 'x' })
    resetAllCopilotPromptPrefs()
    expect(readCopilotPromptPrefs()).toEqual({})
  })
})
