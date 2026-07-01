import i18n from 'i18next'
import { storedBodyFromEditorHtml } from '@/lib/note-body-html'
import { openCreatedNote } from '@/lib/mail-to-note'
import { showAppAlert } from '@/stores/app-dialog'

export interface ScreenClipImage {
  dataBase64: string
  contentType: string
  dataUrl: string
}

export async function readScreenClipImageFromClipboard(): Promise<ScreenClipImage | null> {
  const clip = await window.mailClient.notes.readClipboardImage()
  if (!clip) return null
  return {
    ...clip,
    dataUrl: `data:${clip.contentType};base64,${clip.dataBase64}`
  }
}

export function buildScreenClipInsertHtml(dataUrl: string): string {
  const safe = dataUrl.replace(/"/g, '&quot;')
  return `<p><img src="${safe}" alt="Screenshot" /></p>`
}

export async function createNoteWithScreenClip(image: ScreenClipImage): Promise<number> {
  const html = buildScreenClipInsertHtml(image.dataUrl)
  const note = await window.mailClient.notes.createStandalone({
    title: i18n.t('notes.screenClip.defaultTitle'),
    body: storedBodyFromEditorHtml(html),
    sectionId: null
  })
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
  await window.mailClient.notes.attachments.addLocal({
    noteId: note.id,
    name: `screenshot-${stamp}.png`,
    contentType: image.contentType,
    dataBase64: image.dataBase64,
    size: Math.ceil((image.dataBase64.length * 3) / 4)
  })
  return note.id
}

export async function appendScreenClipToNote(
  noteId: number,
  image: ScreenClipImage,
  insertHtml: (html: string) => void
): Promise<void> {
  insertHtml(buildScreenClipInsertHtml(image.dataUrl))
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
  await window.mailClient.notes.attachments.addLocal({
    noteId,
    name: `screenshot-${stamp}.png`,
    contentType: image.contentType,
    dataBase64: image.dataBase64,
    size: Math.ceil((image.dataBase64.length * 3) / 4)
  })
}

export async function runScreenClipCapture(args: {
  activeNoteId?: number | null
  insertHtml?: (html: string) => void
}): Promise<void> {
  const image = await readScreenClipImageFromClipboard()
  if (!image) {
    await showAppAlert(i18n.t('notes.screenClip.emptyClipboard'), {
      title: i18n.t('notes.screenClip.title')
    })
    return
  }

  if (args.activeNoteId != null && args.insertHtml) {
    await appendScreenClipToNote(args.activeNoteId, image, args.insertHtml)
    return
  }

  const noteId = await createNoteWithScreenClip(image)
  openCreatedNote(noteId)
}
