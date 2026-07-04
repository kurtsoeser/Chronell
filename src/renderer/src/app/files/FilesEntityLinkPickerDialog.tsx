import { useCallback, useEffect, useState } from 'react'
import { Link2, Loader2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { EntityLinkTargetCandidate } from '@shared/entity-links'
import type { ChronellEntityRef } from '@shared/entity-ref'
import { entityRefKey } from '@shared/entity-ref'
import { useFilesContextUiStore } from '@/stores/files-context-ui'
import { useUndoStore } from '@/stores/undo'
import { cn } from '@/lib/utils'
import { ModalPanel, ModalRoot } from '@/components/motion/Modal'

export function FilesEntityLinkPickerDialog(): JSX.Element | null {
  const { t } = useTranslation()
  const pushToast = useUndoStore((s) => s.pushToast)
  const anchor = useFilesContextUiStore((s) => s.entityLinkAnchor)
  const close = useFilesContextUiStore((s) => s.closeEntityLink)
  const [search, setSearch] = useState('')
  const [candidates, setCandidates] = useState<EntityLinkTargetCandidate[]>([])
  const [busyKey, setBusyKey] = useState<string | null>(null)

  useEffect(() => {
    if (!anchor) return
    setSearch('')
    setCandidates([])
  }, [anchor])

  useEffect(() => {
    if (!anchor) return
    const handle = window.setTimeout(() => {
      void window.mailClient.entityLinks
        .searchTargets({ anchor, query: search.trim(), limit: 40 })
        .then(setCandidates)
        .catch(() => setCandidates([]))
    }, 150)
    return (): void => window.clearTimeout(handle)
  }, [anchor, search])

  const addLink = useCallback(
    async (peer: ChronellEntityRef): Promise<void> => {
      if (!anchor) return
      const key = entityRefKey(peer)
      setBusyKey(key)
      try {
        await window.mailClient.entityLinks.add({ a: anchor, b: peer })
        pushToast({ label: t('files.context.linkAdded'), variant: 'success' })
        close()
      } catch (e) {
        pushToast({
          label: e instanceof Error ? e.message : String(e),
          variant: 'error'
        })
      } finally {
        setBusyKey(null)
      }
    },
    [anchor, close, pushToast, t]
  )

  if (!anchor) return null

  return (
    <ModalRoot open onBackdropClick={close} zIndex={320} overlayClassName="p-4">
      <ModalPanel
        className="flex max-h-[min(80vh,560px)] w-full max-w-md flex-col"
        onClick={(e): void => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Link2 className="h-4 w-4 shrink-0 text-primary" />
          <h2 className="min-w-0 flex-1 text-sm font-semibold">{t('files.context.addEntityLink')}</h2>
          <button
            type="button"
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={close}
            aria-label={t('common.close')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="border-b border-border px-4 py-2">
          <input
            type="search"
            value={search}
            onChange={(e): void => setSearch(e.target.value)}
            placeholder={t('connections.searchPlaceholder')}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            autoFocus
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {candidates.length === 0 ? (
            <p className="p-3 text-xs text-muted-foreground">{t('connections.noMatches')}</p>
          ) : (
            <ul className="space-y-1">
              {candidates.map((c) => {
                const key = entityRefKey(c.target)
                const busy = busyKey === key
                return (
                  <li key={key}>
                    <button
                      type="button"
                      disabled={busy || entityRefKey(c.target) === entityRefKey(anchor)}
                      onClick={(): void => void addLink(c.target)}
                      className={cn(
                        'flex w-full flex-col rounded-md px-3 py-2 text-left text-sm hover:bg-muted',
                        busy && 'opacity-70'
                      )}
                    >
                      <span className="font-medium">{c.title}</span>
                      {c.subtitle ? (
                        <span className="text-xs text-muted-foreground">{c.subtitle}</span>
                      ) : null}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </ModalPanel>
    </ModalRoot>
  )
}
