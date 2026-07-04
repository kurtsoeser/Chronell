import { NOTE_CLOUD_TASK_ITEM_CLASS } from '@shared/note-cloud-task'
import { NOTE_EMBED_REGISTRY } from '@shared/note-embed-registry'

/** Schnellprüfung, ob gespeichertes Notiz-HTML iframe-Embeds enthält. */
export function htmlContainsNoteEmbeds(html: string): boolean {
  if (!html.trim()) return false
  if (html.includes('note-embed-resizable')) return true
  return NOTE_EMBED_REGISTRY.some(
    (entry) =>
      html.includes(entry.embedClass) || entry.dataAttrs.some((attr) => html.includes(attr))
  )
}

/** Schnellprüfung, ob gespeichertes Notiz-HTML verknüpfte Cloud-Aufgaben enthält. */
export function htmlContainsCloudTasks(html: string): boolean {
  if (!html.trim()) return false
  return (
    html.includes(NOTE_CLOUD_TASK_ITEM_CLASS) || html.includes('data-chronell-cloud-task-id')
  )
}
