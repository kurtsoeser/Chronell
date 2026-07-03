import { describe, expect, it } from 'vitest'
import {
  buildMsFormsEmbedUrl,
  isAllowedMsFormsEmbedSrc,
  isMsFormsResponseUrl,
  parseMsFormsUrl
} from './note-msforms-embed'

const FORM_ID =
  'in3TH3Ip0kSvy4GuR6W8mAcipKrzYDdFjZm7I9001YdUMElFV0dJODcyWFhEN1dPMDJONklPOUsxQiQlQCNjPTEu'

const OFFICE_URL = `https://forms.office.com/Pages/ResponsePage.aspx?id=${FORM_ID}`
const CLOUD_URL = `https://forms.cloud.microsoft/Pages/ResponsePage.aspx?id=${FORM_ID}`

describe('parseMsFormsUrl', () => {
  it('erkennt forms.office.com ResponsePage-URLs', () => {
    expect(parseMsFormsUrl(OFFICE_URL)).toEqual({
      formId: FORM_ID,
      host: 'forms.office.com'
    })
  })

  it('erkennt forms.cloud.microsoft ResponsePage-URLs', () => {
    expect(parseMsFormsUrl(CLOUD_URL)).toEqual({
      formId: FORM_ID,
      host: 'forms.cloud.microsoft'
    })
  })

  it('lehnt andere Hosts ab', () => {
    expect(parseMsFormsUrl('https://example.com/Pages/ResponsePage.aspx?id=abc')).toBeNull()
    expect(parseMsFormsUrl('https://forms.office.com/other')).toBeNull()
    expect(parseMsFormsUrl('')).toBeNull()
  })
})

describe('buildMsFormsEmbedUrl', () => {
  it('fügt embed=true hinzu', () => {
    expect(
      buildMsFormsEmbedUrl({
        formId: FORM_ID,
        host: 'forms.office.com'
      })
    ).toBe(`${OFFICE_URL}&embed=true`)
    expect(
      buildMsFormsEmbedUrl({
        formId: FORM_ID,
        host: 'forms.cloud.microsoft'
      })
    ).toBe(`${CLOUD_URL}&embed=true`)
  })
})

describe('isAllowedMsFormsEmbedSrc', () => {
  it('erlaubt nur eingebettete Forms-URLs', () => {
    expect(isAllowedMsFormsEmbedSrc(`${OFFICE_URL}&embed=true`)).toBe(true)
    expect(isAllowedMsFormsEmbedSrc(OFFICE_URL)).toBe(false)
    expect(isAllowedMsFormsEmbedSrc('https://evil.example/embed')).toBe(false)
  })
})

describe('isMsFormsResponseUrl', () => {
  it('erkennt gültige Forms-Links', () => {
    expect(isMsFormsResponseUrl(OFFICE_URL)).toBe(true)
    expect(isMsFormsResponseUrl('https://youtube.com/watch?v=dQw4w9WgXcQ')).toBe(false)
  })
})
