import { describe, expect, it } from 'vitest'
import { resolveMailFileVisualKind } from './mail-file-display'

describe('resolveMailFileVisualKind', () => {
  it('detects PDF', () => {
    expect(resolveMailFileVisualKind('application/pdf', 'doc.pdf')).toBe('pdf')
  })

  it('detects PNG as image', () => {
    expect(resolveMailFileVisualKind(null, 'photo.PNG')).toBe('image')
  })

  it('detects WAV as audio', () => {
    expect(resolveMailFileVisualKind('audio/wav', 'clip.wav')).toBe('audio')
  })

  it('detects xlsx as spreadsheet', () => {
    expect(resolveMailFileVisualKind(null, 'data.xlsx')).toBe('spreadsheet')
  })
})
