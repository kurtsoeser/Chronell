import { describe, expect, it } from 'vitest'
import { matchesFilesMailCategory } from './attachment-category'

describe('matchesFilesMailCategory', () => {
  it('matches images by mime', () => {
    expect(matchesFilesMailCategory('images', 'image/png', 'x.bin')).toBe(true)
    expect(matchesFilesMailCategory('images', 'application/pdf', 'x.pdf')).toBe(false)
  })

  it('matches archive by extension', () => {
    expect(matchesFilesMailCategory('archive', null, 'backup.zip')).toBe(true)
  })
})
