/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest'
import { htmlToReadablePlainText } from './html-to-readable-plain-text'

describe('htmlToReadablePlainText', () => {
  it('entfernt Markup und behaelt Text', () => {
    expect(htmlToReadablePlainText('<p>Hallo <strong>Welt</strong></p>')).toContain('Hallo Welt')
  })

  it('zeigt Link-Ziel zusaetzlich zum Label', () => {
    const out = htmlToReadablePlainText('<p><a href="https://example.com">Hier klicken</a></p>')
    expect(out).toContain('Hier klicken')
    expect(out).toContain('https://example.com')
  })

  it('gibt leeren String fuer leeres HTML', () => {
    expect(htmlToReadablePlainText('   ')).toBe('')
  })
})
