import { ChevronDown, Eye, SlidersHorizontal } from 'lucide-react'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode
} from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useSearchDropdownPortal } from '@/lib/use-search-dropdown-portal'
import type { EntityRefKind } from '@shared/entity-ref'
import type { EntityGraphClusterMode } from '@shared/entity-links'
import {
  type ConnectionsGraphViewSettings,
  type GraphLinkKindFilter
} from '@/app/connections/connections-graph-view-settings'
import {
  moduleColumnHeaderIconGlyphClass,
  moduleColumnHeaderOutlineSmClass
} from '@/components/ModuleColumnHeader'
import { useAccountsStore } from '@/stores/accounts'
import { cn } from '@/lib/utils'

const KIND_DOT: Record<EntityRefKind, string> = {
  mail: '#0ea5e9',
  mail_todo: '#f59e0b',
  cloud_task: '#10b981',
  calendar_event: '#8b5cf6',
  note: '#ca8a04',
  people_contact: '#f43f5e'
}

const KINDS: EntityRefKind[] = [
  'mail',
  'mail_todo',
  'calendar_event',
  'cloud_task',
  'people_contact',
  'note'
]

const CLUSTER_MODES: EntityGraphClusterMode[] = [
  'account',
  'kind',
  'scope',
  'component',
  'time_month',
  'time_week',
  'time_year',
  'domain',
  'company',
  'calendar_list',
  'task_list',
  'none'
]

const toolbarLabelClass = 'shrink-0 text-[10px] font-medium text-muted-foreground'
const toolbarSelectClass = cn(
  moduleColumnHeaderOutlineSmClass,
  'h-7 min-w-0 max-w-[9.5rem] shrink-0 truncate px-2 text-[11px] font-normal'
)

function countActiveFilters(settings: ConnectionsGraphViewSettings): number {
  let n = 0
  if (settings.accountFilter) n++
  if (settings.hideOrphans) n++
  return n
}

function countActiveViewSettings(settings: ConnectionsGraphViewSettings): number {
  let n = 0
  if (settings.linkKindFilter !== 'all') n++
  if (settings.focusDepth > 0) n++
  return n
}

function LabeledSelect({
  label,
  title,
  value,
  onChange,
  highlight,
  className,
  children
}: {
  label: string
  title?: string
  value: string | number
  onChange: (e: ChangeEvent<HTMLSelectElement>) => void
  highlight?: boolean
  className?: string
  children: ReactNode
}): JSX.Element {
  return (
    <label
      className={cn('flex h-7 shrink-0 items-center gap-1', className)}
      title={title ?? label}
    >
      <span className="max-w-[4.5rem] truncate text-[10px] text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={onChange}
        className={cn(
          toolbarSelectClass,
          'max-w-[7.5rem]',
          highlight && 'border-primary/40 bg-primary/10'
        )}
        aria-label={label}
      >
        {children}
      </select>
    </label>
  )
}

function countHiddenKinds(settings: ConnectionsGraphViewSettings): number {
  return KINDS.filter((k) => settings.hiddenKinds[k]).length
}

function ToolbarMenu({
  label,
  icon,
  active,
  badge,
  panelWidth = 280,
  align = 'left',
  children
}: {
  label: string
  icon: ReactNode
  active?: boolean
  badge?: number
  panelWidth?: number
  align?: 'left' | 'right'
  children: ReactNode
}): JSX.Element {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const panelStyle = useSearchDropdownPortal(btnRef, open, { width: panelWidth, align })

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent): void => {
      const target = e.target as Node
      if (btnRef.current?.contains(target)) return
      if (panelRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="relative shrink-0">
      <button
        ref={btnRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={(): void => setOpen((v) => !v)}
        className={cn(
          moduleColumnHeaderOutlineSmClass,
          'h-7 max-w-[11rem] gap-1 px-2',
          active && 'border-primary/40 bg-primary/10'
        )}
      >
        <span className="text-muted-foreground">{icon}</span>
        <span className="min-w-0 truncate">{label}</span>
        {badge != null && badge > 0 ? (
          <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-semibold text-primary-foreground">
            {badge}
          </span>
        ) : null}
        <ChevronDown
          className={cn(
            moduleColumnHeaderIconGlyphClass,
            'shrink-0 transition-transform',
            open && 'rotate-180'
          )}
        />
      </button>
      {open
        ? createPortal(
            <div
              ref={panelRef}
              role="dialog"
              className="overflow-y-auto rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-xl"
              style={panelStyle}
            >
              {children}
            </div>,
            document.body
          )
        : null}
    </div>
  )
}

function ToolbarDivider(): JSX.Element {
  return <span className="mx-0.5 hidden h-5 w-px shrink-0 bg-border sm:block" aria-hidden />
}

export function ConnectionsGraphControls({
  clusterMode,
  onClusterModeChange,
  settings,
  onSettingsChange
}: {
  clusterMode: EntityGraphClusterMode
  onClusterModeChange: (mode: EntityGraphClusterMode) => void
  settings: ConnectionsGraphViewSettings
  onSettingsChange: (next: ConnectionsGraphViewSettings) => void
}): JSX.Element {
  const { t } = useTranslation()
  const accounts = useAccountsStore((s) => s.accounts)

  const patch = (partial: Partial<ConnectionsGraphViewSettings>): void => {
    onSettingsChange({ ...settings, ...partial })
  }

  const toggleKind = (kind: EntityRefKind): void => {
    const hidden = { ...settings.hiddenKinds }
    if (hidden[kind]) delete hidden[kind]
    else hidden[kind] = true
    patch({ hiddenKinds: hidden })
  }

  const filterActive = useMemo(() => countActiveFilters(settings), [settings])
  const viewActive = useMemo(() => countActiveViewSettings(settings), [settings])
  const hiddenKindCount = useMemo(() => countHiddenKinds(settings), [settings])
  const displayActive =
    settings.edgeThickness !== 1 ||
    settings.clusterSpacing !== 1 ||
    Object.keys(settings.kindColors).length > 0

  const filterHighlight = filterActive > 0
  const viewHighlight = viewActive > 0

  return (
    <div className="flex min-w-0 shrink-0 flex-wrap items-center gap-x-1 gap-y-1">
      <span className={toolbarLabelClass}>{t('connections.graph.clusterMode')}</span>
      <select
        value={clusterMode}
        title={t(`connections.graph.clusterMode_${clusterMode}`)}
        onChange={(e): void =>
          onClusterModeChange(e.target.value as EntityGraphClusterMode)
        }
        className={cn(toolbarSelectClass, 'max-w-[11rem]')}
        aria-label={t('connections.graph.clusterMode')}
      >
        {CLUSTER_MODES.map((mode) => (
          <option key={mode} value={mode}>
            {t(`connections.graph.clusterMode_${mode}`)}
          </option>
        ))}
      </select>

      <ToolbarDivider />

      <span
        className={cn(toolbarLabelClass, filterActive > 0 && 'text-foreground')}
        title={t('connections.graphControls.filterHint')}
      >
        {t('connections.graphControls.filter')}
      </span>
      <LabeledSelect
        label={t('connections.graphControls.account')}
        value={settings.accountFilter ?? ''}
        onChange={(e): void => patch({ accountFilter: e.target.value || null })}
        highlight={filterHighlight}
      >
        <option value="">{t('connections.filterAll')}</option>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.displayName?.trim() || a.email}
          </option>
        ))}
      </LabeledSelect>
      <label
        className={cn(
          'flex h-7 shrink-0 cursor-pointer items-center gap-1 rounded-md border border-border px-2 text-[10px] text-foreground',
          settings.hideOrphans && 'border-primary/40 bg-primary/10'
        )}
        title={t('connections.graphControls.hideOrphans')}
      >
        <input
          type="checkbox"
          checked={settings.hideOrphans}
          onChange={(e): void => patch({ hideOrphans: e.target.checked })}
          className="rounded border-border"
        />
        <span className="hidden lg:inline">{t('connections.graphControls.hideOrphansShort')}</span>
      </label>

      <ToolbarDivider />

      <span
        className={cn(toolbarLabelClass, viewActive > 0 && 'text-foreground')}
        title={t('connections.graphControls.viewHint')}
      >
        {t('connections.graphControls.view')}
      </span>
      <LabeledSelect
        label={t('connections.graphControls.connections')}
        value={settings.linkKindFilter}
        onChange={(e): void =>
          patch({ linkKindFilter: e.target.value as GraphLinkKindFilter })
        }
        highlight={viewHighlight}
        className="max-w-[12rem]"
      >
        <option value="all">{t('connections.graphControls.connectionsAll')}</option>
        <option value="related">{t('connections.graphControls.linkRelated')}</option>
        <option value="derived_from">{t('connections.graphControls.linkDerived')}</option>
        <option value="suggested">{t('connections.graphControls.linkSuggested')}</option>
      </LabeledSelect>
      <LabeledSelect
        label={t('connections.graphControls.selectionScope')}
        value={settings.focusDepth}
        onChange={(e): void =>
          patch({ focusDepth: Number(e.target.value) as 0 | 1 | 2 })
        }
        highlight={viewHighlight}
        title={t('connections.graphControls.selectionScopeHint')}
      >
        <option value={0}>{t('connections.graphControls.focusDepthOff')}</option>
        <option value={1}>{t('connections.graphControls.focusDepth1')}</option>
        <option value={2}>{t('connections.graphControls.focusDepth2')}</option>
      </LabeledSelect>

      <ToolbarDivider />

      <ToolbarMenu
        label={t('connections.graphControls.typesShort')}
        icon={<Eye className={moduleColumnHeaderIconGlyphClass} aria-hidden />}
        active={hiddenKindCount > 0}
        badge={hiddenKindCount}
        panelWidth={240}
      >
        <p className="mb-2 text-[10px] text-muted-foreground">
          {t('connections.graphControls.groupsHint')}
        </p>
        <ul className="space-y-1">
          {KINDS.map((kind) => (
            <li key={kind}>
              <label className="flex cursor-pointer items-center gap-2 text-[11px]">
                <input
                  type="checkbox"
                  checked={!settings.hiddenKinds[kind]}
                  onChange={(): void => toggleKind(kind)}
                  className="rounded border-border"
                />
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{
                    background: settings.kindColors[kind] ?? KIND_DOT[kind]
                  }}
                />
                {t(`connections.kind.${kind}`)}
              </label>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="mt-2 text-[10px] text-primary hover:underline"
          onClick={(): void => patch({ hiddenKinds: {} })}
        >
          {t('connections.graphControls.resetGroups')}
        </button>
      </ToolbarMenu>

      <ToolbarMenu
        label={t('connections.graphControls.display')}
        icon={<SlidersHorizontal className={moduleColumnHeaderIconGlyphClass} aria-hidden />}
        active={displayActive}
      >
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-medium text-muted-foreground">
            {t('connections.graphControls.edgeThickness')}
          </span>
          <input
            type="range"
            min={0.5}
            max={2}
            step={0.1}
            value={settings.edgeThickness}
            onChange={(e): void => patch({ edgeThickness: Number(e.target.value) })}
            className="w-full"
          />
          <span className="text-[10px] text-foreground">
            {settings.edgeThickness.toFixed(1)}×
          </span>
        </label>
        <label
          className={cn(
            'mt-3 flex flex-col gap-1',
            clusterMode === 'none' && 'pointer-events-none opacity-50'
          )}
        >
          <span className="text-[10px] font-medium text-muted-foreground">
            {t('connections.graphControls.clusterSpacing')}
          </span>
          <input
            type="range"
            min={0}
            max={2}
            step={0.05}
            disabled={clusterMode === 'none'}
            value={settings.clusterSpacing}
            onChange={(e): void => patch({ clusterSpacing: Number(e.target.value) })}
            className="w-full"
          />
          <span className="text-[10px] text-foreground">
            {clusterMode === 'none'
              ? t('connections.graphControls.clusterSpacingOff')
              : t('connections.graphControls.clusterSpacingValue', {
                  value: settings.clusterSpacing.toFixed(2)
                })}
          </span>
        </label>
      </ToolbarMenu>
    </div>
  )
}
