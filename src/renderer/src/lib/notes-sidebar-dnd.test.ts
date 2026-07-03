import { describe, expect, it } from 'vitest'
import {
  NOTE_DROP_UNGROUPED,
  noteDragId,
  noteSectionDragId,
  noteSectionDropId,
  parseNoteDragId,
  parseNoteSectionDragId,
  parseNoteSectionDropId,
  resolveNoteSectionReorderOverId
} from './notes-sidebar-dnd'

describe('notes-sidebar-dnd', () => {
  it('roundtrips note drag ids', () => {
    expect(parseNoteDragId(noteDragId(42))).toBe(42)
    expect(parseNoteDragId('invalid')).toBeNull()
  })

  it('roundtrips section drag ids', () => {
    expect(parseNoteSectionDragId(noteSectionDragId(9))).toBe(9)
    expect(parseNoteSectionDragId('note-section-drag:0')).toBeNull()
    expect(parseNoteSectionDragId('invalid')).toBeNull()
  })

  it('parses section drop targets', () => {
    expect(parseNoteSectionDropId(NOTE_DROP_UNGROUPED)).toEqual({ sectionId: null })
    expect(parseNoteSectionDropId(noteSectionDropId(7))).toEqual({ sectionId: 7 })
    expect(parseNoteSectionDropId('note-drop:sec:0')).toBeNull()
  })

  it('resolves section reorder targets from drag or drop ids', () => {
    expect(resolveNoteSectionReorderOverId(noteSectionDragId(3))).toBe(3)
    expect(resolveNoteSectionReorderOverId(noteSectionDropId(5))).toBe(5)
    expect(resolveNoteSectionReorderOverId(NOTE_DROP_UNGROUPED)).toBeNull()
    expect(resolveNoteSectionReorderOverId('invalid')).toBeNull()
  })
})
