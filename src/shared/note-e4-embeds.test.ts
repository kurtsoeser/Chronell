import { describe, expect, it } from 'vitest'
import {
  buildCalendlyEmbedUrl,
  isAllowedCalendlyEmbedSrc,
  parseCalendlyPath
} from './note-calendly-embed'
import { isResolvableNoteEmbedUrl } from './note-embed-url-resolve'
import {
  findNoteEmbedPasteTarget,
  isEmbeddableNoteUrl
} from './note-embed-registry'
import {
  isGoogleMapsShortUrl,
  parseGoogleMapsEmbedSrc
} from './note-google-maps-embed'
import {
  buildOpenStreetMapEmbedUrl,
  isAllowedOpenStreetMapEmbedSrc,
  parseOpenStreetMapEmbedSrc
} from './note-openstreetmap-embed'

describe('OpenStreetMap embed', () => {
  it('baut Embed aus #map-Hash', () => {
    const src = parseOpenStreetMapEmbedSrc(
      'https://www.openstreetmap.org/#map=17/48.137154/11.575382'
    )
    expect(src).toContain('openstreetmap.org/export/embed.html')
    expect(src).toContain('marker=48.137154%2C11.575382')
    expect(isAllowedOpenStreetMapEmbedSrc(buildOpenStreetMapEmbedUrl(src!))).toBe(true)
  })

  it('behält Embed-URLs bei', () => {
    const embed =
      'https://www.openstreetmap.org/export/embed.html?bbox=11.57,48.13,11.58,48.14&layer=mapnik'
    expect(parseOpenStreetMapEmbedSrc(embed)).toBe(embed)
  })
})

describe('Calendly embed', () => {
  it('erkennt Buchungslinks', () => {
    expect(parseCalendlyPath('https://calendly.com/acme-sales/30min')).toBe('acme-sales/30min')
    const embed = buildCalendlyEmbedUrl('acme-sales/30min')
    expect(embed).toContain('calendly.com/acme-sales/30min')
    expect(embed).toContain('embed_type=Inline')
    expect(isAllowedCalendlyEmbedSrc(embed)).toBe(true)
  })
})

describe('Google Maps E4 improvements', () => {
  it('erkennt pb=-Koordinaten in Place-URLs', () => {
    const src = parseGoogleMapsEmbedSrc(
      'https://www.google.com/maps/place/Berlin/@52.52,13.40,12z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d52.5200066!4d13.404954'
    )
    expect(src).toContain('52.5200066,13.404954')
    expect(src).toContain('output=embed')
  })

  it('erkennt maps.app.goo.gl als auflösbaren Kurzlink', () => {
    expect(isGoogleMapsShortUrl('https://maps.app.goo.gl/abc123')).toBe(true)
    expect(isResolvableNoteEmbedUrl('https://maps.app.goo.gl/abc123')).toBe(true)
  })
})

describe('E4 registry integration', () => {
  it('erkennt OSM und Calendly', () => {
    expect(isEmbeddableNoteUrl('https://www.openstreetmap.org/#map=15/51.5/10.5')).toBe(true)
    expect(isEmbeddableNoteUrl('https://calendly.com/acme-sales')).toBe(true)
  })

  it('findet Google-Maps-Embed-Ziel für aufgelöste URL', () => {
    const target = findNoteEmbedPasteTarget('https://www.google.com/maps/@48.2082,16.3738,14z')
    expect(target?.extensionName).toBe('noteGoogleMapsEmbed')
    expect(target?.storedValue).toContain('output=embed')
  })
})
