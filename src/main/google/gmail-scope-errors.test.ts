import { describe, expect, it } from 'vitest'
import { isGoogleInsufficientScopeError } from './gmail-scope-errors'

describe('isGoogleInsufficientScopeError', () => {
  it('returns true for insufficient authentication scopes message', () => {
    expect(
      isGoogleInsufficientScopeError({
        code: 403,
        message: 'Request had insufficient authentication scopes.',
        errors: [{ reason: 'insufficientPermissions', message: 'Insufficient Permission' }]
      })
    ).toBe(true)
  })

  it('returns false for generic 403 without scope hint', () => {
    expect(
      isGoogleInsufficientScopeError({
        code: 403,
        message: 'Forbidden',
        errors: [{ reason: 'forbidden', message: 'Not allowed' }]
      })
    ).toBe(false)
  })
})
