import { describe, expect, it } from 'vitest'
import { isGraphThrottleError } from './graph-api-throttle-retry'

describe('isGraphThrottleError', () => {
  it('erkennt activityLimitReached', () => {
    expect(
      isGraphThrottleError({
        statusCode: 429,
        code: 'activityLimitReached',
        message: 'The app or user has been throttled.'
      })
    ).toBe(true)
  })
})
