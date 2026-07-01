import { readFilesAsAttachmentPayload } from '@/lib/attachment-files'

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function isImageFile(file: File): boolean {
  return file.type.startsWith('image/')
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (): void => resolve(String(reader.result ?? ''))
    reader.onerror = (): void => reject(reader.error ?? new Error('Datei konnte nicht gelesen werden.'))
    reader.readAsDataURL(file)
  })
}

export async function uploadFilesToNote(
  noteId: number,
  files: File[],
  options?: {
    insertHtml?: (html: string) => void
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (files.length === 0) return { ok: true }

  const parsed = await readFilesAsAttachmentPayload(files)
  if (!parsed.ok) return parsed

  try {
    for (let i = 0; i < files.length; i++) {
      const file = files[i]!
      const item = parsed.items[i]!
      await window.mailClient.notes.attachments.addLocal({
        noteId,
        name: item.name,
        contentType: item.contentType,
        size: item.size,
        dataBase64: item.dataBase64
      })

      if (options?.insertHtml && isImageFile(file)) {
        const dataUrl = await fileToDataUrl(file)
        const safeAlt = escapeHtml(file.name)
        const safeSrc = dataUrl.replace(/"/g, '&quot;')
        options.insertHtml(`<p><img src="${safeSrc}" alt="${safeAlt}" /></p>`)
      }
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
