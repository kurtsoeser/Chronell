import { describe, expect, it, vi, afterEach } from 'vitest'
import { mergeGoogleOAuthScopes, storedGoogleScopeIncludesGmailFull } from '../auth/google-scopes'
import { fetchGoogleAccessTokenScopes, resolveGoogleCredentialScopes } from './google-token-scope'

describe('google-token-scope', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('resolveGoogleCredentialScopes merges tokeninfo scopes with stored', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          scope:
            'openid email https://www.googleapis.com/auth/gmail.modify https://mail.google.com/'
        })
      }))
    )

    const merged = await resolveGoogleCredentialScopes({
      scope: 'openid https://www.googleapis.com/auth/gmail.modify',
      access_token: 'test-token'
    })
    expect(storedGoogleScopeIncludesGmailFull(merged)).toBe(true)
  })

  it('fetchGoogleAccessTokenScopes returns empty on failed tokeninfo', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        json: async () => ({})
      }))
    )
    const scopes = await fetchGoogleAccessTokenScopes('bad')
    expect(scopes).toEqual([])
    expect(mergeGoogleOAuthScopes('openid', null)).toBe('openid')
  })
})
