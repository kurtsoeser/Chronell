import { useEffect, useMemo, useState } from 'react'
import { ExternalLink, PanelRightClose, SquareArrowOutUpRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { EntityGraphNode } from '@shared/entity-links'
import { CalendarFloatingPanel } from '@/app/calendar/CalendarFloatingPanel'
import { ConnectionsObjectPreview } from '@/app/connections/ConnectionsObjectPreview'
import {
  CONNECTIONS_FLOAT_PREVIEW_SIZE_KEY,
  type ConnectionsPreviewPlacement,
  persistConnectionsPreviewPlacement
} from '@/app/connections/connections-preview-storage'
import { EntityContextBlock } from '@/components/connections/EntityContextBlock'
import {
  ModuleColumnHeaderIconButton,
  moduleColumnHeaderDockBarRowClass,
  moduleColumnHeaderIconGlyphClass,
  moduleColumnHeaderUppercaseLabelClass
} from '@/components/ModuleColumnHeader'
import { VerticalSplitter } from '@/components/ResizableSplitter'
import { openMailReadingPopout } from '@/lib/open-mail-reading-popout'
import { entityRefKindIcon } from '@/lib/entity-ref-ui'
import { cn } from '@/lib/utils'
import { useAccountsStore } from '@/stores/accounts'

function ConnectionsPreviewChrome({
  node,
  placement,
  onUndock,
  onClose,
  onOpenInModule,
  onMailPopout
}: {
  node: EntityGraphNode
  placement: ConnectionsPreviewPlacement
  onUndock: () => void
  onClose: () => void
  onOpenInModule: () => void
  onMailPopout: (opts?: { osWindow?: boolean }) => void
}): JSX.Element {
  const { t } = useTranslation()
  const accounts = useAccountsStore((s) => s.accounts)
  const KindIcon = entityRefKindIcon(node.kind)
  const isMailLike = node.ref.kind === 'mail' || node.ref.kind === 'mail_todo'

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-border px-2 py-2">
        <div className={moduleColumnHeaderDockBarRowClass}>
          <span
            className={cn(
              moduleColumnHeaderUppercaseLabelClass,
              'min-w-0 shrink-0 text-left'
            )}
          >
            {t('connections.preview.title')}
          </span>
          <div className="flex shrink-0 items-center gap-0.5">
            {isMailLike ? (
              <ModuleColumnHeaderIconButton
                title={t('mail.readingPane.previewPopOutTitle')}
                onClick={(e): void => {
                  onMailPopout({ osWindow: e.shiftKey })
                }}
              >
                <SquareArrowOutUpRight className={moduleColumnHeaderIconGlyphClass} />
              </ModuleColumnHeaderIconButton>
            ) : null}
            {placement === 'dock' ? (
              <ModuleColumnHeaderIconButton
                title={t('connections.preview.undockTitle')}
                onClick={onUndock}
              >
                <SquareArrowOutUpRight className={moduleColumnHeaderIconGlyphClass} />
              </ModuleColumnHeaderIconButton>
            ) : null}
            <ModuleColumnHeaderIconButton
              title={t('connections.shell.openObject')}
              onClick={onOpenInModule}
            >
              <ExternalLink className={moduleColumnHeaderIconGlyphClass} />
            </ModuleColumnHeaderIconButton>
            <ModuleColumnHeaderIconButton
              title={t('connections.preview.hideTitle')}
              onClick={onClose}
            >
              <PanelRightClose className={moduleColumnHeaderIconGlyphClass} />
            </ModuleColumnHeaderIconButton>
          </div>
        </div>
        <div className="mt-1.5 flex min-w-0 items-start gap-1.5 px-0.5">
          <KindIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-foreground">{node.title}</p>
            {node.subtitle ? (
              <p className="truncate text-[10px] text-muted-foreground">{node.subtitle}</p>
            ) : null}
          </div>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 overflow-hidden">
          <ConnectionsObjectPreview
            entityRef={node.ref}
            accounts={accounts}
            onRequestMailPopout={isMailLike ? onMailPopout : undefined}
          />
        </div>
        <div className="max-h-[38%] shrink-0 overflow-y-auto border-t border-border bg-secondary/5">
          <EntityContextBlock
            anchor={node.ref}
            showObjectNote={false}
            sectionCollapsedDefault={false}
            contentPaddingClass="px-3"
          />
        </div>
      </div>
    </div>
  )
}

export function ConnectionsPreviewPane({
  node,
  open,
  placement,
  onPlacementChange,
  onClose,
  dockWidthPx,
  onDockWidthDrag,
  onOpenInModule
}: {
  node: EntityGraphNode
  /** Sichtbarkeit (Schliessen animiert das Float-Panel statt es sofort abzumontieren). */
  open: boolean
  placement: ConnectionsPreviewPlacement
  onPlacementChange: (placement: ConnectionsPreviewPlacement) => void
  onClose: () => void
  dockWidthPx: number
  onDockWidthDrag: (delta: number) => void
  onOpenInModule: () => void
}): JSX.Element {
  const { t } = useTranslation()
  const [floatHostAlive, setFloatHostAlive] = useState(placement === 'float')

  useEffect(() => {
    if (placement === 'float') {
      setFloatHostAlive(true)
      return
    }
    if (!floatHostAlive) return
    const id = window.setTimeout(() => setFloatHostAlive(false), 340)
    return (): void => clearTimeout(id)
  }, [placement, floatHostAlive])

  const floatPanelOpen = placement === 'float' && open

  const handleMailPopout = (opts?: { osWindow?: boolean }): void => {
    void (async (): Promise<void> => {
      let messageId: number | null = null
      if (node.ref.kind === 'mail') messageId = node.ref.messageId
      else if (node.ref.kind === 'mail_todo') {
        messageId = await window.mailClient.entityLinks.getMailTodoMessageId(node.ref.todoId)
      }
      if (messageId != null) openMailReadingPopout(messageId, { osWindow: opts?.osWindow })
    })()
  }

  const handleUndock = (): void => {
    onPlacementChange('float')
    persistConnectionsPreviewPlacement('float')
  }

  const handleDock = (): void => {
    onPlacementChange('dock')
    persistConnectionsPreviewPlacement('dock')
  }

  const chrome = (
    <ConnectionsPreviewChrome
      node={node}
      placement={placement}
      onUndock={handleUndock}
      onClose={onClose}
      onOpenInModule={onOpenInModule}
      onMailPopout={handleMailPopout}
    />
  )

  const floatWidth = Math.min(920, Math.max(320, Math.round(dockWidthPx)))
  const floatPos = useMemo(() => {
    const x = Math.max(12, window.innerWidth - floatWidth - 20)
    return { x, y: 68 }
  }, [floatWidth])

  return (
    <>
      {placement === 'dock' && open ? (
        <>
          <VerticalSplitter
            ariaLabel={t('connections.preview.splitterAria')}
            onDrag={onDockWidthDrag}
          />
          <aside
            className="flex min-h-0 shrink-0 flex-col border-l border-border bg-card"
            style={{ width: dockWidthPx }}
          >
            {chrome}
          </aside>
        </>
      ) : null}
      {floatHostAlive ? (
        <CalendarFloatingPanel
          key="connections-preview-float"
          open={floatPanelOpen}
          title={node.title}
          widthPx={floatWidth}
          minHeightPx={400}
          persistSizeKey={CONNECTIONS_FLOAT_PREVIEW_SIZE_KEY}
          defaultPosition={floatPos}
          zIndex={92}
          onClose={onClose}
          onDock={handleDock}
        >
          {chrome}
        </CalendarFloatingPanel>
      ) : null}
    </>
  )
}
