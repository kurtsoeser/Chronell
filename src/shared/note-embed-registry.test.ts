import { describe, expect, it } from 'vitest'
import {
  getNoteEmbedRegistryEntry,
  isAllowedNoteEmbedIframeSrc,
  isEmbeddableNoteUrl,
  NOTE_EMBED_REGISTRY,
  noteEmbedSanitizeDataAttrs,
  noteEmbedTiptapConfigs
} from './note-embed-registry'

describe('NOTE_EMBED_REGISTRY', () => {
  it('enthält alle zwanzig Provider', () => {
    expect(NOTE_EMBED_REGISTRY.map((entry) => entry.id)).toEqual([
      'youtube',
      'msForms',
      'geogebra',
      'googleMaps',
      'typeform',
      'twitter',
      'teamsRecording',
      'm365Video',
      'spotify',
      'vimeo',
      'soundcloud',
      'tiktok',
      'desmos',
      'codepen',
      'gist',
      'loom',
      'figma',
      'miro',
      'openstreetmap',
      'calendly'
    ])
  })

  it('liefert MS Forms ohne Factory-Konfiguration', () => {
    const msForms = getNoteEmbedRegistryEntry('msForms')
    expect(msForms?.tiptap).toBeUndefined()
    expect(msForms?.dataAttrs).toHaveLength(2)
  })

  it('liefert achtzehn Factory-TipTap-Konfigurationen', () => {
    expect(noteEmbedTiptapConfigs()).toHaveLength(18)
  })

  it('sammelt alle data-*-Attribute für den Sanitizer', () => {
    const attrs = noteEmbedSanitizeDataAttrs()
    expect(attrs).toContain('data-note-youtube-id')
    expect(attrs).toContain('data-note-msforms-host')
    expect(attrs.length).toBeGreaterThanOrEqual(8)
  })
})

describe('isEmbeddableNoteUrl', () => {
  it('erkennt registrierte URLs', () => {
    expect(isEmbeddableNoteUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true)
    expect(isEmbeddableNoteUrl('https://form.typeform.com/to/abc')).toBe(true)
    expect(isEmbeddableNoteUrl('https://example.com')).toBe(false)
  })
})

describe('isAllowedNoteEmbedIframeSrc', () => {
  it('prüft iframe-src über die Registry', () => {
    expect(
      isAllowedNoteEmbedIframeSrc(
        'https://www.youtube.com/embed/dQw4w9WgXcQ?origin=https://chronell.app'
      )
    ).toBe(true)
    expect(isAllowedNoteEmbedIframeSrc('https://evil.example/embed/x')).toBe(false)
  })
})
