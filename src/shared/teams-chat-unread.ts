/**
 * Graph: `lastMessagePreview.createdDateTime` vs. `viewpoint.lastMessageReadDateTime`.
 * @see https://learn.microsoft.com/en-us/graph/api/chat-list
 */
export function teamsChatHasUnreadMessages(
  lastMessagePreviewCreatedDateTime: string | null | undefined,
  lastMessageReadDateTime: string | null | undefined
): boolean {
  const previewRaw = lastMessagePreviewCreatedDateTime?.trim()
  if (!previewRaw) return false
  const previewMs = Date.parse(previewRaw)
  if (!Number.isFinite(previewMs)) return false

  const readRaw = lastMessageReadDateTime?.trim()
  if (!readRaw) return true
  const readMs = Date.parse(readRaw)
  if (!Number.isFinite(readMs)) return true

  return previewMs > readMs
}
