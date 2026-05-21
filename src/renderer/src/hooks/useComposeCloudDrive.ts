import { useCallback, useState } from 'react'
import { appendHtmlToComposeBody, cloudFileLinkHtml } from '@/lib/compose-cloud-link'
import {
  useComposeStore,
  type ComposeReferenceAttachmentDraft
} from '@/stores/compose'

export function useComposeCloudDrive(draftId: string): {
  driveOpen: boolean
  setDriveOpen: (open: boolean) => void
  openDrive: () => void
  addCloudAttachment: (file: { name: string; webUrl: string }) => void
  removeCloudAttachment: (id: string) => void
  insertCloudLinkInBody: (file: { name: string; webUrl: string }) => void
} {
  const update = useComposeStore((s) => s.update)
  const [driveOpen, setDriveOpen] = useState(false)

  const addCloudAttachment = useCallback(
    (file: { name: string; webUrl: string }): void => {
      const draft = useComposeStore.getState().drafts.find((d) => d.id === draftId)
      if (!draft) return
      const next: ComposeReferenceAttachmentDraft = {
        id: `cref-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: file.name,
        webUrl: file.webUrl
      }
      update(draftId, { referenceAttachments: [...draft.referenceAttachments, next] })
      setDriveOpen(false)
    },
    [draftId, update]
  )

  const removeCloudAttachment = useCallback(
    (id: string): void => {
      const draft = useComposeStore.getState().drafts.find((d) => d.id === draftId)
      if (!draft) return
      update(draftId, {
        referenceAttachments: draft.referenceAttachments.filter((r) => r.id !== id)
      })
    },
    [draftId, update]
  )

  const insertCloudLinkInBody = useCallback(
    (file: { name: string; webUrl: string }): void => {
      const draft = useComposeStore.getState().drafts.find((d) => d.id === draftId)
      if (!draft) return
      const fragment = cloudFileLinkHtml(file.name, file.webUrl)
      update(draftId, {
        prependRichHtml: appendHtmlToComposeBody(draft.prependRichHtml, fragment)
      })
      setDriveOpen(false)
    },
    [draftId, update]
  )

  return {
    driveOpen,
    setDriveOpen,
    openDrive: (): void => setDriveOpen(true),
    addCloudAttachment,
    removeCloudAttachment,
    insertCloudLinkInBody
  }
}
