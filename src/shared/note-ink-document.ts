export const NOTE_INK_DOCUMENT_VERSION = 1 as const

export const NOTE_INK_CONTENT_TYPE = 'application/vnd.chronell.note-ink+json' as const

export const NOTE_INK_HTML_SOURCE_ATTR = 'data-chronell-ink-source' as const

export type NoteInkTool = 'pen' | 'eraser' | 'highlighter'

export function isDrawableInkTool(tool: NoteInkTool): boolean {
  return tool === 'pen' || tool === 'highlighter'
}

export interface NoteInkPoint {
  x: number
  y: number
  /** 0..1, default 0.5 wenn nicht unterstützt */
  pressure: number
}

export interface NoteInkStroke {
  id: string
  tool: NoteInkTool
  color: string
  size: number
  points: NoteInkPoint[]
}

export interface NoteInkDocument {
  version: typeof NOTE_INK_DOCUMENT_VERSION
  canvasWidth: number
  canvasHeight: number
  strokes: NoteInkStroke[]
  createdAt: string
}

export {
  NOTE_INK_BUILTIN_HIGHLIGHTER_COLORS,
  NOTE_INK_BUILTIN_PEN_COLORS,
  NOTE_INK_DEFAULT_COLORS,
  NOTE_INK_HIGHLIGHTER_COLORS,
  mergeInkColorPalette,
  normalizeInkHexColor
} from './note-ink-colors'

export function createNoteInkDocument(
  strokes: NoteInkStroke[],
  canvasWidth: number,
  canvasHeight: number,
  createdAt = new Date().toISOString()
): NoteInkDocument {
  return {
    version: NOTE_INK_DOCUMENT_VERSION,
    canvasWidth,
    canvasHeight,
    strokes: strokes.filter((s) => isDrawableInkTool(s.tool) && s.points.length > 0),
    createdAt
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNoteInkPoint(value: unknown): value is NoteInkPoint {
  if (!isRecord(value)) return false
  return (
    typeof value.x === 'number' &&
    Number.isFinite(value.x) &&
    typeof value.y === 'number' &&
    Number.isFinite(value.y) &&
    typeof value.pressure === 'number' &&
    Number.isFinite(value.pressure)
  )
}

function isNoteInkStroke(value: unknown): value is NoteInkStroke {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'string' &&
    (value.tool === 'pen' || value.tool === 'eraser' || value.tool === 'highlighter') &&
    typeof value.color === 'string' &&
    typeof value.size === 'number' &&
    Number.isFinite(value.size) &&
    Array.isArray(value.points) &&
    value.points.every(isNoteInkPoint)
  )
}

export function isNoteInkDocument(value: unknown): value is NoteInkDocument {
  if (!isRecord(value)) return false
  return (
    value.version === NOTE_INK_DOCUMENT_VERSION &&
    typeof value.canvasWidth === 'number' &&
    value.canvasWidth > 0 &&
    typeof value.canvasHeight === 'number' &&
    value.canvasHeight > 0 &&
    typeof value.createdAt === 'string' &&
    Array.isArray(value.strokes) &&
    value.strokes.every(isNoteInkStroke)
  )
}

export function parseNoteInkDocument(json: string): NoteInkDocument {
  let parsed: unknown
  try {
    parsed = JSON.parse(json) as unknown
  } catch {
    throw new Error('Ungültiges Ink-JSON.')
  }
  if (!isNoteInkDocument(parsed)) {
    throw new Error('Ink-Dokument hat ein unbekanntes Format.')
  }
  return parsed
}
