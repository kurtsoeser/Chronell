import { PanelLeft, PanelLeftClose } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  ModuleColumnHeaderIconButton,
  moduleColumnHeaderIconGlyphClass
} from '@/components/ModuleColumnHeader'

/** Gleicher Toggle wie in der Kalender-Shell: linke Modul-Navigation ein-/ausblenden. */
export function ModuleLeftSidebarToggle(props: {
  collapsed: boolean
  onCollapsedChange: (collapsed: boolean) => void
}): JSX.Element {
  const { collapsed, onCollapsedChange } = props
  const { t } = useTranslation()

  return (
    <ModuleColumnHeaderIconButton
      title={
        collapsed ? t('common.leftSidebarExpand') : t('common.leftSidebarCollapse')
      }
      aria-label={
        collapsed ? t('common.leftSidebarExpand') : t('common.leftSidebarCollapse')
      }
      aria-pressed={!collapsed}
      variant="toolbar"
      pressed={!collapsed}
      onClick={(): void => onCollapsedChange(!collapsed)}
    >
      {collapsed ? (
        <PanelLeft className={moduleColumnHeaderIconGlyphClass} aria-hidden />
      ) : (
        <PanelLeftClose className={moduleColumnHeaderIconGlyphClass} aria-hidden />
      )}
    </ModuleColumnHeaderIconButton>
  )
}
