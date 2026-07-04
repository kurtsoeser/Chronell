import { app, protocol } from 'electron'
import fs from 'node:fs/promises'
import { open as openFile } from 'node:fs/promises'
import path from 'node:path'
import { normalizeAudioMimeForPlayback } from '@shared/note-attachment-media-url'
import { resolveAudioContentType } from '@shared/note-attachment-audio'
import { getNoteAttachmentById } from './db/user-note-attachments-repo'

const SCHEME = 'note-media'

export function registerNoteAttachmentMediaScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        stream: true,
        corsEnabled: true
      }
    }
  ])
}

function isPathUnderUserData(filePath: string): boolean {
  const root = path.resolve(app.getPath('userData'))
  const resolved = path.resolve(filePath)
  return resolved === root || resolved.startsWith(`${root}${path.sep}`)
}

function parseAttachmentIds(requestUrl: string): { noteId: number; attachmentId: number } | null {
  try {
    const url = new URL(requestUrl)
    if (url.protocol !== `${SCHEME}:` || url.hostname !== 'attachment') return null
    const parts = url.pathname.split('/').filter(Boolean)
    const noteId = Number(parts[0])
    const attachmentId = Number(parts[1])
    if (!Number.isFinite(noteId) || noteId <= 0) return null
    if (!Number.isFinite(attachmentId) || attachmentId <= 0) return null
    return { noteId, attachmentId }
  } catch {
    return null
  }
}

async function createAttachmentMediaResponse(
  filePath: string,
  contentType: string,
  request: Request
): Promise<Response> {
  const fileStat = await fs.stat(filePath)
  const fileSize = fileStat.size
  const rangeHeader = request.headers.get('Range')?.trim()

  const baseHeaders: Record<string, string> = {
    'Content-Type': contentType,
    'Accept-Ranges': 'bytes'
  }

  if (rangeHeader) {
    const match = /^bytes=(\d+)-(\d*)$/i.exec(rangeHeader)
    if (match) {
      const start = Number(match[1])
      let end = match[2] ? Number(match[2]) : fileSize - 1
      if (!Number.isFinite(start) || start < 0 || start >= fileSize) {
        return new Response(null, {
          status: 416,
          headers: { 'Content-Range': `bytes */${fileSize}` }
        })
      }
      end = Math.min(end, fileSize - 1)
      const length = end - start + 1
      const handle = await openFile(filePath, 'r')
      try {
        const buffer = Buffer.alloc(length)
        await handle.read(buffer, 0, length, start)
        return new Response(buffer, {
          status: 206,
          headers: {
            ...baseHeaders,
            'Content-Length': String(length),
            'Content-Range': `bytes ${start}-${end}/${fileSize}`
          }
        })
      } finally {
        await handle.close()
      }
    }
  }

  const buffer = await fs.readFile(filePath)
  return new Response(buffer, {
    headers: {
      ...baseHeaders,
      'Content-Length': String(buffer.length)
    }
  })
}

function resolveAttachmentMediaContentType(att: {
  kind: string
  name: string
  contentType: string | null
}): string {
  const raw = att.contentType?.trim()
  if (raw?.startsWith('image/')) return raw
  if (raw?.startsWith('video/')) return raw
  if (raw?.startsWith('audio/')) return normalizeAudioMimeForPlayback(raw)
  return normalizeAudioMimeForPlayback(
    resolveAudioContentType({
      kind: att.kind as 'local' | 'cloud',
      name: att.name,
      contentType: att.contentType
    })
  )
}

export async function registerNoteAttachmentMediaProtocol(): Promise<void> {
  protocol.handle(SCHEME, async (request) => {
    const ids = parseAttachmentIds(request.url)
    if (!ids) {
      return new Response('Ungültige Medien-URL.', { status: 400 })
    }

    const att = getNoteAttachmentById(ids.attachmentId, ids.noteId)
    if (!att || att.kind !== 'local' || !att.localPath) {
      return new Response('Anhang nicht gefunden.', { status: 404 })
    }

    if (!isPathUnderUserData(att.localPath)) {
      return new Response('Zugriff verweigert.', { status: 403 })
    }

    try {
      await fs.access(att.localPath)
    } catch {
      return new Response('Datei nicht gefunden.', { status: 404 })
    }

    const contentType = resolveAttachmentMediaContentType(att)

    try {
      return await createAttachmentMediaResponse(att.localPath, contentType, request)
    } catch {
      return new Response('Datei konnte nicht gelesen werden.', { status: 500 })
    }
  })
}
