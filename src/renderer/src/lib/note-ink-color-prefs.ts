import {
  NOTE_INK_BUILTIN_HIGHLIGHTER_COLORS,
  NOTE_INK_BUILTIN_PEN_COLORS,
  normalizeInkHexColor
} from '@shared/note-ink-colors'
import type { NoteInkTool } from '@shared/note-ink-document'

const STORAGE_KEY = 'mailclient.notes.inkCustomColors.v1'
export const NOTE_INK_CUSTOM_COLORS_CHANGED_EVENT = 'mailclient:notes-ink-custom-colors-changed'
export const NOTE_INK_MAX_CUSTOM_COLORS = 12

export interface NoteInkCustomColorPrefs {
  pen: string[]
  highlighter: string[]
}

const EMPTY: NoteInkCustomColorPrefs = { pen: [], highlighter: [] }

function normalizeColorList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of raw) {
    if (typeof item !== 'string') continue
    const color = normalizeInkHexColor(item)
    if (!color || seen.has(color)) continue
    seen.add(color)
    out.push(color)
    if (out.length >= NOTE_INK_MAX_CUSTOM_COLORS) break
  }
  return out
}

export function readNoteInkCustomColorPrefs(): NoteInkCustomColorPrefs {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...EMPTY }
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return { ...EMPTY }
    const obj = parsed as Record<string, unknown>
    return {
      pen: normalizeColorList(obj.pen),
      highlighter: normalizeColorList(obj.highlighter)
    }
  } catch {
    return { ...EMPTY }
  }
}

export function writeNoteInkCustomColorPrefs(next: NoteInkCustomColorPrefs): void {
  const normalized: NoteInkCustomColorPrefs = {
    pen: normalizeColorList(next.pen),
    highlighter: normalizeColorList(next.highlighter)
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized))
  window.dispatchEvent(new CustomEvent(NOTE_INK_CUSTOM_COLORS_CHANGED_EVENT))
}

export function builtinInkColorsForTool(tool: NoteInkTool): readonly string[] {
  return tool === 'highlighter' ? NOTE_INK_BUILTIN_HIGHLIGHTER_COLORS : NOTE_INK_BUILTIN_PEN_COLORS
}

export function customInkColorsForTool(
  prefs: NoteInkCustomColorPrefs,
  tool: NoteInkTool
): string[] {
  return tool === 'highlighter' ? prefs.highlighter : prefs.pen
}

export function addNoteInkCustomColor(tool: 'pen' | 'highlighter', color: string): string | null {
  const normalized = normalizeInkHexColor(color)
  if (!normalized) return null
  const prefs = readNoteInkCustomColorPrefs()
  const key = tool === 'highlighter' ? 'highlighter' : 'pen'
  const without = prefs[key].filter((c) => c !== normalized)
  const next = [normalized, ...without].slice(0, NOTE_INK_MAX_CUSTOM_COLORS)
  writeNoteInkCustomColorPrefs({ ...prefs, [key]: next })
  return normalized
}

export function removeNoteInkCustomColor(tool: 'pen' | 'highlighter', color: string): void {
  const normalized = normalizeInkHexColor(color)
  if (!normalized) return
  const prefs = readNoteInkCustomColorPrefs()
  const key = tool === 'highlighter' ? 'highlighter' : 'pen'
  const next = prefs[key].filter((c) => c !== normalized)
  if (next.length === prefs[key].length) return
  writeNoteInkCustomColorPrefs({ ...prefs, [key]: next })
}
