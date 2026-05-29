import { describe, expect, it } from 'vitest'
import { dueIsoFromClientInput, normalizeGraphTodoCategories } from './tasks-graph'

describe('dueIsoFromClientInput', () => {
  it('wandelt YYYY-MM-DD in Storage-ISO', () => {
    expect(dueIsoFromClientInput('2026-05-21')).toBe('2026-05-21T12:00:00.000Z')
  })

  it('null bei leerer Fälligkeit', () => {
    expect(dueIsoFromClientInput(null)).toBeNull()
    expect(dueIsoFromClientInput('')).toBeNull()
  })
})

describe('normalizeGraphTodoCategories', () => {
  it('trimmt, dedupliziert und begrenzt auf 25', () => {
    const many = Array.from({ length: 30 }, (_, i) => `Cat ${i}`)
    expect(normalizeGraphTodoCategories(['  Work ', 'Work', 'Private'])).toEqual(['Work', 'Private'])
    expect(normalizeGraphTodoCategories(many)?.length).toBe(25)
  })

  it('null liefert leeres Array', () => {
    expect(normalizeGraphTodoCategories(null)).toEqual([])
  })
})
