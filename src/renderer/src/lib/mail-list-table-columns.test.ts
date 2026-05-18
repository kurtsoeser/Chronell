/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it } from 'vitest'
import {
  buildMailListTableGridTemplate,
  DEFAULT_MAIL_LIST_TABLE_COLUMNS,
  MAIL_LIST_TABLE_COLUMNS_STORAGE_KEY,
  moveMailListTableColumn,
  persistMailListTableColumns,
  readMailListTableColumns,
  toggleMailListTableColumn
} from './mail-list-table-columns'

describe('mail-list-table-columns', () => {
  beforeEach(() => {
    window.localStorage.removeItem(MAIL_LIST_TABLE_COLUMNS_STORAGE_KEY)
  })

  it('defaults to from, subject, received', () => {
    expect(readMailListTableColumns()).toEqual(DEFAULT_MAIL_LIST_TABLE_COLUMNS)
  })

  it('builds grid template from visible columns', () => {
    const tpl = buildMailListTableGridTemplate(['from', 'subject', 'received'])
    expect(tpl).toContain('minmax(108px')
    expect(tpl.split(' ').length).toBeGreaterThan(3)
  })

  it('toggle adds and removes columns', () => {
    let cols = [...DEFAULT_MAIL_LIST_TABLE_COLUMNS]
    cols = toggleMailListTableColumn(cols, 'preview', true)
    expect(cols).toContain('preview')
    cols = toggleMailListTableColumn(cols, 'preview', false)
    expect(cols).not.toContain('preview')
  })

  it('move swaps order', () => {
    const moved = moveMailListTableColumn(['from', 'subject', 'received'], 'received', 'up')
    expect(moved).toEqual(['from', 'received', 'subject'])
  })

  it('persists and coerces invalid storage', () => {
    persistMailListTableColumns(['subject', 'from', 'from' as never, 'bogus' as never])
    expect(readMailListTableColumns()).toEqual(['from', 'subject'])
    window.localStorage.setItem(MAIL_LIST_TABLE_COLUMNS_STORAGE_KEY, '{"v":1,"columns":[]}')
    expect(readMailListTableColumns()).toEqual(DEFAULT_MAIL_LIST_TABLE_COLUMNS)
  })
})
