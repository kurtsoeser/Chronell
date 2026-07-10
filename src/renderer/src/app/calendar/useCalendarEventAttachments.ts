import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type {
  CalendarEventAttachmentMeta,
  ComposeAttachment,
  ComposeReferenceAttachment,
  ConnectedAccount
} from '@shared/types'
import { readFilesAsAttachmentPayload, formatAttachmentBytes } from '@/lib/attachment-files'

const MAX_EVENT_ATTACHMENTS_TOTAL_BYTES = 25 * 1024 * 1024

export type CalendarEventReferenceAttachmentDraft = ComposeReferenceAttachment & { id: string }

export function useCalendarEventAttachments(opts: {
  account: ConnectedAccount | undefined
  graphEventId?: string | null
  graphCalendarId?: string | null
  enabled?: boolean
}): {
  newFiles: ComposeAttachment[]
  newReferences: CalendarEventReferenceAttachmentDraft[]
  existing: CalendarEventAttachmentMeta[]
  existingLoading: boolean
  attachmentError: string | null
  setAttachmentError: (msg: string | null) => void
  supportsFileAttachments: boolean
  supportsCloudAttachments: boolean
  addFiles: (files: File[]) => Promise<void>
  removeNewFile: (index: number) => void
  addCloudReference: (file: { name: string; webUrl: string }) => void
  removeNewReference: (id: string) => void
  openExisting: (att: CalendarEventAttachmentMeta) => Promise<void>
  saveExistingAs: (att: CalendarEventAttachmentMeta) => Promise<void>
  reset: (seed?: ComposeAttachment[]) => void
  formatBytes: typeof formatAttachmentBytes
  buildSavePayload: () => {
    attachments?: ComposeAttachment[]
    referenceAttachments?: ComposeReferenceAttachment[]
  }
} {
  const { t } = useTranslation()
  const { account, graphEventId, graphCalendarId, enabled = true } = opts
  const provider = account?.provider

  const [newFiles, setNewFiles] = useState<ComposeAttachment[]>([])
  const [newReferences, setNewReferences] = useState<CalendarEventReferenceAttachmentDraft[]>([])
  const [existing, setExisting] = useState<CalendarEventAttachmentMeta[]>([])
  const [existingLoading, setExistingLoading] = useState(false)
  const [attachmentError, setAttachmentError] = useState<string | null>(null)

  const supportsFileAttachments = provider === 'microsoft' || provider === 'google'
  const supportsCloudAttachments = provider === 'microsoft'

  const reset = useCallback((seed?: ComposeAttachment[]): void => {
    setNewFiles(seed ?? [])
    setNewReferences([])
    setExisting([])
    setAttachmentError(null)
    setExistingLoading(false)
  }, [])

  const loadExisting = useCallback(async (): Promise<void> => {
    const eventId = graphEventId?.trim()
    const accountId = account?.id
    if (!enabled || !eventId || !accountId || !supportsFileAttachments) {
      setExisting([])
      return
    }
    setExistingLoading(true)
    try {
      const list = await window.mailClient.calendar.listEventAttachments({
        accountId,
        graphEventId: eventId,
        graphCalendarId: graphCalendarId ?? null
      })
      setExisting(list)
    } catch (e) {
      console.warn('[calendar] listEventAttachments:', e)
      setExisting([])
    } finally {
      setExistingLoading(false)
    }
  }, [
    account?.id,
    enabled,
    graphCalendarId,
    graphEventId,
    supportsFileAttachments
  ])

  useEffect(() => {
    void loadExisting()
  }, [loadExisting])

  const addFiles = useCallback(
    async (files: File[]): Promise<void> => {
      if (files.length === 0) return
      if (!supportsFileAttachments) {
        setAttachmentError(t('calendar.eventDialog.attachmentProviderUnsupported'))
        return
      }
      setAttachmentError(null)
      const parsed = await readFilesAsAttachmentPayload(files, MAX_EVENT_ATTACHMENTS_TOTAL_BYTES)
      if (!parsed.ok) {
        setAttachmentError(parsed.error)
        return
      }
      const currentTotal = newFiles.reduce((s, a) => s + (a.size || 0), 0)
      let running = currentTotal
      const mapped: ComposeAttachment[] = []
      for (const item of parsed.items) {
        if (running + item.size > MAX_EVENT_ATTACHMENTS_TOTAL_BYTES) {
          setAttachmentError(
            t('calendar.eventDialog.attachmentMax', {
              maxMb: Math.round(MAX_EVENT_ATTACHMENTS_TOTAL_BYTES / (1024 * 1024)),
              file: item.name
            })
          )
          continue
        }
        mapped.push(item)
        running += item.size
      }
      if (mapped.length > 0) setNewFiles((prev) => [...prev, ...mapped])
    },
    [newFiles, supportsFileAttachments, t]
  )

  const addCloudReference = useCallback(
    (file: { name: string; webUrl: string }): void => {
      if (!supportsCloudAttachments) return
      setNewReferences((prev) => [
        ...prev,
        {
          id: `cref-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: file.name,
          sourceUrl: file.webUrl,
          providerType: 'oneDriveBusiness'
        }
      ])
    },
    [supportsCloudAttachments]
  )

  const openExisting = useCallback(
    async (att: CalendarEventAttachmentMeta): Promise<void> => {
      const accountId = account?.id
      const eventId = graphEventId?.trim()
      if (!accountId || !eventId) return
      const res = await window.mailClient.calendar.openEventAttachment({
        accountId,
        graphEventId: eventId,
        graphCalendarId: graphCalendarId ?? null,
        attachmentId: att.id
      })
      if (!res.ok && res.error) setAttachmentError(res.error)
    },
    [account?.id, graphCalendarId, graphEventId]
  )

  const saveExistingAs = useCallback(
    async (att: CalendarEventAttachmentMeta): Promise<void> => {
      const accountId = account?.id
      const eventId = graphEventId?.trim()
      if (!accountId || !eventId) return
      const res = await window.mailClient.calendar.saveEventAttachmentAs({
        accountId,
        graphEventId: eventId,
        graphCalendarId: graphCalendarId ?? null,
        attachmentId: att.id,
        suggestedName: att.name
      })
      if (!res.ok && !res.cancelled && res.error) setAttachmentError(res.error)
    },
    [account?.id, graphCalendarId, graphEventId]
  )

  const buildSavePayload = useCallback((): {
    attachments?: ComposeAttachment[]
    referenceAttachments?: ComposeReferenceAttachment[]
  } => {
    const out: {
      attachments?: ComposeAttachment[]
      referenceAttachments?: ComposeReferenceAttachment[]
    } = {}
    if (newFiles.length > 0) out.attachments = newFiles
    if (newReferences.length > 0) {
      out.referenceAttachments = newReferences.map(({ id: _id, ...rest }) => rest)
    }
    return out
  }, [newFiles, newReferences])

  return {
    newFiles,
    newReferences,
    existing,
    existingLoading,
    attachmentError,
    setAttachmentError,
    supportsFileAttachments,
    supportsCloudAttachments,
    addFiles,
    removeNewFile: (index): void => setNewFiles((prev) => prev.filter((_, i) => i !== index)),
    addCloudReference,
    removeNewReference: (id): void =>
      setNewReferences((prev) => prev.filter((r) => r.id !== id)),
    openExisting,
    saveExistingAs,
    reset,
    formatBytes: formatAttachmentBytes,
    buildSavePayload
  }
}
