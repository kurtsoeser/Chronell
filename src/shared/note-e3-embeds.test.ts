import { describe, expect, it } from 'vitest'
import {
  buildCodePenEmbedUrl,
  isAllowedCodePenEmbedSrc,
  parseCodePenEmbedRef,
  serializeCodePenEmbedRef
} from './note-codepen-embed'
import {
  buildDesmosEmbedUrl,
  isAllowedDesmosEmbedSrc,
  parseDesmosEmbedRef,
  serializeDesmosEmbedRef
} from './note-desmos-embed'
import {
  buildFigmaEmbedUrl,
  isAllowedFigmaEmbedSrc,
  parseFigmaPageUrl
} from './note-figma-embed'
import {
  buildGistEmbedUrl,
  isAllowedGistEmbedSrc,
  parseGistEmbedRef,
  serializeGistEmbedRef
} from './note-gist-embed'
import {
  buildLoomEmbedUrl,
  isAllowedLoomEmbedSrc,
  parseLoomVideoId
} from './note-loom-embed'
import {
  buildMiroEmbedUrl,
  isAllowedMiroEmbedSrc,
  parseMiroBoardId
} from './note-miro-embed'
import { isEmbeddableNoteUrl } from './note-embed-registry'

describe('Desmos embed', () => {
  it('erkennt Calculator-URLs', () => {
    const ref = parseDesmosEmbedRef('https://www.desmos.com/calculator/abcd1234efgh5678')
    expect(ref).toEqual({ kind: 'calculator', id: 'abcd1234efgh5678' })
    const embed = buildDesmosEmbedUrl(serializeDesmosEmbedRef(ref!))
    expect(embed).toContain('desmos.com/calculator/abcd1234efgh5678')
    expect(embed).toContain('embed')
    expect(isAllowedDesmosEmbedSrc(embed)).toBe(true)
  })

  it('erkennt Geometry-URLs', () => {
    expect(parseDesmosEmbedRef('https://www.desmos.com/geometry/xyz98765')?.kind).toBe('geometry')
  })
})

describe('CodePen embed', () => {
  it('erkennt Pen-URLs', () => {
    const ref = parseCodePenEmbedRef('https://codepen.io/chriscoyier/pen/dYwGZm')
    expect(ref).toEqual({ owner: 'chriscoyier', penId: 'dYwGZm' })
    const embed = buildCodePenEmbedUrl(serializeCodePenEmbedRef(ref!))
    expect(embed).toBe(
      'https://codepen.io/chriscoyier/embed/dYwGZm?default-tab=result&editable=false'
    )
    expect(isAllowedCodePenEmbedSrc(embed)).toBe(true)
  })
})

describe('GitHub Gist embed', () => {
  it('erkennt Gist-URLs', () => {
    const ref = parseGistEmbedRef('https://gist.github.com/octocat/6fd8135b7abb1684f88e')
    expect(ref).toEqual({ user: 'octocat', gistId: '6fd8135b7abb1684f88e' })
    const embed = buildGistEmbedUrl(serializeGistEmbedRef(ref!))
    expect(embed).toBe('https://gist.github.com/octocat/6fd8135b7abb1684f88e')
    expect(isAllowedGistEmbedSrc(embed)).toBe(true)
  })
})

describe('Loom embed', () => {
  it('erkennt Share-URLs', () => {
    const id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
    expect(parseLoomVideoId(`https://www.loom.com/share/${id}`)).toBe(id)
    expect(isAllowedLoomEmbedSrc(buildLoomEmbedUrl(id))).toBe(true)
  })
})

describe('Figma embed', () => {
  it('baut Embed aus Design-URL', () => {
    const page = 'https://www.figma.com/design/abc123XYZ456/Project-Name'
    expect(parseFigmaPageUrl(page)).toBe('https://www.figma.com/design/abc123XYZ456/')
    const embed = buildFigmaEmbedUrl(page)
    expect(embed).toContain('figma.com/embed')
    expect(embed).toContain(encodeURIComponent('https://www.figma.com/design/abc123XYZ456/'))
    expect(isAllowedFigmaEmbedSrc(embed)).toBe(true)
  })
})

describe('Miro embed', () => {
  it('erkennt Board-URLs', () => {
    const boardId = 'uXjVNm123abc='
    expect(parseMiroBoardId(`https://miro.com/app/board/${boardId}/`)).toBe(boardId)
    const embed = buildMiroEmbedUrl(boardId)
    expect(embed).toContain('miro.com/app/live-embed/')
    expect(isAllowedMiroEmbedSrc(embed)).toBe(true)
  })
})

describe('E3 registry integration', () => {
  it('erkennt alle neuen Provider', () => {
    expect(isEmbeddableNoteUrl('https://www.desmos.com/calculator/abcd1234efgh5678')).toBe(true)
    expect(isEmbeddableNoteUrl('https://codepen.io/user/pen/abc12')).toBe(true)
    expect(isEmbeddableNoteUrl('https://gist.github.com/user/abcdef0123456789abcd')).toBe(true)
    expect(
      isEmbeddableNoteUrl('https://www.loom.com/share/a1b2c3d4-e5f6-7890-abcd-ef1234567890')
    ).toBe(true)
    expect(isEmbeddableNoteUrl('https://www.figma.com/design/abc123XYZ456/Title')).toBe(true)
    expect(isEmbeddableNoteUrl('https://miro.com/app/board/uXjVNm123abc=/')).toBe(true)
  })
})
