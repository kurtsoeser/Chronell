import { ChevronDown, MoreHorizontal } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import type { AppShellMode } from '@/stores/app-mode'

export type TopbarOverflowEntry =
  | {
      kind: 'module'
      tabId: string
      id: AppShellMode
      label: string
      icon: React.ComponentType<{ className?: string }>
      active: boolean
    }
  | {
      kind: 'customView'
      tabId: string
      name: string
      icon: React.ComponentType<{ className?: string }>
      active: boolean
      viewId: string
    }

interface Props {
  entries: TopbarOverflowEntry[]
  onSelectModule: (mode: AppShellMode) => void
  onSelectCustomView: (viewId: string) => void
  onModuleContextMenu: (e: React.MouseEvent, moduleId: AppShellMode) => void
  onCustomViewContextMenu: (e: React.MouseEvent, viewId: string) => void
}

export function TopbarTabsOverflowMenu({
  entries,
  onSelectModule,
  onSelectCustomView,
  onModuleContextMenu,
  onCustomViewContextMenu
}: Props): JSX.Element | null {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({})

  const hasActive = entries.some((e) => e.active)

  const updateMenuPosition = useCallback((): void => {
    if (!wrapRef.current) return
    const r = wrapRef.current.getBoundingClientRect()
    const width = 240
    const left = Math.max(8, Math.min(window.innerWidth - width - 8, r.left))
    setMenuStyle({
      position: 'fixed',
      top: r.bottom + 4,
      left,
      width,
      maxHeight: 'min(70vh, 20rem)',
      zIndex: 210
    })
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    updateMenuPosition()
  }, [open, updateMenuPosition])

  useEffect(() => {
    if (!open) return
    updateMenuPosition()
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') setOpen(false)
    }
    function onDown(e: MouseEvent): void {
      const target = e.target as Node
      if (wrapRef.current?.contains(target)) return
      if (menuRef.current?.contains(target)) return
      setOpen(false)
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
  }, [open, updateMenuPosition])

  if (entries.length === 0) return null

  return (
    <div ref={wrapRef} className="relative flex shrink-0 items-stretch">
      <button
        type="button"
        onClick={(): void => setOpen((o) => !o)}
        className={cn(
          'relative inline-flex h-12 shrink-0 items-center gap-1 rounded-md px-2.5 text-xs font-medium transition-colors sm:px-3',
          hasActive
            ? 'text-foreground'
            : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
        )}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t('topbar.tabsOverflowAria', { count: entries.length })}
        title={t('topbar.tabsOverflowTitle', { count: entries.length })}
      >
        <MoreHorizontal className="h-4 w-4 shrink-0 sm:hidden" aria-hidden />
        <span className="hidden sm:inline">{t('topbar.tabsOverflow')}</span>
        <ChevronDown className="hidden h-3.5 w-3.5 shrink-0 opacity-70 sm:block" aria-hidden />
        {hasActive ? (
          <span
            aria-hidden
            className="absolute inset-x-1 -bottom-px h-0.5 rounded-t bg-primary opacity-100"
          />
        ) : null}
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label={t('topbar.tabsOverflowMenuAria')}
            className="chronell-acrylic-popover glass-animate-in overflow-y-auto overscroll-contain py-1 text-popover-foreground"
            style={menuStyle}
          >
            {entries.map((entry) => {
              const Icon = entry.icon
              if (entry.kind === 'module') {
                return (
                  <button
                    key={entry.tabId}
                    type="button"
                    role="menuitem"
                    onClick={(): void => {
                      setOpen(false)
                      onSelectModule(entry.id)
                    }}
                    onContextMenu={(e): void => onModuleContextMenu(e, entry.id)}
                    className={cn(
                      'flex w-full items-center gap-2 px-2.5 py-2 text-left text-xs transition-colors hover:bg-secondary/60',
                      entry.active ? 'font-medium text-foreground' : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{entry.label}</span>
                  </button>
                )
              }
              return (
                <button
                  key={entry.tabId}
                  type="button"
                  role="menuitem"
                  onClick={(): void => {
                    setOpen(false)
                    onSelectCustomView(entry.viewId)
                  }}
                  onContextMenu={(e): void => {
                    e.preventDefault()
                    onCustomViewContextMenu(e, entry.viewId)
                  }}
                  className={cn(
                    'flex w-full items-center gap-2 px-2.5 py-2 text-left text-xs transition-colors hover:bg-secondary/60',
                    entry.active ? 'font-medium text-foreground' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{entry.name}</span>
                </button>
              )
            })}
          </div>,
          document.body
        )}
    </div>
  )
}
