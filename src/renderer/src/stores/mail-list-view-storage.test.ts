/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it } from 'vitest'
import {
  defaultMailListViewPrefs,
  mailListViewScopeKey,
  persistMailListViewPrefs,
  readMailListViewPrefs,
  resolveMailListViewPrefs
} from './mail-list-view-storage'

describe('mailListViewScopeKey', () => {
  it('unterscheidet Ordner, Schnellzugriff und Meta-Ordner', () => {
    expect(
      mailListViewScopeKey({
        listKind: 'folder',
        todoDueKind: null,
        selectedFolderAccountId: 'ms:a',
        selectedFolderId: 3,
        selectedMetaFolderId: null
      })
    ).toBe('folder:ms:a:3')
    expect(
      mailListViewScopeKey({
        listKind: 'unified_inbox',
        todoDueKind: null,
        selectedFolderAccountId: null,
        selectedFolderId: null,
        selectedMetaFolderId: null
      })
    ).toBe('unified_inbox')
    expect(
      mailListViewScopeKey({
        listKind: 'meta_folder',
        todoDueKind: null,
        selectedFolderAccountId: null,
        selectedFolderId: null,
        selectedMetaFolderId: 9
      })
    ).toBe('meta_folder:9')
    expect(
      mailListViewScopeKey({
        listKind: 'todo',
        todoDueKind: null,
        selectedFolderAccountId: null,
        selectedFolderId: null,
        selectedMetaFolderId: null
      })
    ).toBe('todo:all')
  })
})

describe('persist/read mail list view prefs', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('merkt Einstellungen pro Ordner getrennt', () => {
    const inbox = {
      listKind: 'unified_inbox' as const,
      todoDueKind: null,
      selectedFolderAccountId: null,
      selectedFolderId: null,
      selectedMetaFolderId: null
    }
    const todoFolder = {
      listKind: 'folder' as const,
      todoDueKind: null,
      selectedFolderAccountId: 'ms:a',
      selectedFolderId: 42,
      selectedMetaFolderId: null
    }

    persistMailListViewPrefs(inbox, {
      arrange: 'date_conversations',
      chrono: 'oldest_on_top',
      filter: 'unread'
    })
    persistMailListViewPrefs(todoFolder, {
      arrange: 'todo_bucket',
      chrono: 'newest_on_top',
      filter: 'all'
    })

    expect(resolveMailListViewPrefs(inbox)).toEqual({
      arrange: 'date_conversations',
      chrono: 'oldest_on_top',
      filter: 'unread'
    })
    expect(resolveMailListViewPrefs(todoFolder)).toEqual({
      arrange: 'todo_bucket',
      chrono: 'newest_on_top',
      filter: 'all'
    })
  })

  it('liefert Standard fuer ToDo-Schnellzugriff ohne gespeicherten Eintrag', () => {
    expect(
      defaultMailListViewPrefs({
        listKind: 'todo',
        todoDueKind: null,
        selectedFolderAccountId: null,
        selectedFolderId: null,
        selectedMetaFolderId: null
      }).arrange
    ).toBe('todo_bucket')
    expect(
      readMailListViewPrefs({
        listKind: 'folder',
        todoDueKind: null,
        selectedFolderAccountId: 'ms:a',
        selectedFolderId: 1,
        selectedMetaFolderId: null
      })
    ).toBeNull()
  })
})
