import { useCallback, useEffect, useMemo, useState } from 'react'
import { AppWindow, ExternalLink, PanelRightClose } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { EntityGraphNode } from '@shared/entity-links'
import { CalendarFloatingPanel } from '@/app/calendar/CalendarFloatingPanel'
import { ConnectionsObjectPreview } from '@/app/connections/ConnectionsObjectPreview'
import {
  CONNECTIONS_FLOAT_PREVIEW_SIZE_KEY,
  CONNECTIONS_PREVIEW_CONTEXT_HEIGHT_DEFAULT,
  CONNECTIONS_PREVIEW_CONTEXT_HEIGHT_KEY,
  connectionsPreviewContextHeightMax,
  CONNECTIONS_PREVIEW_CONTEXT_HEIGHT_MIN,
  type ConnectionsPreviewPlacement,
  persistConnectionsPreviewPlacement
} from '@/app/connections/connections-preview-storage'
import { EntityContextBlock } from '@/components/connections/EntityContextBlock'
import type { ObjectNoteTarget } from '@/components/ObjectNoteEditor'
import {
  ModuleColumnHeaderIconButton,
  moduleColumnHeaderDockBarRowClass,
  moduleColumnHeaderIconGlyphClass,
  moduleColumnHeaderUppercaseLabelClass
} from '@/components/ModuleColumnHeader'
import {
  HorizontalSplitter,
  useResizableHeight,
  VerticalSplitter
} from '@/components/ResizableSplitter'
import { openMailReadingPopout } from '@/lib/open-mail-reading-popout'
import { shouldUseOsFloatingPanel } from '@/lib/open-panel-popout'
import { openConnectionsPreviewOsPopout } from '@/lib/open-panel-popout-helpers'
import { entityRefKindIcon } from '@/lib/entity-ref-ui'
import { cn } from '@/lib/utils'
import { useAccountsStore } from '@/stores/accounts'
import { useMailStore } from '@/stores/mail'

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
  /** Optional: Shift+Klick auf „Schwebend“ öffnet die Mail in einem eigenen Fenster. */
  onMailPopout?: (opts?: import('@/lib/open-mail-reading-popout').MailReadingPopoutOpenOpts) => void
}): JSX.Element {
  const { t } = useTranslation()
  const accounts = useAccountsStore((s) => s.accounts)
  const KindIcon = entityRefKindIcon(node.kind)
  const isMailLike = node.ref.kind === 'mail' || node.ref.kind === 'mail_todo'
  const selectedMessage = useMailStore((s) => s.selectedMessage)
  const [previewNoteTarget, setPreviewNoteTarget] = useState<ObjectNoteTarget | null>(null)
  const onContextNoteTarget = useCallback((target: ObjectNoteTarget | null): void => {
    setPreviewNoteTarget(target)
  }, [])

  useEffect(() => {
    setPreviewNoteTarget(null)
  }, [node.ref])
  const contextNoteTarget = useMemo((): ObjectNoteTarget | null => {
    if (node.ref.kind === 'mail') {
      return {
        kind: 'mail',
        messageId: node.ref.messageId,
        title:
          selectedMessage?.subject?.trim() || node.title.trim() || t('common.noSubject')
      }
    }
    if (node.ref.kind === 'mail_todo' && selectedMessage) {
      return {
        kind: 'mail',
        messageId: selectedMessage.id,
        title:
          selectedMessage.subject?.trim() || node.title.trim() || t('common.noSubject')
      }
    }
    if (node.ref.kind === 'calendar_event') return previewNoteTarget
    return null
  }, [node.ref, node.title, selectedMessage, previewNoteTarget, t])
  const contextHeightMax = connectionsPreviewContextHeightMax()
  const [contextHeight, setContextHeight] = useResizableHeight({
    storageKey: CONNECTIONS_PREVIEW_CONTEXT_HEIGHT_KEY,
    defaultHeight: CONNECTIONS_PREVIEW_CONTEXT_HEIGHT_DEFAULT,
    minHeight: CONNECTIONS_PREVIEW_CONTEXT_HEIGHT_MIN,
    maxHeight: contextHeightMax
  })

  const isFloating = placement === 'float'

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-border/30 px-2 py-2">
        <div className={moduleColumnHeaderDockBarRowClass}>
          {!isFloating ? (
            <span
              className={cn(
                moduleColumnHeaderUppercaseLabelClass,
                'min-w-0 shrink-0 text-left'
              )}
            >
              {t('connections.preview.title')}
            </span>
          ) : (
            <span className="min-w-0 flex-1" aria-hidden />
          )}
          <div className="flex shrink-0 items-center gap-0.5">
            {!isFloating ? (
              <ModuleColumnHeaderIconButton
                title={
                  isMailLike && onMailPopout
                    ? t('connections.preview.floatTitleMailShift')
                    : t('connections.preview.floatTitle')
                }
                onClick={(e): void => {
                  if (e.shiftKey && isMailLike && onMailPopout) {
                    onMailPopout({ inAppFloat: true })
                    return
                  }
                  onUndock()
                }}
              >
                <AppWindow className={moduleColumnHeaderIconGlyphClass} />
              </ModuleColumnHeaderIconButton>
            ) : null}
            <ModuleColumnHeaderIconButton
              title={t('connections.preview.openInModuleTitle')}
              onClick={onOpenInModule}
            >
              <ExternalLink className={moduleColumnHeaderIconGlyphClass} />
            </ModuleColumnHeaderIconButton>
            {!isFloating ? (
              <ModuleColumnHeaderIconButton
                title={t('connections.preview.hideTitle')}
                onClick={onClose}
              >
                <PanelRightClose className={moduleColumnHeaderIconGlyphClass} />
              </ModuleColumnHeaderIconButton>
            ) : null}
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
            onContextNoteTarget={onContextNoteTarget}
          />
        </div>
        <HorizontalSplitter
          variant="subtle"
          ariaLabel={t('connections.preview.contextSplitterAria')}
          onDrag={(deltaY): void => {
            setContextHeight((h) => h - deltaY)
          }}
        />
        <div
          className="flex min-h-0 shrink-0 flex-col overflow-hidden bg-secondary/[0.02]"
          style={{ height: Math.min(contextHeight, contextHeightMax) }}
        >
          <div className="min-h-0 flex-1 overflow-y-auto">
            <EntityContextBlock
              anchor={node.ref}
              noteTarget={contextNoteTarget}
              showObjectNote={contextNoteTarget != null}
              sectionCollapsedDefault={false}
              contentPaddingClass="px-3"
            />
          </div>
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

  const handleMailPopout = (opts?: import('@/lib/open-mail-reading-popout').MailReadingPopoutOpenOpts): void => {
    void (async (): Promise<void> => {
      let messageId: number | null = null
      if (node.ref.kind === 'mail') messageId = node.ref.messageId
      else if (node.ref.kind === 'mail_todo') {
        messageId = await window.mailClient.entityLinks.getMailTodoMessageId(node.ref.todoId)
      }
      if (messageId != null) openMailReadingPopout(messageId, opts)
    })()
  }

  const handleUndock = (): void => {
    if (shouldUseOsFloatingPanel()) {
      void openConnectionsPreviewOsPopout(node.ref, node.title)
      onClose()
      return
    }
    onPlacementChange('float')
    persistConnectionsPreviewPlacement('float')
  }

  const handleDock = (): void => {
    onPlacementChange('dock')
    persistConnectionsPreviewPlacement('dock')
  }

  const isMailLike = node.ref.kind === 'mail' || node.ref.kind === 'mail_todo'

  const chrome = (
    <ConnectionsPreviewChrome
      node={node}
      placement={placement}
      onUndock={handleUndock}
      onClose={onClose}
      onOpenInModule={onOpenInModule}
      onMailPopout={isMailLike ? handleMailPopout : undefined}
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
