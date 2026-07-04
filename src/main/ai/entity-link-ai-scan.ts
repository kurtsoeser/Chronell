import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { app } from 'electron'
import type { ChronellEntityRef } from '@shared/entity-ref'
import { canonicalEntityRefPair, entityRefKey } from '@shared/entity-ref'
import type {
  EntityLinkAiScanInput,
  EntityLinkAiScanItem,
  EntityLinkAiScanStatus,
  EntityLinkSuggestion,
  EntityLinkSuggestionChain
} from '@shared/entity-links'
import type { AiConnectionsSettings } from '@shared/ai-connections'
import { AiConnectionsError } from '@shared/ai-connections'
import { addEntityLink, entityLinkExists } from '../db/entity-links-repo'
import { getDb } from '../db/index'
import { broadcastEntityLinksChanged } from '../ipc/ipc-broadcasts'
import { broadcastEntityLinkAiScanProgress } from '../ipc/ipc-broadcasts'
import { assertAiConnectionsReady } from './ai-settings-store'
import { dismissEntityLinkAiSuggestion, isEntityLinkAiDismissed } from './entity-link-ai-dismissed'
import { runAiSuggestForAnchor } from './entity-link-ai-suggest'
import { appendEntityLinkAiAudit } from '../db/entity-link-ai-audit-repo'
import { invalidateHeuristicSuggestionCountCache } from './entity-link-suggestion-counts'

const SCAN_PAUSE_MS = 350

interface ScanAnchorRow {
  ref: ChronellEntityRef
  title: string
}

let scanRunning = false
let scanCancelRequested = false
let scanIncludeExcerpt: boolean | undefined
let scanDomainProfileId: string | null = null
let scanStatus: EntityLinkAiScanStatus = emptyScanStatus()

function emptyScanStatus(): EntityLinkAiScanStatus {
  return {
    running: false,
    progress: { done: 0, total: 0, suggestionsFound: 0 },
    items: [],
    error: null
  }
}

function scanCachePath(): string {
  return join(app.getPath('userData'), 'ai-link-scan-cache', 'last-scan.json')
}

function pairKey(a: ChronellEntityRef, b: ChronellEntityRef): string {
  const [left, right] = canonicalEntityRefPair(a, b)
  return `${entityRefKey(left)}|${entityRefKey(right)}`
}

function suggestionItemId(anchor: ChronellEntityRef, suggestion: EntityLinkSuggestion): string {
  return createHash('sha256')
    .update(`${entityRefKey(anchor)}|${entityRefKey(suggestion.target)}`)
    .digest('hex')
    .slice(0, 16)
}

function selectContactsCalendarAnchors(maxAnchors: number): ScanAnchorRow[] {
  const db = getDb()
  const cap = Math.min(Math.max(maxAnchors, 1), 50)
  const half = Math.ceil(cap / 2)
  const contacts = db
    .prepare(
      `SELECT c.id, c.display_name,
        (SELECT COUNT(*) FROM entity_links el
         WHERE (el.a_kind = 'people_contact' AND el.a_people_contact_id = c.id)
            OR (el.b_kind = 'people_contact' AND el.b_people_contact_id = c.id)) AS deg
       FROM people_contacts c
       ORDER BY deg ASC, c.id DESC
       LIMIT ?`
    )
    .all(half) as Array<{ id: number; display_name: string | null; deg: number }>
  const events = db
    .prepare(
      `SELECT account_id, graph_event_id, title,
        (SELECT COUNT(*) FROM entity_links el
         WHERE (el.a_kind = 'calendar_event' AND el.a_calendar_account_id = ce.account_id AND el.a_calendar_graph_event_id = ce.graph_event_id)
            OR (el.b_kind = 'calendar_event' AND el.b_calendar_account_id = ce.account_id AND el.b_calendar_graph_event_id = ce.graph_event_id)) AS deg
       FROM calendar_events ce
       ORDER BY deg ASC, start_iso DESC
       LIMIT ?`
    )
    .all(cap - half) as Array<{
    account_id: string
    graph_event_id: string
    title: string | null
    deg: number
  }>
  const rows: ScanAnchorRow[] = contacts.map((c) => ({
    ref: { kind: 'people_contact', contactId: c.id },
    title: c.display_name?.trim() || 'Kontakt'
  }))
  for (const ev of events) {
    rows.push({
      ref: {
        kind: 'calendar_event',
        accountId: ev.account_id,
        graphEventId: ev.graph_event_id
      },
      title: ev.title?.trim() || 'Termin'
    })
  }
  return rows.slice(0, cap)
}

export function selectScanAnchors(
  maxAnchors: number,
  lookbackDays: number
): ScanAnchorRow[] {
  const db = getDb()
  const since = new Date()
  since.setDate(since.getDate() - lookbackDays)
  const cap = Math.min(Math.max(maxAnchors, 1), 50)

  const rows = db
    .prepare(
      `SELECT m.id, m.subject,
        (SELECT COUNT(*) FROM entity_links el
         WHERE (el.a_kind = 'mail' AND el.a_mail_message_id = m.id)
            OR (el.b_kind = 'mail' AND el.b_mail_message_id = m.id)) AS deg
       FROM messages m
       WHERE m.received_at >= ?
       ORDER BY deg ASC, m.received_at DESC
       LIMIT ?`
    )
    .all(since.toISOString(), cap) as Array<{
    id: number
    subject: string | null
    deg: number
  }>

  return rows.map((r) => ({
    ref: { kind: 'mail', messageId: r.id },
    title: r.subject?.trim() || '(Kein Betreff)'
  }))
}

export function resolveScanAnchors(
  input: EntityLinkAiScanInput,
  settings: AiConnectionsSettings
): ScanAnchorRow[] {
  if (input.anchors && input.anchors.length > 0) {
    return input.anchors.slice(0, 50).map((a) => ({ ref: a.ref, title: a.title }))
  }
  const maxAnchors =
    typeof input.maxAnchors === 'number'
      ? Math.min(Math.max(input.maxAnchors, 1), 50)
      : settings.scanMaxAnchors
  const profile = input.scanProfile
  if (profile === 'contacts_calendar') {
    return selectContactsCalendarAnchors(maxAnchors)
  }
  const lookbackDays =
    profile === 'recent_30'
      ? 30
      : typeof input.lookbackDays === 'number'
        ? Math.min(Math.max(input.lookbackDays, 7), 365)
        : settings.scanLookbackDays
  return selectScanAnchors(maxAnchors, lookbackDays)
}

function emitStatus(): void {
  broadcastEntityLinkAiScanProgress({ ...scanStatus, items: [...scanStatus.items] })
}

async function persistScanResults(items: EntityLinkAiScanItem[]): Promise<void> {
  const dir = join(app.getPath('userData'), 'ai-link-scan-cache')
  await mkdir(dir, { recursive: true })
  await writeFile(
    scanCachePath(),
    JSON.stringify({ savedAt: Date.now(), items }),
    'utf8'
  )
}

async function loadPersistedScanResults(): Promise<EntityLinkAiScanItem[] | null> {
  const path = scanCachePath()
  if (!existsSync(path)) return null
  try {
    const raw = await readFile(path, 'utf8')
    const parsed = JSON.parse(raw) as { items?: EntityLinkAiScanItem[] }
    return Array.isArray(parsed.items) ? parsed.items : null
  } catch {
    return null
  }
}

async function appendSuggestions(
  anchor: ScanAnchorRow,
  suggestions: EntityLinkSuggestion[],
  seenPairs: Set<string>,
  seenItemIds: Set<string>
): Promise<void> {
  for (const s of suggestions) {
    if (s.reason !== 'ai_semantic') continue
    if (entityLinkExists(anchor.ref, s.target)) continue
    if (await isEntityLinkAiDismissed(anchor.ref, s.target)) continue
    const key = pairKey(anchor.ref, s.target)
    if (seenPairs.has(key)) continue
    seenPairs.add(key)
    const id = suggestionItemId(anchor.ref, s)
    if (seenItemIds.has(id)) continue
    seenItemIds.add(id)
    scanStatus.items.push({
      id,
      anchor: anchor.ref,
      anchorTitle: anchor.title,
      suggestion: s
    })
  }
  scanStatus.progress.suggestionsFound = scanStatus.items.length
}

async function appendChains(
  anchor: ScanAnchorRow,
  chains: EntityLinkSuggestionChain[],
  seenItemIds: Set<string>
): Promise<void> {
  for (const chain of chains) {
    if (chain.steps.length < 2) continue
    const chainKey = chain.steps.map((s) => entityRefKey(s.ref)).join('>')
    const id = createHash('sha256').update(`chain|${chainKey}`).digest('hex').slice(0, 16)
    if (seenItemIds.has(id)) continue
    seenItemIds.add(id)
    const last = chain.steps[chain.steps.length - 1]!
    scanStatus.items.push({
      id,
      anchor: anchor.ref,
      anchorTitle: anchor.title,
      suggestion: {
        target: last.ref,
        title: last.title,
        subtitle: null,
        reason: 'ai_semantic',
        confidence: chain.confidence,
        reasonText: chain.reasonText,
        providerConsensus: chain.providerConsensus
      },
      chain
    })
  }
  scanStatus.progress.suggestionsFound = scanStatus.items.length
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

async function runScanLoop(anchors: ScanAnchorRow[]): Promise<void> {
  const seenPairs = new Set<string>()
  const seenItemIds = new Set<string>()

  for (let i = 0; i < anchors.length; i++) {
    if (scanCancelRequested) break
    const anchor = anchors[i]!
    try {
      const result = await runAiSuggestForAnchor(
        anchor.ref,
        40,
        scanIncludeExcerpt,
        scanDomainProfileId ?? 'general'
      )
      await appendSuggestions(anchor, result.suggestions, seenPairs, seenItemIds)
      await appendChains(anchor, result.chains, seenItemIds)
    } catch (err) {
      if (err instanceof AiConnectionsError && err.code === 'provider_error') {
        scanStatus.error = err.message
        break
      }
    }
    scanStatus.progress.done = i + 1
    emitStatus()
    if (i < anchors.length - 1 && !scanCancelRequested) {
      await sleep(SCAN_PAUSE_MS)
    }
  }
}

export function getEntityLinkAiScanStatus(): EntityLinkAiScanStatus {
  return {
    ...scanStatus,
    progress: { ...scanStatus.progress },
    items: [...scanStatus.items]
  }
}

export async function startEntityLinkAiScan(
  input: EntityLinkAiScanInput = {}
): Promise<EntityLinkAiScanStatus> {
  if (scanRunning) {
    throw new Error('Ein Graph-Scan läuft bereits.')
  }

  const { settings } = await assertAiConnectionsReady()

  const anchors = resolveScanAnchors(input, settings)
  scanIncludeExcerpt = input.includeExcerpt
  scanDomainProfileId = input.domainProfileId?.trim() || 'general'

  void appendEntityLinkAiAudit({
    kind: 'scan_start',
    anchorKey: null,
    provider: settings.provider,
    charEstimate: anchors.length * 800,
    includeExcerpt: Boolean(input.includeExcerpt)
  })

  scanRunning = true
  scanCancelRequested = false
  scanStatus = {
    running: true,
    progress: { done: 0, total: anchors.length, suggestionsFound: 0 },
    items: [],
    error: null
  }
  emitStatus()

  void (async (): Promise<void> => {
    try {
      if (anchors.length === 0) {
        scanStatus.error = null
      } else {
        await runScanLoop(anchors)
      }
    } catch (err) {
      scanStatus.error =
        err instanceof Error ? err.message : 'Graph-Scan fehlgeschlagen.'
    } finally {
      scanStatus.running = false
      scanStatus.progress.cancelled = scanCancelRequested
      scanRunning = false
      emitStatus()
      if (scanStatus.items.length > 0) {
        await persistScanResults(scanStatus.items)
      }
      await invalidateHeuristicSuggestionCountCache()
    }
  })()

  return getEntityLinkAiScanStatus()
}

export function cancelEntityLinkAiScan(): EntityLinkAiScanStatus {
  scanCancelRequested = true
  return getEntityLinkAiScanStatus()
}

export async function restoreLastEntityLinkAiScan(): Promise<EntityLinkAiScanStatus> {
  if (scanRunning) return getEntityLinkAiScanStatus()
  const items = await loadPersistedScanResults()
  if (!items?.length) return getEntityLinkAiScanStatus()
  scanStatus = {
    running: false,
    progress: {
      done: 0,
      total: 0,
      suggestionsFound: items.length,
      cancelled: false
    },
    items,
    error: null
  }
  return getEntityLinkAiScanStatus()
}

function acceptChainLinks(chain: EntityLinkSuggestionChain): number {
  let added = 0
  for (let i = 0; i < chain.steps.length - 1; i++) {
    const a = chain.steps[i]!.ref
    const b = chain.steps[i + 1]!.ref
    if (entityLinkExists(a, b)) continue
    addEntityLink(a, b, 'suggested')
    added++
  }
  return added
}

export async function acceptEntityLinkAiScanItems(itemIds: string[]): Promise<number> {
  const idSet = new Set(itemIds)
  let added = 0
  const remaining: EntityLinkAiScanItem[] = []

  for (const item of scanStatus.items) {
    if (!idSet.has(item.id)) {
      remaining.push(item)
      continue
    }
    if (item.chain) {
      added += acceptChainLinks(item.chain)
    } else if (!entityLinkExists(item.anchor, item.suggestion.target)) {
      addEntityLink(item.anchor, item.suggestion.target, 'suggested')
      added++
    }
  }

  scanStatus.items = remaining
  scanStatus.progress.suggestionsFound = remaining.length
  if (remaining.length > 0) {
    await persistScanResults(remaining)
  }
  broadcastEntityLinksChanged()
  emitStatus()
  return added
}

export async function dismissEntityLinkAiScanItems(itemIds: string[]): Promise<number> {
  const idSet = new Set(itemIds)
  let dismissed = 0
  const remaining: EntityLinkAiScanItem[] = []

  for (const item of scanStatus.items) {
    if (!idSet.has(item.id)) {
      remaining.push(item)
      continue
    }
    if (item.chain) {
      for (let i = 0; i < item.chain.steps.length - 1; i++) {
        const a = item.chain.steps[i]!.ref
        const b = item.chain.steps[i + 1]!.ref
        await dismissEntityLinkAiSuggestion(a, b)
        dismissed++
      }
    } else {
      await dismissEntityLinkAiSuggestion(item.anchor, item.suggestion.target)
      dismissed++
    }
  }

  scanStatus.items = remaining
  scanStatus.progress.suggestionsFound = remaining.length
  if (remaining.length > 0) {
    await persistScanResults(remaining)
  } else {
    const path = scanCachePath()
    if (existsSync(path)) {
      await writeFile(path, JSON.stringify({ savedAt: Date.now(), items: [] }), 'utf8')
    }
  }
  emitStatus()
  return dismissed
}
