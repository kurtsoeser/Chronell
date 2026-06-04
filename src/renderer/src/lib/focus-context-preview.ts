import type { CalendarEventView } from '@shared/types'
import type { WorkItem } from '@shared/work-item'
import { useAppModeStore } from '@/stores/app-mode'
import { useLayoutStudioPreviewStore } from '@/stores/layout-studio-preview-store'
import { useMailStore } from '@/stores/mail'

/** Eingebettete Kontext-Vorschau in einer eigenen Ansicht (Layout-Zone). */
export function isCustomViewContextPreviewActive(): boolean {
  return useAppModeStore.getState().mode === 'customView'
}

export function focusContextPreviewWorkItem(item: WorkItem): boolean {
  if (!isCustomViewContextPreviewActive()) return false
  useLayoutStudioPreviewStore.getState().applyWorkItem(item)
  return true
}

export function focusContextPreviewCalendarEvent(event: CalendarEventView): boolean {
  if (!isCustomViewContextPreviewActive()) return false
  useLayoutStudioPreviewStore.getState().setCalendarEvent(event)
  return true
}

export async function focusContextPreviewMailMessage(messageId: number): Promise<boolean> {
  if (!isCustomViewContextPreviewActive()) return false
  useLayoutStudioPreviewStore.getState().clearContextPreview()
  await useMailStore.getState().openMessageInFolder(messageId)
  return true
}
