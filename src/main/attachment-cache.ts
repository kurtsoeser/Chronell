import { createHash } from 'node:crypto'
import { app } from 'electron'
import { access, mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'

/** Anhaenge aus «Im Standardprogramm oeffnen» — aelter als diese Frist werden entfernt. */
export const ATTACHMENT_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

export function attachmentCacheDirectory(): string {
  return join(app.getPath('userData'), 'attachment-cache')
}

export async function pruneStaleAttachmentCache(
  maxAgeMs: number = ATTACHMENT_CACHE_MAX_AGE_MS
): Promise<{ freedBytes: number; removedFiles: number }> {
  const dir = attachmentCacheDirectory()
  const cutoff = Date.now() - maxAgeMs
  let freedBytes = 0
  let removedFiles = 0
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return { freedBytes: 0, removedFiles: 0 }
  }
  for (const ent of entries) {
    const full = join(dir, ent.name)
    try {
      if (ent.isFile()) {
        const st = await stat(full)
        if (st.mtimeMs >= cutoff) continue
        freedBytes += st.size
        await rm(full, { force: true })
        removedFiles += 1
        continue
      }
      if (ent.isDirectory() && ent.name === 'drag') {
        const nested = await pruneDragCacheTree(full, cutoff)
        freedBytes += nested.freedBytes
        removedFiles += nested.removedFiles
      }
    } catch {
      /* ENOENT */
    }
  }
  return { freedBytes, removedFiles }
}

async function pruneDragCacheTree(
  dragDir: string,
  cutoff: number
): Promise<{ freedBytes: number; removedFiles: number }> {
  let freedBytes = 0
  let removedFiles = 0
  let hashDirs
  try {
    hashDirs = await readdir(dragDir, { withFileTypes: true })
  } catch {
    return { freedBytes: 0, removedFiles: 0 }
  }
  for (const hashEnt of hashDirs) {
    if (!hashEnt.isDirectory()) continue
    const hashPath = join(dragDir, hashEnt.name)
    let files
    try {
      files = await readdir(hashPath, { withFileTypes: true })
    } catch {
      continue
    }
    let remaining = 0
    for (const fileEnt of files) {
      if (!fileEnt.isFile()) {
        remaining += 1
        continue
      }
      const filePath = join(hashPath, fileEnt.name)
      try {
        const st = await stat(filePath)
        if (st.mtimeMs >= cutoff) {
          remaining += 1
          continue
        }
        freedBytes += st.size
        await rm(filePath, { force: true })
        removedFiles += 1
      } catch {
        /* ENOENT */
      }
    }
    if (remaining === 0) {
      try {
        await rm(hashPath, { recursive: true, force: true })
      } catch {
        /* busy */
      }
    }
  }
  return { freedBytes, removedFiles }
}

/**
 * Kurzer Cache-Dateiname (Hash + gekuerzter Anzeigename).
 * Graph-Attachment-IDs sind sehr lang — mit vollem Namen > Windows MAX_PATH (260).
 */
export function buildAttachmentCacheFileName(
  attachmentId: string,
  safeFileName: string
): string {
  const hash = createHash('sha256').update(attachmentId).digest('hex').slice(0, 20)
  const ext = extname(safeFileName)
  let stem = basename(safeFileName, ext) || 'attachment'
  const maxStemLen = 72 - hash.length
  if (stem.length > maxStemLen) {
    stem = stem.slice(0, maxStemLen)
  }
  return `${hash}-${stem}${ext}`
}

/** Schreibt Anhang in den Cache, raeumt alte Dateien auf, gibt absoluten Pfad zurueck. */
export async function writeAttachmentCacheFile(
  attachmentId: string,
  safeFileName: string,
  bytes: Buffer
): Promise<string> {
  const dir = attachmentCacheDirectory()
  await mkdir(dir, { recursive: true })
  await pruneStaleAttachmentCache()
  const fileName = buildAttachmentCacheFileName(attachmentId, safeFileName)
  const target = join(dir, fileName)
  await writeFile(target, bytes)
  try {
    await access(target)
  } catch {
    throw new Error(`Anhang-Cache konnte nicht geschrieben werden: ${target}`)
  }
  return target
}

/** Unterordner fuer Drag-and-Drop (Dateiname bleibt der Originalname beim Drop). */
export function attachmentDragCacheDirectory(): string {
  return join(attachmentCacheDirectory(), 'drag')
}

/**
 * Schreibt Anhang in einen Drag-Cache mit Originaldateiname.
 * Pfad: attachment-cache/drag/<hash>/<safeFileName>
 */
export async function writeAttachmentDragFile(
  attachmentId: string,
  safeFileName: string,
  bytes: Buffer
): Promise<string> {
  const hash = createHash('sha256').update(attachmentId).digest('hex').slice(0, 16)
  const dir = join(attachmentDragCacheDirectory(), hash)
  await mkdir(dir, { recursive: true })
  const target = join(dir, safeFileName || 'attachment')
  await writeFile(target, bytes)
  try {
    await access(target)
  } catch {
    throw new Error(`Anhang-Drag-Cache konnte nicht geschrieben werden: ${target}`)
  }
  return target
}
