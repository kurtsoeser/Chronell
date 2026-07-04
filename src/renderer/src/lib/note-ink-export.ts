import getStroke from 'perfect-freehand'
import {
  NOTE_INK_HTML_SOURCE_ATTR,
  createNoteInkDocument,
  isDrawableInkTool,
  parseNoteInkDocument,
  type NoteInkDocument,
  type NoteInkStroke
} from '@shared/note-ink-document'

export { parseNoteInkDocument, createNoteInkDocument }
export type { NoteInkDocument, NoteInkStroke }

const PEN_RENDER_OPTIONS = {
  thinning: 0.6,
  smoothing: 0.5,
  streamline: 0.4,
  easing: (t: number): number => Math.sin((t * Math.PI) / 2)
} as const

/** perfect-freehand-Umriss → SVG-Pfad (geschlossenes Polygon). */
export function getSvgPathFromStrokeOutline(outline: number[][]): string {
  if (!outline.length) return ''

  const max = outline.length - 1
  return outline
    .map(([x, y], i) => {
      if (i === 0) return `M ${x} ${y}`
      const [prevX, prevY] = outline[i - 1]!
      const midX = (prevX + x) / 2
      const midY = (prevY + y) / 2
      return `Q ${prevX} ${prevY} ${midX} ${midY}`
    })
    .join(' ')
    .concat(max > 0 ? ` Q ${outline[max]![0]} ${outline[max]![1]} ${outline[0]![0]} ${outline[0]![1]} Z` : ' Z')
}

const HIGHLIGHTER_FILL_OPACITY = 0.35

export interface NoteInkStrokeSvgRender {
  d: string
  fill: string
  fillOpacity?: number
}

export function strokeToSvgRender(stroke: NoteInkStroke): NoteInkStrokeSvgRender | null {
  if (!isDrawableInkTool(stroke.tool) || stroke.points.length === 0) return null
  const input = stroke.points.map((p) => [p.x, p.y, p.pressure] as [number, number, number])
  const simulatePressure = stroke.points.every((p) => p.pressure === 0.5)
  const outline = getStroke(input, {
    ...PEN_RENDER_OPTIONS,
    size: stroke.size,
    simulatePressure
  })
  const d = getSvgPathFromStrokeOutline(outline)
  if (!d) return null
  return {
    d,
    fill: stroke.color,
    fillOpacity: stroke.tool === 'highlighter' ? HIGHLIGHTER_FILL_OPACITY : undefined
  }
}

export function strokeToSvgPath(stroke: NoteInkStroke): string {
  return strokeToSvgRender(stroke)?.d ?? ''
}

export function strokesToSvgMarkup(
  strokes: NoteInkStroke[],
  width: number,
  height: number,
  background = '#ffffff'
): string {
  const paths = strokes
    .map((stroke) => {
      const rendered = strokeToSvgRender(stroke)
      if (!rendered) return ''
      const opacity =
        rendered.fillOpacity != null ? ` fill-opacity="${rendered.fillOpacity}"` : ''
      return `<path d="${rendered.d}" fill="${rendered.fill}"${opacity} />`
    })
    .filter(Boolean)
    .join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="${background}" />${paths}</svg>`
}

export function buildNoteInkInsertHtml(imageSrc: string, inkJsonAttachmentId: number): string {
  const safeSrc = imageSrc.replace(/"/g, '&quot;')
  return `<p><img src="${safeSrc}" alt="Freihandzeichnung" class="mail-compose-image note-ink-snapshot" ${NOTE_INK_HTML_SOURCE_ATTR}="${inkJsonAttachmentId}" /></p>`
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = (): void => resolve(img)
    img.onerror = (): void => reject(new Error('Ink-Vorschau konnte nicht gerendert werden.'))
    img.src = dataUrl
  })
}

export async function strokesToPngBlob(
  strokes: NoteInkStroke[],
  width: number,
  height: number,
  background = '#ffffff'
): Promise<Blob> {
  if (typeof document === 'undefined') {
    throw new Error('PNG-Export ist nur im Renderer verfügbar.')
  }

  const svg = strokesToSvgMarkup(strokes, width, height, background)
  const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(svgBlob)

  try {
    const img = await loadImage(url)
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(width))
    canvas.height = Math.max(1, Math.round(height))
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas-Kontext nicht verfügbar.')
    ctx.fillStyle = background
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/png')
    })
    if (!blob) throw new Error('PNG konnte nicht erzeugt werden.')
    return blob
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function strokesToPngDataUrl(
  strokes: NoteInkStroke[],
  width: number,
  height: number,
  background = '#ffffff'
): Promise<string> {
  const blob = await strokesToPngBlob(strokes, width, height, background)
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (): void => resolve(String(reader.result ?? ''))
    reader.onerror = (): void => reject(reader.error ?? new Error('PNG konnte nicht gelesen werden.'))
    reader.readAsDataURL(blob)
  })
}
