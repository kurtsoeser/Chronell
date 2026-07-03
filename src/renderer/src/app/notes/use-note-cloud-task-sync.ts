import { useCallback, useEffect, useRef } from 'react'
import type { MutableRefObject } from 'react'
import {
  extractNoteCloudTaskRefsFromHtml,
  syncNoteCloudTasksInHtml,
  syncStateKey,
  taskRowToSyncState,
  type NoteCloudTaskSyncState
} from '@/lib/note-cloud-task-sync'

export interface UseNoteCloudTaskSyncOptions {
  noteId: number | null | undefined
  getBodyHtml: () => string
  onApplyHtml: (html: string) => void
  flushRef?: MutableRefObject<(() => void) | null>
  enabled?: boolean
}

export function useNoteCloudTaskSync({
  noteId,
  getBodyHtml,
  onApplyHtml,
  flushRef,
  enabled = true
}: UseNoteCloudTaskSyncOptions): void {
  const getBodyHtmlRef = useRef(getBodyHtml)
  getBodyHtmlRef.current = getBodyHtml
  const syncingRef = useRef(false)

  const refreshFromTasks = useCallback(async (): Promise<void> => {
    if (!enabled || !noteId) return
    flushRef?.current?.()
    const html = getBodyHtmlRef.current()
    const refs = extractNoteCloudTaskRefsFromHtml(html)
    if (refs.length === 0) return
    const byAccount = new Map<string, typeof refs>()
    for (const item of refs) {
      if (!item.ref) continue
      const bucket = byAccount.get(item.ref.accountId) ?? []
      bucket.push(item)
      byAccount.set(item.ref.accountId, bucket)
    }
    const states = new Map<string, NoteCloudTaskSyncState>()
    for (const [accountId, items] of byAccount) {
      const listIds = [...new Set(items.map((i) => i.ref!.listId))]
      for (const listId of listIds) {
        try {
          const rows = await window.mailClient.tasks.listTasks({
            accountId,
            listId,
            showCompleted: true,
            cacheOnly: true
          })
          for (const row of rows) {
            states.set(syncStateKey({ accountId, listId, taskId: row.id }), taskRowToSyncState(row, accountId, listId))
          }
        } catch {
          // Cache-only refresh — Fehler stillschweigend ignorieren
        }
      }
    }
    const nextHtml = syncNoteCloudTasksInHtml(html, states)
    if (nextHtml !== html && !syncingRef.current) {
      syncingRef.current = true
      onApplyHtml(nextHtml)
      syncingRef.current = false
    }
  }, [enabled, flushRef, noteId, onApplyHtml])

  useEffect(() => {
    if (!enabled) return
    const unsub = window.mailClient.events.onTasksChanged(() => {
      void refreshFromTasks()
    })
    return unsub
  }, [enabled, refreshFromTasks])

  useEffect(() => {
    void refreshFromTasks()
  }, [noteId, refreshFromTasks])
}
