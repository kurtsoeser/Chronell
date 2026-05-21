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

  it('erkennt Bookings-Drosselung als HTTP 500 mit Too Many Requests', () => {
    expect(
      isGraphThrottleError({
        statusCode: 500,
        code: 'InternalServerError',
        message: 'Too Many Requests',
        body: '{"code":"InternalServerError","message":"Too Many Requests"}'
      })
    ).toBe(true)
  })
})
