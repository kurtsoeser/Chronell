import { ipcMain } from 'electron'
import { IPC } from '@shared/ipc-channels'
import type {
  EntityLinkAddInput,
  EntityLinkAiDismissInput,
  EntityLinkAiScanInput,
  EntityLinkAiScanCostEstimate,
  EntityLinkAiScanStatus,
  EntityLinkAiSuggestInput,
  EntityLinkAiSuggestResult,
  EntityLinkEvaluateQualityInput,
  EntityLinkEvaluateQualityResult,
  EntityLinkGraphDensityStats,
  EntityLinkPathInput,
  EntityLinkPathResult,
  EntityLinkRemoveInput,
  EntityLinkSearchTargetsInput,
  EntityLinksListResult,
  EntityLinkSuggestion,
  EntityNeighborhoodInput,
  EntityPaletteListInput
} from '@shared/entity-links'
import type { ChronellEntityRef } from '@shared/entity-ref'
import { entityRefKey } from '@shared/entity-ref'
import type { EntityGraphSnapshot } from '@shared/entity-links'
import { syncMissingLegacyEntityLinks } from '../db/entity-links-migrate'
import { getDb } from '../db/index'
import {
  addEntityLink,
  buildEntityLinksGraph,
  buildNeighborhoodSnapshot,
  findEntityLinkPath,
  getMailTodoMessageId,
  listEntityLinksForAnchor,
  removeEntityLinkIfMatches
} from '../db/entity-links-repo'
import { suggestEntityLinks } from '../entity-link-suggestions'
import { evaluateEntityLinkQuality } from '../ai/entity-link-ai-quality'
import { suggestEntityLinksAi } from '../ai/entity-link-ai-suggest'
import {
  acceptEntityLinkAiScanItems,
  cancelEntityLinkAiScan,
  dismissEntityLinkAiScanItems,
  getEntityLinkAiScanStatus,
  restoreLastEntityLinkAiScan,
  startEntityLinkAiScan
} from '../ai/entity-link-ai-scan'
import { dismissEntityLinkAiSuggestion } from '../ai/entity-link-ai-dismissed'
import {
  estimateEntityLinkAiScanCost,
  getEntityLinkGraphDensityStats
} from '../ai/entity-link-ai-stats'
import { resolveScanAnchors } from '../ai/entity-link-ai-scan'
import { getAiConnectionsSettings } from '../ai/ai-settings-store'
import { buildEntityLinkAiPayloadPreview } from '../ai/entity-link-ai-payload-preview'
import {
  getEntityLinkSuggestionCounts,
  invalidateSuggestionCountCaches
} from '../ai/entity-link-suggestion-counts'
import { appendEntityLinkAiAudit, listEntityLinkAiAuditRecent } from '../db/entity-link-ai-audit-repo'
import type { EntityLinkAiPayloadPreviewInput } from '@shared/entity-link-ai-payload'
import type { EntityLinkSuggestionCountEntry } from '@shared/entity-link-ai-payload'
import { searchEntityPalette } from '../entity-palette-search'
import { isEntityRefKind, type EntityRefKind } from '@shared/entity-ref'
import { searchNoteLinkTargets } from '../note-link-target-search'
import type { EntityLinkTargetCandidate } from '@shared/entity-links'
import { broadcastEntityLinksChanged, broadcastNotesChanged } from './ipc-broadcasts'

function parseEntityRef(value: unknown): ChronellEntityRef | null {
  if (!value || typeof value !== 'object' || !('kind' in value)) return null
  const v = value as ChronellEntityRef
  switch (v.kind) {
    case 'note':
      return typeof v.noteId === 'number' && v.noteId > 0 ? v : null
    case 'mail':
      return typeof v.messageId === 'number' && v.messageId > 0 ? v : null
    case 'mail_todo':
      return typeof v.todoId === 'number' && v.todoId > 0 ? v : null
    case 'calendar_event':
      return typeof v.accountId === 'string' &&
        typeof v.graphEventId === 'string' &&
        v.accountId.trim() &&
        v.graphEventId.trim()
        ? v
        : null
    case 'cloud_task':
      return typeof v.accountId === 'string' &&
        typeof v.listId === 'string' &&
        typeof v.taskId === 'string' &&
        v.accountId.trim() &&
        v.listId.trim() &&
        v.taskId.trim()
        ? v
        : null
    case 'people_contact':
      return typeof v.contactId === 'number' && v.contactId > 0 ? v : null
    default:
      return null
  }
}

function broadcastForRefs(...refs: ChronellEntityRef[]): void {
  for (const ref of refs) {
    if (ref.kind === 'note') {
      broadcastNotesChanged({ noteId: ref.noteId })
    }
  }
}

export function registerEntityLinksIpc(): void {
  ipcMain.handle(
    IPC.entityLinks.list,
    (_event, anchor: unknown): EntityLinksListResult => {
      const parsed = parseEntityRef(anchor)
      if (!parsed) return { anchor: { kind: 'note', noteId: 0 }, links: [] }
      return {
        anchor: parsed,
        links: listEntityLinksForAnchor(parsed)
      }
    }
  )

  ipcMain.handle(IPC.entityLinks.add, (_event, input: EntityLinkAddInput): void => {
    const a = parseEntityRef(input?.a)
    const b = parseEntityRef(input?.b)
    if (!a || !b) throw new Error('Verknuepfung ungueltig.')
    addEntityLink(a, b, input?.linkKind ?? 'related')
    broadcastForRefs(a, b)
      broadcastEntityLinksChanged()
      void invalidateSuggestionCountCaches()
  })

  ipcMain.handle(IPC.entityLinks.remove, (_event, input: EntityLinkRemoveInput): void => {
    const linkId = typeof input?.linkId === 'number' ? input.linkId : 0
    const anchor = parseEntityRef(input?.anchor)
    if (!linkId) throw new Error('Verknuepfungs-ID fehlt.')
    if (anchor) {
      removeEntityLinkIfMatches(linkId, anchor)
      broadcastForRefs(anchor)
    }
      broadcastEntityLinksChanged()
      void invalidateSuggestionCountCaches()
  })

  ipcMain.handle(
    IPC.entityLinks.getMailTodoMessageId,
    (_event, todoId: unknown): number | null => {
      const id = typeof todoId === 'number' ? todoId : 0
      if (!id) return null
      return getMailTodoMessageId(id)
    }
  )

  ipcMain.handle(IPC.entityLinks.listGraph, (): EntityGraphSnapshot => {
    syncMissingLegacyEntityLinks(getDb())
    return buildEntityLinksGraph()
  })

  ipcMain.handle(
    IPC.entityLinks.listNeighborhood,
    (_event, input: EntityNeighborhoodInput): EntityGraphSnapshot => {
      const anchor = parseEntityRef(input?.anchor)
      if (!anchor) return { nodes: [], edges: [] }
      const depth = typeof input?.depth === 'number' ? input.depth : 1
      return buildNeighborhoodSnapshot(anchor, depth)
    }
  )

  ipcMain.handle(
    IPC.entityLinks.findPath,
    (_event, input: EntityLinkPathInput): EntityLinkPathResult | null => {
      const from = parseEntityRef(input?.from)
      const to = parseEntityRef(input?.to)
      if (!from || !to) return null
      const maxHops = typeof input?.maxHops === 'number' ? input.maxHops : 12
      return findEntityLinkPath(from, to, maxHops)
    }
  )

  ipcMain.handle(
    IPC.entityLinks.suggest,
    (_event, anchor: unknown): EntityLinkSuggestion[] => {
      const parsed = parseEntityRef(anchor)
      if (!parsed) return []
      return suggestEntityLinks(parsed)
    }
  )

  ipcMain.handle(
    IPC.entityLinks.suggestAi,
    async (_event, input: unknown): Promise<EntityLinkAiSuggestResult> => {
      const raw = input as EntityLinkAiSuggestInput | ChronellEntityRef | null
      const anchor = parseEntityRef(
        raw && typeof raw === 'object' && 'anchor' in raw
          ? (raw as EntityLinkAiSuggestInput).anchor
          : raw
      )
      if (!anchor) return { suggestions: [], chains: [] }
      const maxCandidates =
        raw && typeof raw === 'object' && 'maxCandidates' in raw
          ? (raw as EntityLinkAiSuggestInput).maxCandidates
          : undefined
      const includeExcerpt =
        raw && typeof raw === 'object' && 'includeExcerpt' in raw
          ? (raw as EntityLinkAiSuggestInput).includeExcerpt
          : undefined
      const result = await suggestEntityLinksAi({ anchor, maxCandidates, includeExcerpt })
      void appendEntityLinkAiAudit({
        kind: 'suggest',
        anchorKey: entityRefKey(anchor),
        provider: (await getAiConnectionsSettings()).provider,
        charEstimate: 0,
        includeExcerpt: includeExcerpt === true
      })
      return result
    }
  )

  ipcMain.handle(
    IPC.entityLinks.previewAiPayload,
    (_event, input: unknown) => {
      const raw = input as EntityLinkAiPayloadPreviewInput | null
      const anchor = parseEntityRef(raw?.anchor)
      if (!anchor) return null
      return buildEntityLinkAiPayloadPreview({
        anchor,
        includeExcerpt: raw?.includeExcerpt === true
      })
    }
  )

  ipcMain.handle(IPC.entityLinks.listAiAudit, (_event, limit: unknown) => {
    const n = typeof limit === 'number' ? Math.min(Math.max(limit, 1), 50) : 15
    return listEntityLinkAiAuditRecent(n)
  })

  ipcMain.handle(
    IPC.entityLinks.evaluateLinkQuality,
    async (_event, input: unknown): Promise<EntityLinkEvaluateQualityResult> => {
      const raw = input as EntityLinkEvaluateQualityInput | null
      const anchor = parseEntityRef(raw?.anchor)
      if (!anchor) return { assessments: [] }
      return evaluateEntityLinkQuality({
        anchor,
        includeExcerpt: raw?.includeExcerpt === true
      })
    }
  )

  ipcMain.handle(
    IPC.entityLinks.getHeuristicSuggestionCounts,
    async (_event, anchors: unknown): Promise<EntityLinkSuggestionCountEntry[]> => {
      if (!Array.isArray(anchors)) return []
      const parsed = anchors
        .map((a) => parseEntityRef(a))
        .filter((a): a is ChronellEntityRef => a != null)
      return getEntityLinkSuggestionCounts(parsed)
    }
  )

  ipcMain.handle(
    IPC.entityLinks.startAiScan,
    async (_event, input: unknown): Promise<EntityLinkAiScanStatus> => {
      const raw = input as EntityLinkAiScanInput | null
      return startEntityLinkAiScan(raw ?? {})
    }
  )

  ipcMain.handle(IPC.entityLinks.cancelAiScan, (): EntityLinkAiScanStatus => {
    return cancelEntityLinkAiScan()
  })

  ipcMain.handle(IPC.entityLinks.getAiScanStatus, async (): Promise<EntityLinkAiScanStatus> => {
    const current = getEntityLinkAiScanStatus()
    if (!current.running && current.items.length === 0) {
      return restoreLastEntityLinkAiScan()
    }
    return current
  })

  ipcMain.handle(
    IPC.entityLinks.acceptAiScanItems,
    async (_event, itemIds: unknown): Promise<number> => {
      const ids = Array.isArray(itemIds)
        ? itemIds.filter((id): id is string => typeof id === 'string')
        : []
      return acceptEntityLinkAiScanItems(ids)
    }
  )

  ipcMain.handle(
    IPC.entityLinks.dismissAiScanItems,
    async (_event, itemIds: unknown): Promise<number> => {
      const ids = Array.isArray(itemIds)
        ? itemIds.filter((id): id is string => typeof id === 'string')
        : []
      return dismissEntityLinkAiScanItems(ids)
    }
  )

  ipcMain.handle(
    IPC.entityLinks.dismissAiSuggestion,
    async (_event, input: unknown): Promise<void> => {
      const raw = input as EntityLinkAiDismissInput | null
      if (!raw?.anchor || !raw?.peer) return
      await dismissEntityLinkAiSuggestion(raw.anchor, raw.peer)
    }
  )

  ipcMain.handle(
    IPC.entityLinks.getGraphDensityStats,
    (_event, lookbackDays: unknown): EntityLinkGraphDensityStats => {
      const days =
        typeof lookbackDays === 'number' ? lookbackDays : 90
      return getEntityLinkGraphDensityStats(days)
    }
  )

  ipcMain.handle(
    IPC.entityLinks.estimateAiScanCost,
    async (_event, input: unknown): Promise<EntityLinkAiScanCostEstimate> => {
      const raw = input as EntityLinkAiScanInput | null
      const settings = await getAiConnectionsSettings()
      const anchors = resolveScanAnchors(raw ?? {}, settings)
      return estimateEntityLinkAiScanCost(anchors.length, settings.compareProviders)
    }
  )

  ipcMain.handle(
    IPC.entityLinks.listPalette,
    (_event, input: EntityPaletteListInput): EntityLinkTargetCandidate[] => {
      const kinds =
        Array.isArray(input?.kinds) && input.kinds.length > 0
          ? input.kinds.filter((k): k is EntityRefKind => isEntityRefKind(k))
          : input?.kind && isEntityRefKind(input.kind)
            ? [input.kind]
            : []
      if (kinds.length === 0) return []
      return searchEntityPalette(kinds, input?.query ?? '', input?.limit ?? 50)
    }
  )

  ipcMain.handle(
    IPC.entityLinks.searchTargets,
    (_event, args: EntityLinkSearchTargetsInput): EntityLinkTargetCandidate[] => {
      const anchor = parseEntityRef(args?.anchor)
      if (!anchor) return []
      const excludeNoteId = anchor.kind === 'note' ? anchor.noteId : undefined
      const candidates = searchNoteLinkTargets(args?.query ?? '', {
        excludeNoteId,
        limit: args?.limit
      })
      const linkedKeys = new Set(
        listEntityLinksForAnchor(anchor).map((item) => entityRefKey(item.peer))
      )
      linkedKeys.add(entityRefKey(anchor))
      return candidates.filter((c) => !linkedKeys.has(entityRefKey(c.target)))
    }
  )
}
