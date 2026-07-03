import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import {
  NOTE_INK_DEFAULT_COLORS,
  NOTE_INK_HIGHLIGHTER_COLORS,
  isDrawableInkTool,
  type NoteInkDocument,
  type NoteInkPoint,
  type NoteInkStroke,
  type NoteInkTool
} from '@shared/note-ink-document'

const MAX_UNDO = 50
const DEFAULT_STROKE_SIZE = 4
const DEFAULT_HIGHLIGHTER_SIZE = 16
const MIN_STROKE_SIZE = 2
const MAX_STROKE_SIZE = 24
const MIN_HIGHLIGHTER_SIZE = 8
const MAX_HIGHLIGHTER_SIZE = 32
const ERASER_HIT_PADDING = 6

export const NOTE_INK_STROKE_SIZE = {
  min: MIN_STROKE_SIZE,
  max: MAX_STROKE_SIZE,
  default: DEFAULT_STROKE_SIZE
} as const

export { NOTE_INK_DEFAULT_COLORS, NOTE_INK_HIGHLIGHTER_COLORS }

function strokeSizeLimits(tool: NoteInkTool): { min: number; max: number; defaultSize: number } {
  if (tool === 'highlighter') {
    return { min: MIN_HIGHLIGHTER_SIZE, max: MAX_HIGHLIGHTER_SIZE, defaultSize: DEFAULT_HIGHLIGHTER_SIZE }
  }
  return { min: MIN_STROKE_SIZE, max: MAX_STROKE_SIZE, defaultSize: DEFAULT_STROKE_SIZE }
}

function createStrokeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `stroke-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function cloneStrokes(strokes: NoteInkStroke[]): NoteInkStroke[] {
  return strokes.map((stroke) => ({
    ...stroke,
    points: stroke.points.map((p) => ({ ...p }))
  }))
}

function strokeBoundingBox(stroke: NoteInkStroke): {
  minX: number
  minY: number
  maxX: number
  maxY: number
} | null {
  if (stroke.points.length === 0) return null
  let minX = stroke.points[0]!.x
  let minY = stroke.points[0]!.y
  let maxX = minX
  let maxY = minY
  for (const p of stroke.points) {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  const pad = stroke.size / 2 + ERASER_HIT_PADDING
  return { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad }
}

function pointHitsStroke(x: number, y: number, stroke: NoteInkStroke): boolean {
  const box = strokeBoundingBox(stroke)
  if (!box) return false
  return x >= box.minX && x <= box.maxX && y >= box.minY && y <= box.maxY
}

function pointerToPoint(event: ReactPointerEvent, element: HTMLElement): NoteInkPoint {
  const rect = element.getBoundingClientRect()
  const pressure = event.pressure > 0 ? event.pressure : 0.5
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
    pressure
  }
}

export interface UseNoteInkCanvasOptions {
  initialDocument?: NoteInkDocument | null
}

export interface UseNoteInkCanvasResult {
  containerRef: (node: HTMLDivElement | null) => void
  canvasWidth: number
  canvasHeight: number
  strokes: NoteInkStroke[]
  activeStroke: NoteInkStroke | null
  tool: NoteInkTool
  color: string
  strokeSize: number
  canUndo: boolean
  canRedo: boolean
  hasDrawableContent: boolean
  setTool: (tool: NoteInkTool) => void
  setColor: (color: string) => void
  setStrokeSize: (size: number) => void
  undo: () => void
  redo: () => void
  clearAll: () => void
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void
  onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void
  onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void
  onPointerCancel: (event: ReactPointerEvent<HTMLDivElement>) => void
  getExportStrokes: () => NoteInkStroke[]
}

export function useNoteInkCanvas(options: UseNoteInkCanvasOptions = {}): UseNoteInkCanvasResult {
  const initialStrokes = options.initialDocument?.strokes ?? []
  const [strokes, setStrokes] = useState<NoteInkStroke[]>(() => cloneStrokes(initialStrokes))
  const [activeStroke, setActiveStroke] = useState<NoteInkStroke | null>(null)
  const [tool, setTool] = useState<NoteInkTool>('pen')
  const [color, setColor] = useState<string>(NOTE_INK_DEFAULT_COLORS[0])
  const [strokeSize, setStrokeSizeState] = useState(DEFAULT_STROKE_SIZE)
  const [canvasWidth, setCanvasWidth] = useState(options.initialDocument?.canvasWidth ?? 0)
  const [canvasHeight, setCanvasHeight] = useState(options.initialDocument?.canvasHeight ?? 0)

  const undoStackRef = useRef<NoteInkStroke[][]>([])
  const redoStackRef = useRef<NoteInkStroke[][]>([])
  const strokesRef = useRef(strokes)
  const activeStrokeRef = useRef<NoteInkStroke | null>(null)
  const surfaceRef = useRef<HTMLDivElement | null>(null)
  const resizeCleanupRef = useRef<(() => void) | null>(null)
  const drawingPointerIdRef = useRef<number | null>(null)
  const eraserChangedRef = useRef(false)
  const [historyRevision, setHistoryRevision] = useState(0)

  strokesRef.current = strokes
  activeStrokeRef.current = activeStroke

  const syncHistory = useCallback((): void => {
    setHistoryRevision((n) => n + 1)
  }, [])

  const pushUndo = useCallback(
    (snapshot: NoteInkStroke[]): void => {
      undoStackRef.current.push(cloneStrokes(snapshot))
      if (undoStackRef.current.length > MAX_UNDO) {
        undoStackRef.current.shift()
      }
      redoStackRef.current = []
      syncHistory()
    },
    [syncHistory]
  )

  const applyStrokes = useCallback((next: NoteInkStroke[]): void => {
    strokesRef.current = next
    setStrokes(next)
  }, [])

  const containerRef = useCallback((node: HTMLDivElement | null): void => {
    resizeCleanupRef.current?.()
    resizeCleanupRef.current = null
    surfaceRef.current = node
    if (!node) return
    const updateSize = (): void => {
      setCanvasWidth(Math.max(1, Math.round(node.clientWidth)))
      setCanvasHeight(Math.max(1, Math.round(node.clientHeight)))
    }
    updateSize()
    const observer = new ResizeObserver(updateSize)
    observer.observe(node)
    resizeCleanupRef.current = (): void => observer.disconnect()
  }, [])

  useEffect(() => {
    return (): void => {
      resizeCleanupRef.current?.()
      resizeCleanupRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!options.initialDocument) return
    const next = cloneStrokes(options.initialDocument.strokes)
    applyStrokes(next)
    setCanvasWidth(options.initialDocument.canvasWidth)
    setCanvasHeight(options.initialDocument.canvasHeight)
    undoStackRef.current = []
    redoStackRef.current = []
    syncHistory()
    setActiveStroke(null)
    activeStrokeRef.current = null
  }, [applyStrokes, options.initialDocument, syncHistory])

  const eraseAt = useCallback(
    (x: number, y: number): boolean => {
      const current = strokesRef.current
      const remaining = current.filter((stroke) => !pointHitsStroke(x, y, stroke))
      if (remaining.length === current.length) return false
      applyStrokes(remaining)
      return true
    },
    [applyStrokes]
  )

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>): void => {
      if (event.button !== 0) return
      const surface = surfaceRef.current
      if (!surface) return

      event.preventDefault()
      surface.setPointerCapture(event.pointerId)
      drawingPointerIdRef.current = event.pointerId

      const point = pointerToPoint(event, surface)

      if (tool === 'eraser') {
        eraserChangedRef.current = false
        pushUndo(strokesRef.current)
        if (eraseAt(point.x, point.y)) {
          eraserChangedRef.current = true
        } else {
          undoStackRef.current.pop()
          syncHistory()
        }
        return
      }

      pushUndo(strokesRef.current)
      const drawTool = tool === 'highlighter' ? 'highlighter' : 'pen'
      const stroke: NoteInkStroke = {
        id: createStrokeId(),
        tool: drawTool,
        color,
        size: strokeSize,
        points: [point]
      }
      activeStrokeRef.current = stroke
      setActiveStroke(stroke)
    },
    [color, eraseAt, pushUndo, strokeSize, tool]
  )

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>): void => {
      if (drawingPointerIdRef.current !== event.pointerId) return
      const surface = surfaceRef.current
      if (!surface) return

      event.preventDefault()
      const point = pointerToPoint(event, surface)

      if (tool === 'eraser') {
        if (eraseAt(point.x, point.y)) {
          eraserChangedRef.current = true
        }
        return
      }

      const current = activeStrokeRef.current
      if (!current) return
      const last = current.points[current.points.length - 1]
      if (last && last.x === point.x && last.y === point.y) return

      const nextStroke: NoteInkStroke = {
        ...current,
        points: [...current.points, point]
      }
      activeStrokeRef.current = nextStroke
      setActiveStroke(nextStroke)
    },
    [eraseAt, tool]
  )

  const finishPointer = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>): void => {
      if (drawingPointerIdRef.current !== event.pointerId) return
      const surface = surfaceRef.current
      if (surface?.hasPointerCapture(event.pointerId)) {
        surface.releasePointerCapture(event.pointerId)
      }
      drawingPointerIdRef.current = null

      if (tool === 'eraser') {
        if (!eraserChangedRef.current) {
          undoStackRef.current.pop()
          syncHistory()
        }
        eraserChangedRef.current = false
        return
      }

      const current = activeStrokeRef.current
      activeStrokeRef.current = null
      setActiveStroke(null)
      if (!current || current.points.length === 0) {
        undoStackRef.current.pop()
        syncHistory()
        return
      }

      applyStrokes([...strokesRef.current, current])
    },
    [applyStrokes, syncHistory, tool]
  )

  const onPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>): void => {
      finishPointer(event)
    },
    [finishPointer]
  )

  const onPointerCancel = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>): void => {
      finishPointer(event)
    },
    [finishPointer]
  )

  const undo = useCallback((): void => {
    const previous = undoStackRef.current.pop()
    if (!previous) return
    redoStackRef.current.push(cloneStrokes(strokesRef.current))
    activeStrokeRef.current = null
    setActiveStroke(null)
    applyStrokes(cloneStrokes(previous))
    syncHistory()
  }, [applyStrokes, syncHistory])

  const redo = useCallback((): void => {
    const next = redoStackRef.current.pop()
    if (!next) return
    undoStackRef.current.push(cloneStrokes(strokesRef.current))
    activeStrokeRef.current = null
    setActiveStroke(null)
    applyStrokes(cloneStrokes(next))
    syncHistory()
  }, [applyStrokes, syncHistory])

  const clearAll = useCallback((): void => {
    if (strokesRef.current.length === 0 && !activeStrokeRef.current) return
    pushUndo(strokesRef.current)
    activeStrokeRef.current = null
    setActiveStroke(null)
    applyStrokes([])
  }, [applyStrokes, pushUndo])

  const setStrokeSize = useCallback((size: number): void => {
    const limits = strokeSizeLimits(tool)
    setStrokeSizeState(Math.min(limits.max, Math.max(limits.min, size)))
  }, [tool])

  const setToolWithDefaults = useCallback((next: NoteInkTool): void => {
    setTool(next)
    const limits = strokeSizeLimits(next)
    setStrokeSizeState(limits.defaultSize)
    if (next === 'highlighter') {
      setColor(NOTE_INK_HIGHLIGHTER_COLORS[0])
    } else if (next === 'pen') {
      setColor(NOTE_INK_DEFAULT_COLORS[0])
    }
  }, [])

  const getExportStrokes = useCallback((): NoteInkStroke[] => {
    const all = activeStrokeRef.current
      ? [...strokesRef.current, activeStrokeRef.current]
      : strokesRef.current
    return cloneStrokes(all.filter((s) => isDrawableInkTool(s.tool) && s.points.length > 0))
  }, [])

  const hasDrawableContent =
    strokes.some((s) => isDrawableInkTool(s.tool) && s.points.length > 0) ||
    (activeStroke != null &&
      isDrawableInkTool(activeStroke.tool) &&
      (activeStroke.points.length ?? 0) > 0)

  void historyRevision

  return {
    containerRef,
    canvasWidth,
    canvasHeight,
    strokes,
    activeStroke,
    tool,
    color,
    strokeSize,
    canUndo: undoStackRef.current.length > 0,
    canRedo: redoStackRef.current.length > 0,
    hasDrawableContent,
    setTool: setToolWithDefaults,
    setColor,
    setStrokeSize,
    undo,
    redo,
    clearAll,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    getExportStrokes
  }
}
