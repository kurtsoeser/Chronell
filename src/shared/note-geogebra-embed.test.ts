import { describe, expect, it } from 'vitest'
import {
  buildGeoGebraEmbedUrl,
  isAllowedGeoGebraEmbedSrc,
  isGeoGebraMaterialUrl,
  parseGeoGebraMaterialId
} from './note-geogebra-embed'

const SHORT_ID = 'dwhhteev'
const NUMERIC_ID = '597519'

describe('parseGeoGebraMaterialId', () => {
  it('erkennt /m/-Links', () => {
    expect(parseGeoGebraMaterialId(`https://www.geogebra.org/m/${SHORT_ID}`)).toBe(SHORT_ID)
  })

  it('erkennt material/show-URLs', () => {
    expect(parseGeoGebraMaterialId(`https://www.geogebra.org/material/show/id/${NUMERIC_ID}`)).toBe(
      NUMERIC_ID
    )
  })

  it('erkennt App-URLs mit material-Query', () => {
    expect(parseGeoGebraMaterialId(`https://www.geogebra.org/geometry?material=${SHORT_ID}`)).toBe(
      SHORT_ID
    )
  })

  it('erkennt bestehende iframe-URLs', () => {
    expect(
      parseGeoGebraMaterialId(
        `https://www.geogebra.org/material/iframe/id/${SHORT_ID}/width/800/height/400`
      )
    ).toBe(SHORT_ID)
  })

  it('lehnt fremde Hosts ab', () => {
    expect(parseGeoGebraMaterialId('https://example.com/m/abc')).toBeNull()
    expect(parseGeoGebraMaterialId('')).toBeNull()
  })
})

describe('buildGeoGebraEmbedUrl', () => {
  it('baut eine iframe-URL mit sinnvollen Standardparametern', () => {
    const url = buildGeoGebraEmbedUrl(SHORT_ID)
    expect(url).toContain(`https://www.geogebra.org/material/iframe/id/${SHORT_ID}`)
    expect(url).toContain('sfsb/true')
    expect(url).toContain('stb/true')
  })
})

describe('isAllowedGeoGebraEmbedSrc', () => {
  it('erlaubt nur material/iframe-Pfade', () => {
    expect(isAllowedGeoGebraEmbedSrc(buildGeoGebraEmbedUrl(SHORT_ID))).toBe(true)
    expect(isAllowedGeoGebraEmbedSrc(`https://www.geogebra.org/m/${SHORT_ID}`)).toBe(false)
    expect(isAllowedGeoGebraEmbedSrc('https://evil.example/material/iframe/id/x')).toBe(false)
  })
})

describe('isGeoGebraMaterialUrl', () => {
  it('erkennt gültige GeoGebra-Links', () => {
    expect(isGeoGebraMaterialUrl(`https://www.geogebra.org/m/${SHORT_ID}`)).toBe(true)
    expect(isGeoGebraMaterialUrl('https://youtube.com/watch?v=dQw4w9WgXcQ')).toBe(false)
  })
})
