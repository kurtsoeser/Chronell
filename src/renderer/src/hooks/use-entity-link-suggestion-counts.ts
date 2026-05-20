import { useCallback, useEffect, useState } from 'react'
import type { ChronellEntityRef } from '@shared/entity-ref'
import { entityRefKey } from '@shared/entity-ref'
import type { EntityLinkSuggestionCountEntry } from '@shared/entity-link-ai-payload'
import {
  fetchEntityLinkSuggestionCounts,
  subscribeEntityLinksChanged
} from '@/lib/entity-links-client'

type EntityLinksEventsApi = {
  onEntityLinkAiScanProgress?: (handler: () => void) => () => void
}

function subscribeAiScanDone(onChange: () => void): () => void {
  const fn = (window.mailClient?.events as EntityLinksEventsApi | undefined)
    ?.onEntityLinkAiScanProgress
  if (typeof fn !== 'function') return () => {}
  return fn((status) => {
    if (!status.running) onChange()
  })
}

/** Zähler für Mail-Anker (heuristik + Scan-Cache + Panel-KI). */
export function useEntityLinkSuggestionCounts(
  anchors: ChronellEntityRef[],
  enabled: boolean
): ReadonlyMap<string, EntityLinkSuggestionCountEntry> {
  const [byKey, setByKey] = useState<ReadonlyMap<string, EntityLinkSuggestionCountEntry>>(
    () => new Map()
  )

  const reload = useCallback(async (): Promise<void> => {
    if (!enabled || anchors.length === 0) {
      setByKey(new Map())
      return
    }
    const slice = anchors.slice(0, 150)
    try {
      const entries = await fetchEntityLinkSuggestionCounts(slice)
      const m = new Map<string, EntityLinkSuggestionCountEntry>()
      for (const e of entries) {
        if (e.count > 0) m.set(e.anchorKey, e)
      }
      setByKey(m)
    } catch {
      setByKey(new Map())
    }
  }, [enabled, anchors])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    if (!enabled) return
    const unsubLinks = subscribeEntityLinksChanged(() => {
      void reload()
    })
    const unsubScan = subscribeAiScanDone(() => {
      void reload()
    })
    return (): void => {
      unsubLinks()
      unsubScan()
    }
  }, [enabled, reload])

  return byKey
}
