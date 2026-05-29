import { app, net } from 'electron'
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { extractEmailDomain, domainLookupCandidates, isGenericMailboxDomain } from '@shared/extract-email-domain'

const FETCH_TIMEOUT_MS = 8000
const MAX_BYTES = 256 * 1024
const USER_AGENT = 'Chronell/1.0 (Electron; sender-domain-avatar)'

function cacheRoot(): string {
  return join(app.getPath('userData'), 'sender-domain-avatars')
}

function domainHash(domain: string): string {
  return createHash('sha256').update(domain.toLowerCase(), 'utf8').digest('hex').slice(0, 24)
}

function imageCachePath(domain: string): string {
  return join(cacheRoot(), `${domainHash(domain)}.img`)
}

function missCachePath(domain: string): string {
  return join(cacheRoot(), `${domainHash(domain)}.miss-v2`)
}

function detectImageMime(buf: Buffer): string | null {
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return 'image/png'
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'image/jpeg'
  }
  if (
    buf.length >= 12 &&
    buf.toString('ascii', 0, 4) === 'RIFF' &&
    buf.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp'
  }
  if (buf.length >= 4 && buf[0] === 0x00 && buf[1] === 0x00 && buf[2] === 0x01 && buf[3] === 0x00) {
    return 'image/x-icon'
  }
  if (buf.length >= 4 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) {
    return 'image/gif'
  }
  return null
}

function bytesToDataUrl(buf: Buffer): string | null {
  const mime = detectImageMime(buf)
  if (!mime) return null
  return `data:${mime};base64,${buf.toString('base64')}`
}

async function readCachedImage(domain: string): Promise<string | null> {
  try {
    const buf = await readFile(imageCachePath(domain))
    if (buf.length === 0) return null
    return bytesToDataUrl(buf)
  } catch {
    return null
  }
}

async function hasMissCache(domain: string): Promise<boolean> {
  try {
    await access(missCachePath(domain))
    return true
  } catch {
    return false
  }
}

async function fetchImageBytes(url: string): Promise<Buffer | null> {
  const ac = new AbortController()
  const timeout = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await net.fetch(url, {
      signal: ac.signal,
      headers: {
        Accept: 'image/*,*/*;q=0.8',
        'User-Agent': USER_AGENT
      }
    })
    if (!res.ok) return null
    const ct = res.headers.get('content-type')?.toLowerCase() ?? ''
    if (ct.startsWith('text/') || ct.includes('json')) return null
    const arr = await res.arrayBuffer()
    if (arr.byteLength === 0 || arr.byteLength > MAX_BYTES) return null
    const buf = Buffer.from(arr)
    return detectImageMime(buf) ? buf : null
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

function faviconSources(domain: string): string[] {
  const encoded = encodeURIComponent(domain)
  return [
    `https://icons.duckduckgo.com/ip3/${encoded}.ico`,
    `https://www.google.com/s2/favicons?domain=${encoded}&sz=64`
  ]
}

async function cacheMiss(domain: string): Promise<void> {
  await mkdir(cacheRoot(), { recursive: true })
  await writeFile(missCachePath(domain), '')
}

async function cacheImage(domain: string, bytes: Buffer): Promise<string | null> {
  const dataUrl = bytesToDataUrl(bytes)
  if (!dataUrl) return null
  await mkdir(cacheRoot(), { recursive: true })
  await writeFile(imageCachePath(domain), bytes)
  return dataUrl
}

/** Firmen-/Organisations-Logo anhand der Absender-Domain (Favicon), lokal gecacht. */
export async function getSenderDomainAvatarDataUrl(email: string | null | undefined): Promise<string | null> {
  const domain = extractEmailDomain(email)
  if (!domain || isGenericMailboxDomain(domain)) return null

  const cached = await readCachedImage(domain)
  if (cached) return cached
  if (await hasMissCache(domain)) return null

  const candidates = domainLookupCandidates(domain).filter((d) => !isGenericMailboxDomain(d))
  for (const lookupDomain of candidates) {
    for (const url of faviconSources(lookupDomain)) {
      const bytes = await fetchImageBytes(url)
      if (!bytes || bytes.length < 32) continue
      const dataUrl = await cacheImage(domain, bytes)
      if (dataUrl) return dataUrl
    }
  }

  await cacheMiss(domain)
  return null
}
