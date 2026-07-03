import { useCallback } from 'react'
import { AudioRecorderButton } from '@/components/AudioRecorderButton'
import { blobToBase64 } from '@/lib/blob-to-base64'

export function NoteAudioRecorder({
  noteId,
  disabled,
  onError,
  onAdded
}: {
  noteId: number
  disabled?: boolean
  onError?: (message: string) => void
  onAdded?: () => void
}): JSX.Element {
  const handleRecorded = useCallback(
    async (payload: { name: string; contentType: string; size: number; blob: Blob }): Promise<void> => {
      const dataBase64 = await blobToBase64(payload.blob)
      await window.mailClient.notes.attachments.addLocal({
        noteId,
        name: payload.name,
        contentType: payload.contentType,
        size: payload.size,
        dataBase64
      })
      onAdded?.()
    },
    [noteId, onAdded]
  )

  return <AudioRecorderButton disabled={disabled} onError={onError} onRecorded={handleRecorded} />
}
