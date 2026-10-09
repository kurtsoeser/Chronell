import { BookOpen, LayoutPanelLeft, ListTree } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  moduleColumnHeaderIconGlyphClass,
  moduleColumnHeaderToolbarToggleClass
} from '@/components/ModuleColumnHeader'

export function CalendarPosteingangToolbarButton(props: {
  open: boolean
  onOpenChange: (next: boolean) => void
  buttonClassName?: (pressed: boolean) => string
}): JSX.Element {
  const { open, onOpenChange, buttonClassName } = props
  const { t } = useTranslation()
  return (
    <button
      type="button"
      title={open ? t('calendar.posteingangUi.toggleInboxHide') : t('calendar.posteingangUi.toggleInboxShow')}
      aria-pressed={open}
      onClick={(): void => onOpenChange(!open)}
      className={
        buttonClassName ? buttonClassName(open) : moduleColumnHeaderToolbarToggleClass(open)
      }
    >
      <ListTree className={moduleColumnHeaderIconGlyphClass} />
    </button>
  )
}

export function CalendarContextSidebarToolbarButton(props: {
  open: boolean
  onOpenChange: (next: boolean) => void
  buttonClassName?: (pressed: boolean) => string
}): JSX.Element {
  const { open, onOpenChange, buttonClassName } = props
  const { t } = useTranslation()
  return (
    <button
      type="button"
      title={
        open
          ? t('calendar.posteingangUi.toggleContextHide')
          : t('calendar.posteingangUi.toggleContextShow')
      }
      aria-pressed={open}
      onClick={(): void => onOpenChange(!open)}
      className={
        buttonClassName ? buttonClassName(open) : moduleColumnHeaderToolbarToggleClass(open)
      }
    >
      <LayoutPanelLeft className={moduleColumnHeaderIconGlyphClass} />
    </button>
  )
}

export function CalendarPreviewPaneToolbarButton(props: {
  open: boolean
  onOpenChange: (next: boolean) => void
  /** Vollständige i18n-Keys; Standard: Kalender-Vorschau (Mail/Termin). */
  hideTitleKey?: string
  showTitleKey?: string
  buttonClassName?: (pressed: boolean) => string
}): JSX.Element {
  const { open, onOpenChange, hideTitleKey, showTitleKey, buttonClassName } = props
  const { t } = useTranslation()
  const hideKey = hideTitleKey ?? 'calendar.posteingangUi.togglePreviewHide'
  const showKey = showTitleKey ?? 'calendar.posteingangUi.togglePreviewShow'
  return (
    <button
      type="button"
      title={open ? t(hideKey) : t(showKey)}
      aria-pressed={open}
      onClick={(): void => onOpenChange(!open)}
      className={
        buttonClassName ? buttonClassName(open) : moduleColumnHeaderToolbarToggleClass(open)
      }
    >
      <BookOpen className={moduleColumnHeaderIconGlyphClass} />
    </button>
  )
}
