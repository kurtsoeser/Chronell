import { describe, expect, it } from 'vitest'
import {
  mergeGoogleOAuthScopes,
  storedGoogleScopeIncludesGmailFull
} from './google-scopes'

describe('google-scopes', () => {
  it('mergeGoogleOAuthScopes keeps broader scope after narrow refresh', () => {
    const prev =
      'openid email https://www.googleapis.com/auth/gmail.modify https://mail.google.com/'
    const incoming = 'https://www.googleapis.com/auth/gmail.modify'
    const merged = mergeGoogleOAuthScopes(prev, incoming)
    expect(storedGoogleScopeIncludesGmailFull(merged)).toBe(true)
  })

  it('storedGoogleScopeIncludesGmailFull accepts with and without trailing slash', () => {
    expect(storedGoogleScopeIncludesGmailFull('https://mail.google.com/')).toBe(true)
    expect(storedGoogleScopeIncludesGmailFull('https://mail.google.com')).toBe(true)
    expect(storedGoogleScopeIncludesGmailFull('https://www.googleapis.com/auth/gmail.modify')).toBe(
      false
    )
  })
})
