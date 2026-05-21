import { PanelRightClose, PanelRightOpen, BookOpen } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  moduleColumnHeaderIconGlyphClass,
  moduleColumnHeaderToolbarToggleClass
} from '@/components/ModuleColumnHeader'

export function CalendarPosteingangToolbarButton(props: {
  open: boolean
  onOpenChange: (next: boolean) => void
}): JSX.Element {
  const { open, onOpenChange } = props
  const { t } = useTranslation()
  return (
    <button
      type="button"
      title={open ? t('calendar.posteingangUi.toggleInboxHide') : t('calendar.posteingangUi.toggleInboxShow')}
      aria-pressed={open}
      onClick={(): void => onOpenChange(!open)}
      className={moduleColumnHeaderToolbarToggleClass(open)}
    >
      {open ? (
        <PanelRightClose className={moduleColumnHeaderIconGlyphClass} />
      ) : (
        <PanelRightOpen className={moduleColumnHeaderIconGlyphClass} />
      )}
    </button>
  )
}

export function CalendarPreviewPaneToolbarButton(props: {
  open: boolean
  onOpenChange: (next: boolean) => void
  /** Vollständige i18n-Keys; Standard: Kalender-Vorschau (Mail/Termin). */
  hideTitleKey?: string
  showTitleKey?: string
}): JSX.Element {
  const { open, onOpenChange, hideTitleKey, showTitleKey } = props
  const { t } = useTranslation()
  const hideKey = hideTitleKey ?? 'calendar.posteingangUi.togglePreviewHide'
  const showKey = showTitleKey ?? 'calendar.posteingangUi.togglePreviewShow'
  return (
    <button
      type="button"
      title={open ? t(hideKey) : t(showKey)}
      aria-pressed={open}
      onClick={(): void => onOpenChange(!open)}
      className={moduleColumnHeaderToolbarToggleClass(open)}
    >
      <BookOpen className={moduleColumnHeaderIconGlyphClass} />
    </button>
  )
}
