import { describe, expect, it } from 'vitest'
import {
  composeEditorHtmlToPlainText,
  composePlainTextToEditorHtml
} from './compose-proofread-text'

describe('composeEditorHtmlToPlainText', () => {
  it('wandelt Absätze und Zeilenumbrüche um', () => {
    const plain = composeEditorHtmlToPlainText('<p>Hallo<br>Welt</p><p>Zweiter</p>')
    expect(plain).toContain('Hallo')
    expect(plain).toContain('Welt')
    expect(plain).toContain('Zweiter')
  })
})

describe('composePlainTextToEditorHtml', () => {
  it('erzeugt Absatz-HTML', () => {
    expect(composePlainTextToEditorHtml('Zeile eins\n\nZeile zwei')).toBe(
      '<p>Zeile eins</p><p>Zeile zwei</p>'
    )
  })
})
