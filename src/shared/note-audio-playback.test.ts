import { describe, expect, it } from 'vitest'
import { mergeAudioDurationKnown, readAudioElementDuration } from './note-audio-playback'

describe('readAudioElementDuration', () => {
  it('returns finite positive duration from audio element', () => {
    const audio = { duration: 42.5, seekable: { length: 0 } } as HTMLAudioElement
    expect(readAudioElementDuration(audio)).toBe(42.5)
  })

  it('falls back to seekable range when duration is Infinity', () => {
    const audio = {
      duration: Infinity,
      seekable: {
        length: 1,
        end: (index: number) => (index === 0 ? 18.2 : 0)
      }
    } as HTMLAudioElement
    expect(readAudioElementDuration(audio)).toBe(18.2)
  })

  it('returns 0 when no duration is known', () => {
    const audio = {
      duration: Infinity,
      seekable: { length: 0 }
    } as HTMLAudioElement
    expect(readAudioElementDuration(audio)).toBe(0)
  })
})

describe('mergeAudioDurationKnown', () => {
  it('keeps the largest known duration', () => {
    expect(mergeAudioDurationKnown(5, 12, 8, 0, Number.NaN)).toBe(12)
  })

  it('returns current when no valid candidates exist', () => {
    expect(mergeAudioDurationKnown(7, 0, -1, Number.POSITIVE_INFINITY)).toBe(7)
  })
})
