import { PanelLeftClose } from 'lucide-react'
import type { TFunction } from 'i18next'
import type { CalendarGraphCalendarRow } from '@shared/types'
import {
  CALENDAR_COLOR_MENU_PRESET_IDS,
  CALENDAR_EXTENDED_COLOR_PRESET_IDS,
  calendarMenuPresetDisplayHex,
  resolveCalendarMenuPresetId
} from '@shared/graph-calendar-colors'
import type { ContextMenuItem } from '@/components/ContextMenu'
import { SIDEBAR_DEFAULT_CAL_ID } from '@/app/calendar/calendar-shell-storage'

export function buildCalendarFolderColorContextMenuItems(args: {
  accountId: string
  cal: CalendarGraphCalendarRow
  t: TFunction
  hideCalendarFromSidebar: (accountId: string, graphCalendarId: string) => void
  reloadCalendarsForAccount: (
    accountId: string,
    opts?: { forceRefresh?: boolean }
  ) => Promise<void>
  reloadVisibleRange: (opts?: { forceRefresh?: boolean; silent?: boolean }) => void
  setError: (msg: string | null) => void
}): ContextMenuItem[] {
  const { accountId, cal, t, hideCalendarFromSidebar, reloadCalendarsForAccount, reloadVisibleRange, setError } =
    args

  const tail: ContextMenuItem[] = [
    { id: 'sep-cal-sidebar', label: '', separator: true },
    {
      id: 'hide-from-sidebar',
      label: t('calendar.shell.contextHideFromSidebar'),
      icon: PanelLeftClose,
      disabled: cal.id === SIDEBAR_DEFAULT_CAL_ID,
      onSelect: (): void => {
        if (cal.id === SIDEBAR_DEFAULT_CAL_ID) return
        hideCalendarFromSidebar(accountId, cal.id)
      }
    }
  ]
  const canEditRemote = cal.canEdit !== false && cal.calendarKind !== 'm365Group'
  const curPreset = resolveCalendarMenuPresetId(cal)
  const hexFallback = '#94a3b8'
  const colorSubmenu = CALENDAR_COLOR_MENU_PRESET_IDS.flatMap((presetId) => {
    const items: Array<{
      id: string
      label: string
      separator?: boolean
      swatchAuto?: boolean
      swatchHex?: string
      selected?: boolean
      onSelect?: () => void
    }> = []
    if (presetId === CALENDAR_EXTENDED_COLOR_PRESET_IDS[0]) {
      items.push({ id: 'cal-col-sep-ext', label: '', separator: true })
    }
    const solidHex =
      presetId === 'auto' ? undefined : (calendarMenuPresetDisplayHex(presetId) ?? hexFallback)
    items.push({
      id: `cal-col-${presetId}`,
      label: t(`calendar.graphColor.${presetId}` as 'calendar.graphColor.auto'),
      swatchAuto: presetId === 'auto',
      swatchHex: presetId === 'auto' ? undefined : solidHex,
      selected: curPreset !== null && presetId === curPreset,
      onSelect: (): void => {
        void (async (): Promise<void> => {
          try {
            setError(null)
            await window.mailClient.calendar.patchCalendarColor({
              accountId,
              graphCalendarId: cal.id,
              color: presetId
            })
            await reloadCalendarsForAccount(accountId, { forceRefresh: canEditRemote })
            void reloadVisibleRange()
          } catch (err) {
            setError(err instanceof Error ? err.message : String(err))
          }
        })()
      }
    })
    return items
  })
  return [
    {
      id: 'cal-color-submenu',
      label: canEditRemote
        ? t('calendar.shell.colorMicrosoftLabel')
        : t('calendar.shell.colorLocalLabel'),
      submenu: colorSubmenu
    },
    ...tail
  ]
}
