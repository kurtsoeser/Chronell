import { describe, expect, it } from 'vitest'
import {
  googleAuthUnavailableUserMessage,
  isGoogleAuthUnavailable,
  isMicrosoftAuthUnavailable,
  isProviderAuthUnavailable,
  providerAuthUnavailableUserMessage
} from './auth-errors'

describe('isGoogleAuthUnavailable', () => {
  it('erkennt Gaxios invalid_grant', () => {
    const err = {
      message: 'invalid_grant',
      response: {
        data: {
          error: 'invalid_grant',
          error_description: 'Token has been expired or revoked.'
        }
      }
    }
    expect(isGoogleAuthUnavailable(err)).toBe(true)
    expect(isProviderAuthUnavailable(err)).toBe(true)
    expect(providerAuthUnavailableUserMessage(err)).toBe(googleAuthUnavailableUserMessage())
  })

  it('erkennt keine normalen API-Fehler', () => {
    expect(isGoogleAuthUnavailable(new Error('Not Found'))).toBe(false)
    expect(isMicrosoftAuthUnavailable(new Error('invalid_grant'))).toBe(false)
  })
})
