import {
  House,
  Inbox,
  Calendar,
  Search,
  Settings,
  PenSquare,
  RefreshCw,
  Loader2,
  X,
  Paperclip,
  Sun,
  Moon,
  Monitor,
  Check,
  MessageCircle,
  BookOpen,
  StickyNote,
  ListTodo,
  ListChecks,
  Users,
  WifiOff,
  ChevronDown,
  Mail,
  UserPlus,
  Filter,
  Link2,
  Building2,
  Files,
  Columns3,
  Image,
  LayoutDashboard,
  LayoutGrid,
  Pencil,
  Plus,
  RotateCcw,
  TextCursor,
  Trash2
} from 'lucide-react'
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core'
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cn } from '@/lib/utils'
import { resolvedAccountColorCss } from '@/lib/avatar-color'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useAccountsStore } from '@/stores/accounts'
import { useComposeStore } from '@/stores/compose'
import { useMailStore } from '@/stores/mail'
import {
  ACCENT_LIST,
  accentHsl,
  useThemeStore,
  type AccentName,
  type ThemeMode,
  type DarkPalette
} from '@/stores/theme'
import type { ConnectedAccount, SearchHit } from '@shared/types'
import { useAppModeStore, type AppShellMode } from '@/stores/app-mode'
import { CustomViewIconPickerDialog } from '@/app/custom-views/CustomViewIconPickerDialog'
import { resolveCustomViewTabIcon } from '@/lib/custom-view-tab-icon'
import { CUSTOM_VIEWS_CHANGED_EVENT, useCustomViewsStore } from '@/stores/custom-views'
import { showAppPrompt } from '@/stores/app-dialog'
import {
  customViewIconIdOrDefault,
  readCustomViews,
  readCustomViewTopbarOrder,
  reconcileCustomViewTopbarOrder
} from '@/app/custom-views/custom-views-storage'
import { readTopbarModuleOrder, reconcileTopbarModuleOrder } from '@/app/layout/topbar-module-order'
import {
  TOPBAR_MODULE_PREFS_CHANGED_EVENT,
  readTopbarModuleHiddenSet,
  resolveVisibleAppShellMode,
  setTopbarModuleVisible
} from '@/app/layout/topbar-module-prefs'
import {
  isTopbarModuleTabId,
  mergeTopbarTabOrderAfterModulePrefsChange,
  parseTopbarTabCustomViewId,
  readTopbarTabOrder,
  readVisibleTopbarTabOrder,
  reorderVisibleTopbarTabs,
  persistTopbarTabOrder,
  reconcileTopbarTabOrder,
  topbarTabCustomViewId,
  type TopbarTabId
} from '@/app/layout/topbar-tab-order'
import { useTopbarTabsOverflow } from '@/app/layout/use-topbar-tabs-overflow'
import {
  TopbarTabsOverflowMenu,
  type TopbarOverflowEntry
} from '@/app/layout/TopbarTabsOverflowMenu'
import { TopbarTabsOverflowMeasureButton } from '@/app/layout/TopbarTabsOverflowMeasureButton'
import { ContextMenu, type ContextMenuItem } from '@/components/ContextMenu'
import { useMailWorkspaceLayoutStore } from '@/stores/mail-workspace-layout'
import { useCalendarPanelLayoutStore } from '@/stores/calendar-panel-layout'
import { useConnectivityStore } from '@/stores/connectivity'
import { TopbarGlobalSearch } from '@/app/layout/TopbarGlobalSearch'
import {
  defaultCreateKindForMode,
  dispatchGlobalCreate,
  RULE_CREATE_FLUSH_EVENT,
  RULE_CREATE_PENDING_SESSION_KEY,
  targetShellModeForCreateKind,
  useGlobalCreateNavigateStore,
  type GlobalCreateKind
} from '@/lib/global-create'
import { requestOpenAccountSettings } from '@/lib/open-account-settings'
import { useFramelessTitlebar } from '@/lib/use-frameless-titlebar'
import { AppBrandMark } from '@/components/AppBrandMark'
import { WindowTitlebarControls } from '@/app/layout/WindowTitlebarControls'

interface Props {
  onOpenAccountDialog: () => void
}

function SortableCustomViewTab({
  id,
  name,
  iconId,
  active,
  onSelect,
  onContextMenu,
  dragAria,
  dragTitle
}: {
  id: TopbarTabId
  name: string
  iconId: string
  active: boolean
  onSelect: () => void
  onContextMenu: (e: React.MouseEvent) => void
  dragAria: string
  dragTitle: string
}): JSX.Element {
  const TabIcon = resolveCustomViewTabIcon(iconId)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    ...(isDragging ? { zIndex: 10, position: 'relative' } : {})
  }
  return (
    <button
      ref={setNodeRef}
      style={style}
      type="button"
      {...attributes}
      {...listeners}
      onClick={onSelect}
      onContextMenu={onContextMenu}
      title={dragTitle || name}
      className={cn(
        'relative inline-flex h-12 shrink-0 touch-none items-center gap-1.5 whitespace-nowrap rounded-md px-3 text-xs font-medium transition-colors',
        'cursor-grab active:cursor-grabbing',
        active ? 'text-foreground' : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground',
        isDragging && 'opacity-90'
      )}
      aria-current={active ? 'page' : undefined}
    >
      <TabIcon key={iconId} className="h-4 w-4 shrink-0" aria-hidden />
      <span className="max-w-[8rem] truncate">{name}</span>
      <span className="sr-only">{` ${dragAria}`}</span>
      <span
        aria-hidden
        className={cn(
          'absolute inset-x-1 -bottom-px h-0.5 rounded-t bg-primary transition-opacity',
          active ? 'opacity-100' : 'opacity-0'
        )}
      />
    </button>
  )
}

function SortableTopbarModeTab({
  id,
  label,
  icon: Icon,
  active,
  onSelect,
  onContextMenu,
  dragAria,
  dragTitle
}: {
  id: AppShellMode
  label: string
  icon: React.ComponentType<{ className?: string }>
  active: boolean
  onSelect: (mode: AppShellMode) => void
  onContextMenu: (e: React.MouseEvent, id: AppShellMode) => void
  dragAria: string
  dragTitle: string
}): JSX.Element {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id
  })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    ...(isDragging ? { zIndex: 10, position: 'relative' } : {})
  }
  return (
    <button
      ref={setNodeRef}
      style={style}
      type="button"
      {...attributes}
      {...listeners}
      onClick={(): void => onSelect(id)}
      onContextMenu={(e): void => onContextMenu(e, id)}
      title={dragTitle}
      className={cn(
        'relative inline-flex h-12 shrink-0 touch-none items-center gap-1.5 whitespace-nowrap rounded-md px-3 text-xs font-medium transition-colors',
        'cursor-grab active:cursor-grabbing',
        active ? 'text-foreground' : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground',
        isDragging && 'opacity-90'
      )}
      aria-current={active ? 'page' : undefined}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
      <span className="sr-only">{` ${dragAria}`}</span>
      <span
        aria-hidden
        className={cn(
          'absolute inset-x-1 -bottom-px h-0.5 rounded-t bg-primary transition-opacity',
          active ? 'opacity-100' : 'opacity-0'
        )}
      />
    </button>
  )
}

const TOPBAR_CREATE_KINDS: GlobalCreateKind[] = [
  'mail',
  'task',
  'calendar_event',
  'booking',
  'business_booking',
  'note',
  'chat',
  'contact',
  'rule'
]

function createKindIcon(kind: GlobalCreateKind): React.ComponentType<{ className?: string }> {
  switch (kind) {
    case 'mail':
      return Mail
    case 'task':
      return ListTodo
    case 'calendar_event':
      return Calendar
    case 'booking':
      return Link2
    case 'business_booking':
      return Building2
    case 'note':
      return StickyNote
    case 'chat':
      return MessageCircle
    case 'contact':
      return UserPlus
    case 'rule':
      return Filter
    default:
      return PenSquare
  }
}

function TopbarGlobalCreateSplit({
  mode,
  accounts,
  setAppMode,
  onOpenAccountDialog,
  openFloatingNew
}: {
  mode: AppShellMode
  accounts: ConnectedAccount[]
  setAppMode: (m: AppShellMode) => void
  onOpenAccountDialog: () => void
  openFloatingNew: (accountId: string) => string
}): JSX.Element {
  const { t } = useTranslation()
  const [menuOpen, setMenuOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({})

  const primaryKind = useMemo(() => defaultCreateKindForMode(mode), [mode])
  const graphCapableAccounts = useMemo(
    () => accounts.filter((a) => a.provider === 'microsoft' || a.provider === 'google'),
    [accounts]
  )
  const microsoftAccounts = useMemo(
    () => accounts.filter((a) => a.provider === 'microsoft'),
    [accounts]
  )

  const PrimaryIcon = useMemo(() => createKindIcon(primaryKind), [primaryKind])

  function startNewMail(): void {
    const first = accounts[0]
    if (!first) {
      onOpenAccountDialog()
      return
    }
    openFloatingNew(first.id)
  }

  function isCreateKindDisabled(kind: GlobalCreateKind): boolean {
    if (kind === 'booking' || kind === 'business_booking') {
      return microsoftAccounts.length === 0
    }
    if (kind === 'calendar_event' || kind === 'task' || kind === 'contact') {
      return graphCapableAccounts.length === 0
    }
    return false
  }

  function disabledHint(kind: GlobalCreateKind): string | undefined {
    if ((kind === 'booking' || kind === 'business_booking') && microsoftAccounts.length === 0)
      return t('topbar.create.noMicrosoftAccount')
    if (kind === 'calendar_event' && graphCapableAccounts.length === 0)
      return t('topbar.create.noCalendarAccount')
    if (kind === 'task' && graphCapableAccounts.length === 0) return t('topbar.create.noTaskAccount')
    if (kind === 'contact' && graphCapableAccounts.length === 0) return t('topbar.create.noPeopleAccount')
    return undefined
  }

  function runCreateKind(kind: GlobalCreateKind): void {
    setMenuOpen(false)
    if (kind === 'mail') {
      startNewMail()
      return
    }
    if (kind === 'rule') {
      try {
        window.sessionStorage.setItem(RULE_CREATE_PENDING_SESSION_KEY, '1')
      } catch {
        // ignore
      }
      requestOpenAccountSettings({ tab: 'mail', mailSubNav: 'rules' })
      window.setTimeout((): void => {
        window.dispatchEvent(new CustomEvent(RULE_CREATE_FLUSH_EVENT))
      }, 280)
      return
    }
    const target = targetShellModeForCreateKind(kind)
    if (target == null) return
    if (mode !== target) {
      useGlobalCreateNavigateStore.getState().setPendingAfterNavigate(kind)
      setAppMode(target)
      return
    }
    dispatchGlobalCreate(kind)
  }

  const primaryDisabled = primaryKind !== 'mail' && isCreateKindDisabled(primaryKind)
  const primaryTitle = primaryDisabled
    ? disabledHint(primaryKind)
    : primaryKind === 'mail'
      ? t('topbar.newMailTitle')
      : t(`topbar.create.${primaryKind}`)

  const updateMenuPosition = useCallback((): void => {
    if (!wrapRef.current) return
    const r = wrapRef.current.getBoundingClientRect()
    const width = 220
    const left = Math.max(8, Math.min(window.innerWidth - width - 8, r.right - width))
    setMenuStyle({
      position: 'fixed',
      top: r.bottom + 4,
      left,
      width,
      zIndex: 210
    })
  }, [])

  useLayoutEffect(() => {
    if (!menuOpen) return
    updateMenuPosition()
  }, [menuOpen, updateMenuPosition])

  useEffect(() => {
    if (!menuOpen) return
    updateMenuPosition()
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    function onDown(e: MouseEvent): void {
      const target = e.target as Node
      if (wrapRef.current?.contains(target)) return
      if (menuRef.current?.contains(target)) return
      setMenuOpen(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onDown)
    window.addEventListener('resize', updateMenuPosition)
    window.addEventListener('scroll', updateMenuPosition, true)
    return (): void => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('resize', updateMenuPosition)
      window.removeEventListener('scroll', updateMenuPosition, true)
    }
  }, [menuOpen, updateMenuPosition])

  return (
    <div ref={wrapRef} className="relative flex shrink-0">
      <div className="flex h-8 items-stretch overflow-hidden rounded-md bg-primary shadow-sm">
        <button
          type="button"
          disabled={Boolean(primaryDisabled)}
          onClick={(): void => runCreateKind(primaryKind)}
          title={primaryTitle}
          className={cn(
            'flex items-center gap-1.5 px-2.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 sm:px-3',
            primaryDisabled && 'cursor-not-allowed opacity-50 hover:bg-primary'
          )}
        >
          <PrimaryIcon className="h-4 w-4 shrink-0" />
          <span className="hidden max-w-[10rem] truncate sm:inline">{t(`topbar.create.${primaryKind}`)}</span>
        </button>
        <button
          type="button"
          onClick={(): void => setMenuOpen((o) => !o)}
          className="border-l border-primary-foreground/25 px-1.5 text-primary-foreground transition-colors hover:bg-primary/90"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          aria-label={t('topbar.create.splitChevronAria')}
          title={t('topbar.create.splitChevronAria')}
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>
      {menuOpen &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label={t('topbar.create.menuAria')}
            className="chronell-acrylic-popover glass-animate-in overflow-hidden py-1 text-popover-foreground"
            style={menuStyle}
          >
            {TOPBAR_CREATE_KINDS.map((kind) => {
              const disabled = kind !== 'mail' && kind !== 'rule' && isCreateKindDisabled(kind)
              const Icon = createKindIcon(kind)
              const hint = disabled ? disabledHint(kind) : undefined
              return (
                <button
                  key={kind}
                  type="button"
                  role="menuitem"
                  disabled={Boolean(disabled)}
                  title={hint}
                  onClick={(): void => {
                    if (disabled) return
                    runCreateKind(kind)
                  }}
                  className={cn(
                    'flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-secondary/60',
                    disabled ? 'cursor-not-allowed opacity-45' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="flex-1">{t(`topbar.create.${kind}`)}</span>
                </button>
              )
            })}
          </div>,
          document.body
        )}
    </div>
  )
}

export function Topbar({ onOpenAccountDialog }: Props): JSX.Element {
  const { t, i18n } = useTranslation()
  const shellModes = useMemo(
    () =>
      [
        { id: 'home' as const, label: t('topbar.modeHome'), icon: House },
        {
          id: 'layoutStudio' as const,
          label: t('topbar.modeLayoutStudio'),
          icon: Columns3
        },
        { id: 'mail' as const, label: t('topbar.modeMail'), icon: Inbox },
        { id: 'calendar' as const, label: t('topbar.modeCalendar'), icon: Calendar },
        { id: 'bookings' as const, label: t('topbar.modeBookings'), icon: Building2 },
        { id: 'tasks' as const, label: t('topbar.modeTasks'), icon: ListTodo },
        { id: 'work' as const, label: t('topbar.modeWork'), icon: ListChecks },
        { id: 'people' as const, label: t('topbar.modePeople'), icon: Users },
        { id: 'notes' as const, label: t('topbar.modeNotes'), icon: StickyNote },
        { id: 'files' as const, label: t('topbar.modeFiles'), icon: Files },
        { id: 'connections' as const, label: t('topbar.modeConnections'), icon: Link2 },
        { id: 'chat' as const, label: t('topbar.modeChat'), icon: MessageCircle }
      ] satisfies Array<{
        id: AppShellMode
        label: string
        icon: React.ComponentType<{ className?: string }>
      }>,
    [t]
  )

  const [refreshing, setRefreshing] = useState(false)
  const framelessTitlebar = useFramelessTitlebar()
  const mode = useAppModeStore((s) => s.mode)
  const setAppMode = useAppModeStore((s) => s.setMode)
  const customViews = useCustomViewsStore((s) => s.views)
  const reorderCustomViews = useCustomViewsStore((s) => s.reorderViews)
  const activeCustomViewId = useCustomViewsStore((s) => s.activeViewId)
  const openCustomViewWizard = useCustomViewsStore((s) => s.openWizard)
  const customViewEditMode = useCustomViewsStore((s) => s.editMode)
  const customViewEditSnapshot = useCustomViewsStore((s) => s.editSnapshot)
  const toggleCustomViewEditMode = useCustomViewsStore((s) => s.toggleViewEditMode)
  const openCustomViewTemplatePicker = useCustomViewsStore((s) => s.openTemplatePickerForView)
  const renameCustomView = useCustomViewsStore((s) => s.renameView)
  const revertCustomViewLayout = useCustomViewsStore((s) => s.revertViewLayout)
  const focusCustomView = useCustomViewsStore((s) => s.focusCustomView)
  const setActiveCustomView = useCustomViewsStore((s) => s.setActiveView)
  const deleteCustomView = useCustomViewsStore((s) => s.deleteView)

  const customViewIds = useMemo(() => customViews.map((v) => v.id), [customViews])

  const [customViewIconPickerId, setCustomViewIconPickerId] = useState<string | null>(null)

  const [customViewContextMenu, setCustomViewContextMenu] = useState<{
    x: number
    y: number
    viewId: string
  } | null>(null)
  const accounts = useAccountsStore((s) => s.accounts)
  const openFloatingNew = useComposeStore((s) => s.openFloatingNew)
  const refreshNow = useMailStore((s) => s.refreshNow)
  const anyAccountSyncing = useMailStore(
    useShallow((s) =>
      Object.values(s.syncByAccount).some((st) => st.state.startsWith('syncing'))
    )
  )
  const online = useConnectivityStore((s) => s.online)

  const [tabOrder, setTabOrder] = useState<TopbarTabId[]>(() =>
    readTopbarTabOrder(readCustomViews().map((v) => v.id))
  )
  const [modeOrder, setModeOrder] = useState(readTopbarModuleOrder)
  const [hiddenModules, setHiddenModules] = useState(readTopbarModuleHiddenSet)

  const visibleTabIds = useMemo(
    () => readVisibleTopbarTabOrder(tabOrder, hiddenModules),
    [tabOrder, hiddenModules]
  )

  const visibleModuleCount = useMemo(
    () => visibleTabIds.filter((id) => parseTopbarTabCustomViewId(id) == null).length,
    [visibleTabIds]
  )

  const [moduleContextMenu, setModuleContextMenu] = useState<{
    x: number
    y: number
    moduleId: AppShellMode
  } | null>(null)

  const topbarTabEntries = useMemo(() => {
    const modesById = new Map(shellModes.map((m) => [m.id, m]))
    const viewsById = new Map(customViews.map((v) => [v.id, v]))
    const out: Array<
      | { kind: 'module'; tabId: TopbarTabId; id: AppShellMode; label: string; icon: React.ComponentType<{ className?: string }> }
      | { kind: 'customView'; tabId: TopbarTabId; view: (typeof customViews)[number] }
    > = []
    for (const tabId of visibleTabIds) {
      const viewId = parseTopbarTabCustomViewId(tabId)
      if (viewId) {
        const view = viewsById.get(viewId)
        if (view) out.push({ kind: 'customView', tabId, view })
        continue
      }
      if (isTopbarModuleTabId(tabId)) {
        const mode = modesById.get(tabId)
        if (mode) {
          out.push({ kind: 'module', tabId, id: mode.id, label: mode.label, icon: mode.icon })
        }
      }
    }
    return out
  }, [customViews, shellModes, visibleTabIds])

  const activeTopbarTabId = useMemo((): TopbarTabId => {
    if (mode === 'customView' && activeCustomViewId) {
      return topbarTabCustomViewId(activeCustomViewId)
    }
    if (mode !== 'customView') return mode
    return visibleTabIds[0] ?? 'home'
  }, [activeCustomViewId, mode, visibleTabIds])

  const topbarMeasureKey = useMemo(
    () =>
      topbarTabEntries
        .map((e) =>
          e.kind === 'module'
            ? `${e.tabId}:${e.label}`
            : `${e.tabId}:${e.view.name}:${customViewIconIdOrDefault(e.view.iconId)}`
        )
        .join('|'),
    [topbarTabEntries]
  )

  const {
    navRef,
    measureRef,
    overflowMeasureRef,
    createBtnRef,
    visibleIndices,
    showOverflow
  } = useTopbarTabsOverflow(
    topbarTabEntries.length,
    activeTopbarTabId,
    visibleTabIds,
    topbarMeasureKey
  )

  const { inlineTabEntries, overflowTabEntries } = useMemo(() => {
    const inline: typeof topbarTabEntries = []
    const overflow: TopbarOverflowEntry[] = []
    topbarTabEntries.forEach((entry, index) => {
      if (visibleIndices.size === 0 || visibleIndices.has(index)) {
        inline.push(entry)
        return
      }
      if (entry.kind === 'module') {
        overflow.push({
          kind: 'module',
          tabId: entry.tabId,
          id: entry.id,
          label: entry.label,
          icon: entry.icon,
          active: mode === entry.id
        })
      } else {
        const tabIconId = customViewIconIdOrDefault(entry.view.iconId)
        const ViewIcon = resolveCustomViewTabIcon(tabIconId)
        overflow.push({
          kind: 'customView',
          tabId: entry.tabId,
          name: entry.view.name,
          icon: ViewIcon,
          active: mode === 'customView' && activeCustomViewId === entry.view.id,
          viewId: entry.view.id
        })
      }
    })
    return { inlineTabEntries: inline, overflowTabEntries: overflow }
  }, [activeCustomViewId, mode, topbarTabEntries, visibleIndices])

  const sortableVisibleTabIds = useMemo(
    () => inlineTabEntries.map((e) => e.tabId),
    [inlineTabEntries]
  )

  const sensors = useSensors(
    useSensor(PointerSensor, {
      // Ohne Distanz-Schwelle wuerde der Sensor sofort aktiv werden und Klicks zum Moduswechsel blockieren.
      activationConstraint: { distance: 8 }
    })
  )

  useEffect(() => {
    const syncCustomViewsMeta = (): void => {
      const views = useCustomViewsStore.getState().views
      const ids = views.map((v) => v.id)
      const topbarOrder = reconcileCustomViewTopbarOrder(views, readCustomViewTopbarOrder())
      useCustomViewsStore.setState({ topbarOrder })
      setTabOrder((prev) => reconcileTopbarTabOrder(readTopbarTabOrder(ids), shellModes.map((m) => m.id), ids))
    }
    window.addEventListener(CUSTOM_VIEWS_CHANGED_EVENT, syncCustomViewsMeta)
    return (): void => window.removeEventListener(CUSTOM_VIEWS_CHANGED_EVENT, syncCustomViewsMeta)
  }, [shellModes])

  useEffect(() => {
    const canonical = shellModes.map((m) => m.id)
    setTabOrder((prev) => reconcileTopbarTabOrder(prev, canonical, customViewIds))
    setModeOrder((prev) => {
      const next = reconcileTopbarModuleOrder(prev, canonical)
      if (next.length === prev.length && next.every((id, i) => id === prev[i])) return prev
      return next
    })
  }, [customViewIds, shellModes])

  useEffect(() => {
    const onPrefsChanged = (): void => {
      const modules = readTopbarModuleOrder()
      setModeOrder(modules)
      setHiddenModules(readTopbarModuleHiddenSet())
      setTabOrder((prev) => {
        const next = mergeTopbarTabOrderAfterModulePrefsChange(prev, modules, customViewIds)
        persistTopbarTabOrder(next, customViewIds)
        return next
      })
    }
    window.addEventListener(TOPBAR_MODULE_PREFS_CHANGED_EVENT, onPrefsChanged)
    return (): void => window.removeEventListener(TOPBAR_MODULE_PREFS_CHANGED_EVENT, onPrefsChanged)
  }, [customViewIds])

  const openModuleContextMenu = useCallback((e: React.MouseEvent, moduleId: AppShellMode): void => {
    e.preventDefault()
    e.stopPropagation()
    setModuleContextMenu({ x: e.clientX, y: e.clientY, moduleId })
  }, [])

  const hideModuleFromTopbar = useCallback(
    (moduleId: AppShellMode): void => {
      if (visibleModuleCount <= 1) return
      setTopbarModuleVisible(moduleId, false)
      setHiddenModules(readTopbarModuleHiddenSet())
      if (mode === moduleId) {
        setAppMode(resolveVisibleAppShellMode(moduleId, [], modeOrder, readTopbarModuleHiddenSet()))
      }
      setModuleContextMenu(null)
    },
    [mode, modeOrder, setAppMode, visibleModuleCount]
  )

  const moduleContextMenuItems = useMemo((): ContextMenuItem[] => {
    if (!moduleContextMenu) return []
    const { moduleId } = moduleContextMenu
    const items: ContextMenuItem[] = [
      {
        id: 'hide-module',
        label: t('topbar.moduleHide'),
        disabled: visibleModuleCount <= 1,
        onSelect: (): void => hideModuleFromTopbar(moduleId)
      }
    ]
    if (moduleId === 'bookings') {
      items.push({
        id: 'bookings-settings',
        label: t('topbar.moduleSettings'),
        onSelect: (): void => {
          setModuleContextMenu(null)
          requestOpenAccountSettings({ tab: 'bookings' })
        }
      })
    }
    return items
  }, [hideModuleFromTopbar, moduleContextMenu, t, visibleModuleCount])

  const customViewContextMenuItems = useMemo((): ContextMenuItem[] => {
    if (!customViewContextMenu) return []
    const { viewId } = customViewContextMenu
    const view = customViews.find((v) => v.id === viewId)
    const editingThis =
      activeCustomViewId === viewId && customViewEditMode && mode === 'customView'
    const canRevert = customViewEditSnapshot?.viewId === viewId

    return [
      {
        id: 'toggle-edit-custom-view',
        label: editingThis ? t('customView.menuEndEdit') : t('customView.menuEditLayout'),
        icon: Pencil,
        onSelect: (): void => {
          toggleCustomViewEditMode(viewId)
          setCustomViewContextMenu(null)
        }
      },
      {
        id: 'choose-layout-custom-view',
        label: t('layoutStudio.chooseLayout'),
        icon: LayoutGrid,
        onSelect: (): void => {
          openCustomViewTemplatePicker(viewId)
          setCustomViewContextMenu(null)
        }
      },
      {
        id: 'rename-custom-view',
        label: t('customView.menuRename'),
        icon: TextCursor,
        onSelect: (): void => {
          setCustomViewContextMenu(null)
          void (async (): Promise<void> => {
            const next = await showAppPrompt(t('customView.renamePrompt'), {
              title: t('customView.menuRename'),
              defaultValue: view?.name ?? '',
              placeholder: t('customView.wizard.namePlaceholder')
            })
            if (next?.trim()) renameCustomView(viewId, next)
          })()
        }
      },
      {
        id: 'icon-custom-view',
        label: t('customView.menuChangeIcon'),
        icon: Image,
        onSelect: (): void => {
          setCustomViewIconPickerId(viewId)
          setCustomViewContextMenu(null)
        }
      },
      {
        id: 'revert-custom-view',
        label: t('customView.revertLayout'),
        icon: RotateCcw,
        disabled: !canRevert,
        onSelect: (): void => {
          revertCustomViewLayout(viewId)
          setCustomViewContextMenu(null)
        }
      },
      { id: 'sep-custom-view', label: '', separator: true },
      {
        id: 'delete-custom-view',
        label: t('customView.delete'),
        icon: Trash2,
        destructive: true,
        onSelect: (): void => {
          if (!window.confirm(t('settings.modulesCustomViewDeleteConfirm', { name: view?.name ?? '' }))) {
            setCustomViewContextMenu(null)
            return
          }
          deleteCustomView(viewId)
          setCustomViewContextMenu(null)
        }
      }
    ]
  }, [
    activeCustomViewId,
    customViewContextMenu,
    customViewEditMode,
    customViewEditSnapshot,
    customViews,
    deleteCustomView,
    mode,
    openCustomViewTemplatePicker,
    renameCustomView,
    revertCustomViewLayout,
    t,
    toggleCustomViewEditMode
  ])

  const onTopbarTabsDragEnd = useCallback(
    (e: DragEndEvent): void => {
      const { active, over } = e
      if (!over || active.id === over.id) return
      const next = reorderVisibleTopbarTabs(
        tabOrder,
        hiddenModules,
        String(active.id),
        String(over.id)
      )
      if (next.every((id, i) => id === tabOrder[i])) return
      setTabOrder(next)
      persistTopbarTabOrder(next, customViewIds)
      setModeOrder(readTopbarModuleOrder())
      const viewOrder = next
        .map((id) => parseTopbarTabCustomViewId(id))
        .filter((id): id is string => id != null)
      reorderCustomViews(viewOrder)
    },
    [customViewIds, hiddenModules, reorderCustomViews, tabOrder]
  )

  const readingOpenMw = useMailWorkspaceLayoutStore((s) => s.readingOpen)
  const calendarOpenMw = useMailWorkspaceLayoutStore((s) => s.calendarOpen)
  const contextOpenCal = useCalendarPanelLayoutStore((s) => s.contextOpen)
  const setContextOpenCal = useCalendarPanelLayoutStore((s) => s.setContextOpen)
  const setContextPlacementCal = useCalendarPanelLayoutStore((s) => s.setContextPlacement)
  const setReadingOpenMw = useMailWorkspaceLayoutStore((s) => s.setReadingOpen)
  const setCalendarOpenMw = useMailWorkspaceLayoutStore((s) => s.setCalendarOpen)
  const setReadingPlacementMw = useMailWorkspaceLayoutStore((s) => s.setReadingPlacement)
  const setCalendarPlacementMw = useMailWorkspaceLayoutStore((s) => s.setCalendarPlacement)

  function onTitlebarDoubleClick(e: React.MouseEvent<HTMLElement>): void {
    if (!framelessTitlebar) return
    const target = e.target as HTMLElement
    if (target.closest('button, input, a, textarea, select, [contenteditable="true"], nav')) return
    void window.mailClient.app.windowToggleMaximize()
  }

  async function handleRefresh(): Promise<void> {
    if (!online) return
    if (refreshing) return
    setRefreshing(true)
    try {
      await refreshNow()
    } finally {
      // Spinner kurz weiterdrehen lassen, damit ein Klick auch sichtbar
      // ist, falls der Server nichts Neues zurueckliefert.
      window.setTimeout(() => setRefreshing(false), 500)
    }
  }

  return (
    <header
      onDoubleClick={onTitlebarDoubleClick}
      className={cn(
        'glass-topbar electron-window-titlebar flex h-12 min-w-0 shrink-0 select-none items-center gap-2 px-2 sm:gap-3 sm:px-3',
        framelessTitlebar && 'pr-0'
      )}
    >
      {framelessTitlebar ? (
        <>
          <AppBrandMark
            className="mr-1 max-w-[8.5rem] shrink-0 pl-0.5 sm:max-w-[10rem]"
            iconClassName="h-5 w-5"
            nameClassName="text-xs font-semibold sm:text-sm"
          />
          <span className="mr-0.5 h-5 w-px shrink-0 bg-border" aria-hidden />
        </>
      ) : null}
      {!online && (
        <span
          className="flex shrink-0 items-center gap-1 rounded-md border border-amber-500/35 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:text-amber-300/95"
          title={t('topbar.offlineTitle')}
          role="status"
        >
          <WifiOff className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="hidden sm:inline">{t('topbar.offline')}</span>
        </span>
      )}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onTopbarTabsDragEnd}
      >
        <nav
          ref={navRef}
          className="relative flex h-12 min-h-12 min-w-0 flex-1 items-stretch overflow-hidden py-0"
          aria-label={t('topbar.modesAria')}
        >
          <TopbarTabsOverflowMeasureButton measureRef={overflowMeasureRef} />
          <div
            ref={measureRef}
            aria-hidden
            className="pointer-events-none absolute left-0 top-0 -z-10 flex h-0 overflow-hidden opacity-0"
          >
            {topbarTabEntries.map((entry) => {
              const Icon =
                entry.kind === 'module'
                  ? entry.icon
                  : resolveCustomViewTabIcon(customViewIconIdOrDefault(entry.view.iconId))
              const label = entry.kind === 'module' ? entry.label : entry.view.name
              return (
                <span
                  key={`measure-${entry.tabId}`}
                  className="inline-flex h-12 shrink-0 items-center gap-1.5 whitespace-nowrap px-3 text-xs font-medium"
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="max-w-[8rem] truncate">{label}</span>
                </span>
              )
            })}
          </div>
          <div className="flex min-w-0 flex-1 items-stretch overflow-hidden">
            <SortableContext items={sortableVisibleTabIds} strategy={horizontalListSortingStrategy}>
              <div className="flex min-w-0 flex-1 items-stretch gap-0.5 overflow-hidden pl-0.5 sm:gap-1 sm:pl-1">
                {inlineTabEntries.map((entry) => {
                  if (entry.kind === 'module') {
                    return (
                      <SortableTopbarModeTab
                        key={entry.tabId}
                        id={entry.id}
                        label={entry.label}
                        icon={entry.icon}
                        active={mode === entry.id}
                        onSelect={setAppMode}
                        onContextMenu={openModuleContextMenu}
                        dragAria={t('topbar.moduleDragAria')}
                        dragTitle={t('topbar.moduleDragTitle')}
                      />
                    )
                  }
                  return (
                    <SortableCustomViewTab
                      key={`${entry.tabId}:${customViewIconIdOrDefault(entry.view.iconId)}`}
                      id={entry.tabId}
                      name={entry.view.name}
                      iconId={customViewIconIdOrDefault(entry.view.iconId)}
                      active={mode === 'customView' && activeCustomViewId === entry.view.id}
                      onSelect={(): void => setActiveCustomView(entry.view.id)}
                      onContextMenu={(e): void => {
                        e.preventDefault()
                        setCustomViewContextMenu({
                          x: e.clientX,
                          y: e.clientY,
                          viewId: entry.view.id
                        })
                      }}
                      dragAria={t('topbar.moduleDragAria')}
                      dragTitle={t('topbar.moduleDragTitle')}
                    />
                  )
                })}
              </div>
            </SortableContext>
            {showOverflow ? (
              <TopbarTabsOverflowMenu
                entries={overflowTabEntries}
                onSelectModule={setAppMode}
                onSelectCustomView={setActiveCustomView}
                onModuleContextMenu={openModuleContextMenu}
                onCustomViewContextMenu={(e, viewId): void => {
                  e.preventDefault()
                  setCustomViewContextMenu({ x: e.clientX, y: e.clientY, viewId })
                }}
              />
            ) : null}
          </div>
          <button
            ref={createBtnRef}
            type="button"
            onClick={openCustomViewWizard}
            className="inline-flex h-12 shrink-0 items-center gap-1 rounded-md px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground"
            title={t('topbar.createViewTitle')}
            aria-label={t('topbar.createViewAria')}
          >
            <Plus className="h-4 w-4 shrink-0" aria-hidden />
            <span className="hidden sm:inline">{t('topbar.createView')}</span>
          </button>
        </nav>
      </DndContext>

      {moduleContextMenu ? (
        <ContextMenu
          x={moduleContextMenu.x}
          y={moduleContextMenu.y}
          items={moduleContextMenuItems}
          onClose={(): void => setModuleContextMenu(null)}
        />
      ) : null}

      {customViewContextMenu ? (
        <ContextMenu
          x={customViewContextMenu.x}
          y={customViewContextMenu.y}
          items={customViewContextMenuItems}
          onClose={(): void => setCustomViewContextMenu(null)}
        />
      ) : null}

      {customViewIconPickerId ? (
        <CustomViewIconPickerDialog
          open
          viewId={customViewIconPickerId}
          viewName={
            customViews.find((v) => v.id === customViewIconPickerId)?.name ?? ''
          }
          iconId={customViewIconIdOrDefault(
            customViews.find((v) => v.id === customViewIconPickerId)?.iconId
          )}
          onIconChange={(viewId, iconId): void => {
            useCustomViewsStore.getState().setViewIcon(viewId, iconId)
          }}
          onClose={(): void => setCustomViewIconPickerId(null)}
        />
      ) : null}

      <div className="min-w-[9rem] max-w-[28rem] flex-[2] basis-0 px-0.5 sm:min-w-[11rem] sm:px-1">
        <TopbarGlobalSearch />
      </div>

      <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
        {mode === 'mail' && !readingOpenMw ? (
          <button
            type="button"
            title={t('topbar.readingPaneShowTitle')}
            onClick={(): void => {
              setReadingOpenMw(true)
              setReadingPlacementMw('dock')
            }}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-dashed border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            aria-label={t('topbar.readingPaneShowAria')}
          >
            <BookOpen className="h-4 w-4" />
          </button>
        ) : null}
        {mode === 'mail' && !calendarOpenMw ? (
          <button
            type="button"
            title={t('topbar.calendarPaneShowTitle')}
            onClick={(): void => {
              setCalendarOpenMw(true)
              setCalendarPlacementMw('dock')
            }}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-dashed border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            aria-label={t('topbar.calendarPaneShowAria')}
          >
            <Calendar className="h-4 w-4" />
          </button>
        ) : null}
        {mode === 'calendar' && !contextOpenCal ? (
          <button
            type="button"
            title={t('topbar.contextSidebarShowTitle')}
            onClick={(): void => {
              setContextOpenCal(true)
              setContextPlacementCal('dock')
            }}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-dashed border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            aria-label={t('topbar.contextSidebarShowAria')}
          >
            <LayoutDashboard className="h-4 w-4" />
          </button>
        ) : null}

        <button
          type="button"
          disabled={!online || refreshing}
          onClick={(): void => void handleRefresh()}
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground',
            (!online || refreshing) && 'cursor-not-allowed opacity-45 hover:bg-transparent hover:text-muted-foreground'
          )}
          aria-label={online ? t('topbar.refreshAria') : t('topbar.refreshOfflineAria')}
          title={online ? t('topbar.refreshTitle') : t('topbar.refreshOfflineTitle')}
        >
          <RefreshCw
            className={cn(
              'h-4 w-4',
              (refreshing || anyAccountSyncing) && 'animate-spin text-foreground'
            )}
          />
        </button>

        <ThemeToggle />

        <span className="mx-1 h-5 w-px bg-border" aria-hidden />

        <TopbarGlobalCreateSplit
          mode={mode}
          accounts={accounts}
          setAppMode={setAppMode}
          onOpenAccountDialog={onOpenAccountDialog}
          openFloatingNew={openFloatingNew}
        />

        <button
          type="button"
          onClick={onOpenAccountDialog}
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          aria-label={t('topbar.settingsAria')}
          title={t('topbar.settingsTitle')}
        >
          <Settings className="h-4 w-4" />
        </button>

        <WindowTitlebarControls />
      </div>
    </header>
  )
}

function ThemeToggle(): JSX.Element {
  const { t } = useTranslation()
  const mode = useThemeStore((s) => s.mode)
  const effective = useThemeStore((s) => s.effective)
  const accent = useThemeStore((s) => s.accent)
  const darkPalette = useThemeStore((s) => s.darkPalette)
  const setMode = useThemeStore((s) => s.setMode)
  const setAccent = useThemeStore((s) => s.setAccent)
  const applyDarkPaletteVariant = useThemeStore((s) => s.applyDarkPaletteVariant)
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({})

  const themeModeOptions = useMemo(
    () =>
      [
        { id: 'light' as const, label: t('topbar.themeLight'), icon: Sun },
        { id: 'dark' as const, label: t('topbar.themeDark'), icon: Moon },
        { id: 'system' as const, label: t('topbar.themeSystem'), icon: Monitor }
      ] satisfies Array<{
        id: ThemeMode
        label: string
        icon: React.ComponentType<{ className?: string }>
      }>,
    [t]
  )

  const darkPaletteOptions = useMemo(
    () =>
      [
        { id: 'graphite' as const, label: t('topbar.paletteGraphite') },
        { id: 'default' as const, label: t('topbar.paletteDefault') },
        { id: 'midnight' as const, label: 'Midnight' },
        { id: 'nord' as const, label: 'Nord' }
      ] satisfies Array<{ id: DarkPalette; label: string }>,
    [t]
  )

  const updatePanelPosition = useCallback((): void => {
    if (!buttonRef.current) return
    const r = buttonRef.current.getBoundingClientRect()
    const width = 224
    const left = Math.max(8, Math.min(window.innerWidth - width - 8, r.right - width))
    setPanelStyle({
      position: 'fixed',
      top: r.bottom + 4,
      left,
      width,
      zIndex: 210
    })
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    updatePanelPosition()
  }, [open, updatePanelPosition])

  useEffect(() => {
    if (!open) return
    updatePanelPosition()
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') setOpen(false)
    }
    function onDown(e: MouseEvent): void {
      const target = e.target as Node
      if (buttonRef.current?.contains(target)) return
      if (panelRef.current?.contains(target)) return
      setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onDown)
    window.addEventListener('resize', updatePanelPosition)
    window.addEventListener('scroll', updatePanelPosition, true)
    return (): void => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('resize', updatePanelPosition)
      window.removeEventListener('scroll', updatePanelPosition, true)
    }
  }, [open, updatePanelPosition])

  const Icon = effective === 'dark' ? Moon : Sun
  const themeButtonTitle =
    mode === 'system'
      ? t('topbar.themeTitleSystem', {
          effective: t(effective === 'dark' ? 'topbar.themeDark' : 'topbar.themeLight')
        })
      : t('topbar.themeTitleExplicit', {
          mode: t(mode === 'dark' ? 'topbar.themeDark' : 'topbar.themeLight')
        })

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={(): void => setOpen((v) => !v)}
        className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        aria-label={t('topbar.themeToggleAria')}
        aria-expanded={open}
        aria-haspopup="menu"
        title={themeButtonTitle}
      >
        <Icon className="h-4 w-4" />
      </button>
      {open &&
        createPortal(
          <div
            ref={panelRef}
            role="menu"
            aria-label={t('topbar.appearance')}
            className="chronell-acrylic-popover glass-animate-in overflow-hidden py-1 text-popover-foreground"
            style={panelStyle}
          >
          <div className="px-2.5 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t('topbar.appearance')}
          </div>
          {themeModeOptions.map(({ id, label, icon: OptIcon }) => {
            const selected = mode === id
            return (
              <button
                key={id}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                onClick={(): void => {
                  setMode(id)
                }}
                className={cn(
                  'flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-secondary/60',
                  selected ? 'text-foreground' : 'text-muted-foreground'
                )}
              >
                <OptIcon className="h-3.5 w-3.5 shrink-0" />
                <span className="flex-1">{label}</span>
                {selected && <Check className="h-3.5 w-3.5 text-primary" />}
              </button>
            )
          })}

          <div className="my-1 h-px bg-border" />

          {effective === 'dark' && (
            <>
              <div className="px-2.5 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t('topbar.darkVariant')}
              </div>
              {darkPaletteOptions.map(({ id, label }) => {
                const selected = darkPalette === id
                return (
                  <button
                    key={id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={selected}
                    onClick={(): void => applyDarkPaletteVariant(id)}
                    className={cn(
                      'flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-secondary/60',
                      selected ? 'text-foreground' : 'text-muted-foreground'
                    )}
                  >
                    <span className="flex-1">{label}</span>
                    {selected && <Check className="h-3.5 w-3.5 text-primary" />}
                  </button>
                )
              })}
              <div className="my-1 h-px bg-border" />
            </>
          )}

          <div className="px-2.5 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t('topbar.accent')}
          </div>
          <div className="grid grid-cols-4 gap-1.5 px-2.5 py-1.5">
            {ACCENT_LIST.map(({ id }) => (
              <AccentSwatch
                key={id}
                id={id}
                label={t(`topbar.accentNames.${id}`)}
                selected={accent === id}
                onClick={(): void => setAccent(id)}
              />
            ))}
          </div>
          </div>,
          document.body
        )}
    </div>
  )
}

function AccentSwatch({
  id,
  label,
  selected,
  onClick
}: {
  id: AccentName
  label: string
  selected: boolean
  onClick: () => void
}): JSX.Element {
  const { t } = useTranslation()
  const style: React.CSSProperties = { backgroundColor: `hsl(${accentHsl(id)})` }
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={t('topbar.accentSwatchAria', { name: label })}
      aria-pressed={selected}
      className={cn(
        'relative flex h-7 items-center justify-center rounded-md transition-transform hover:scale-105',
        selected
          ? 'ring-2 ring-offset-2 ring-offset-popover'
          : 'ring-1 ring-inset ring-black/10 hover:ring-2'
      )}
      style={{
        ...style,
        ...(selected ? { '--tw-ring-color': `hsl(${accentHsl(id)})` } : {})
      } as React.CSSProperties}
    >
      {selected && <Check className="h-3.5 w-3.5 text-white drop-shadow" />}
    </button>
  )
}

