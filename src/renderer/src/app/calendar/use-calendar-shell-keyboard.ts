import { useEffect, type Dispatch, type RefObject, type SetStateAction } from 'react'
import { startOfMonth } from 'date-fns'
import type FullCalendar from '@fullcalendar/react'
import {
  persistTimeGridSlotMinutes,
  stepTimeGridSlotMinutes,
  type TimeGridSlotMinutes
} from '@/app/calendar/calendar-shell-storage'
import { MULTI_MONTH_YEAR_VIEW_ID } from '@/app/calendar/calendar-fc-multimonth'
import type { CalendarCreateRange } from '@/app/tasks/tasks-calendar-create-range'
import { todayGotoDateDraft } from '@/app/calendar/CalendarShellGotoDateDialog'

export interface UseCalendarShellKeyboardOptions {
  timeGridSlotMinutes: TimeGridSlotMinutes
  setTimeGridSlotMinutes: Dispatch<SetStateAction<TimeGridSlotMinutes>>
  calendarRef: RefObject<FullCalendar | null>
  changeView: (viewId: string) => void
  gotoDateOpen: boolean
  setGotoDateOpen: (open: boolean) => void
  setGotoDateDraft: (draft: string) => void
  calendarEventSearchOpen: boolean
  setCalendarEventSearchOpen: (open: boolean) => void
  schedulingOpen: boolean
  closeSchedulingPanel: () => void
  quickCreate: { anchor: { x: number; y: number }; range: CalendarCreateRange } | null
  dismissQuickCreate: () => void
  setMiniMonth: Dispatch<SetStateAction<Date>>
  scrollCalendarTodayIntoView: () => void
}

/** Ctrl/Cmd+Shift+,/. — Zeitraster feiner/grober. */
export function useCalendarShellTimeGridSlotKeyboard(
  timeGridSlotMinutes: TimeGridSlotMinutes,
  setTimeGridSlotMinutes: Dispatch<SetStateAction<TimeGridSlotMinutes>>
): void {
  useEffect(() => {
    persistTimeGridSlotMinutes(timeGridSlotMinutes)
  }, [timeGridSlotMinutes])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (!(e.ctrlKey || e.metaKey) || !e.shiftKey) return
      if (e.repeat) return
      const el = e.target
      if (el instanceof HTMLElement) {
        if (el.closest('[role="dialog"]')) return
        const tag = el.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable)
          return
      }
      if (e.code === 'Period') {
        e.preventDefault()
        setTimeGridSlotMinutes((m) => stepTimeGridSlotMinutes(m, 'finer'))
        return
      }
      if (e.code === 'Comma') {
        e.preventDefault()
        setTimeGridSlotMinutes((m) => stepTimeGridSlotMinutes(m, 'coarser'))
      }
    }
    window.addEventListener('keydown', onKey, true)
    return (): void => window.removeEventListener('keydown', onKey, true)
  }, [setTimeGridSlotMinutes])
}

/** Navigation, Ansichten, Suche, Escape — Kalender-Haupttastatur. */
export function useCalendarShellNavigationKeyboard(opts: UseCalendarShellKeyboardOptions): void {
  const {
    calendarRef,
    changeView,
    gotoDateOpen,
    setGotoDateOpen,
    setGotoDateDraft,
    calendarEventSearchOpen,
    setCalendarEventSearchOpen,
    schedulingOpen,
    closeSchedulingPanel,
    quickCreate,
    dismissQuickCreate,
    setMiniMonth,
    scrollCalendarTodayIntoView
  } = opts

  useEffect(() => {
    const blockNav = (target: EventTarget | null): boolean => {
      const el = target instanceof HTMLElement ? target : null
      if (!el) return false
      if (el.closest('input, textarea, select, [contenteditable="true"]')) return true
      if (el.closest('[role="dialog"]')) return true
      return false
    }

    const onKey = (e: KeyboardEvent): void => {
      if (e.repeat) return

      if (e.key === 'Escape') {
        if (gotoDateOpen) {
          e.preventDefault()
          setGotoDateOpen(false)
          return
        }
        if (calendarEventSearchOpen) {
          e.preventDefault()
          setCalendarEventSearchOpen(false)
          return
        }
        if (schedulingOpen) {
          e.preventDefault()
          closeSchedulingPanel()
          return
        }
        if (quickCreate) {
          e.preventDefault()
          dismissQuickCreate()
          return
        }
      }

      if (blockNav(e.target)) return

      const api = calendarRef.current?.getApi()
      if (!api) return

      const noMods = !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey

      if (e.altKey && (e.key === 't' || e.key === 'T') && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        e.preventDefault()
        api.today()
        setMiniMonth(startOfMonth(new Date()))
        window.setTimeout((): void => {
          scrollCalendarTodayIntoView()
        }, 0)
        return
      }

      if (noMods && (e.key === 't' || e.key === 'T')) {
        e.preventDefault()
        api.today()
        setMiniMonth(startOfMonth(new Date()))
        return
      }

      if (noMods && (e.key === 'j' || e.key === 'J')) {
        e.preventDefault()
        api.next()
        return
      }

      if (noMods && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        api.prev()
        return
      }

      const isPeriodGoToDate =
        noMods &&
        (e.key === '.' ||
          (e.code === 'Period' && e.location === KeyboardEvent.DOM_KEY_LOCATION_STANDARD))
      if (isPeriodGoToDate) {
        e.preventDefault()
        setGotoDateDraft(todayGotoDateDraft())
        setGotoDateOpen(true)
        return
      }

      if (noMods && e.key === '/') {
        e.preventDefault()
        setCalendarEventSearchOpen(true)
        return
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F') && !e.altKey) {
        e.preventDefault()
        setCalendarEventSearchOpen(true)
        return
      }

      if (e.key === 'd' || e.key === 'D' || e.key === '1') {
        if (!noMods) return
        changeView('timeGridDay')
        e.preventDefault()
      } else if (e.key === 'w' || e.key === 'W' || e.key === '0') {
        if (!noMods) return
        changeView('timeGridWeek')
        e.preventDefault()
      } else if (e.key === 'm' || e.key === 'M') {
        if (!noMods) return
        changeView('dayGridMonth')
        e.preventDefault()
      } else if (e.key === 'y' || e.key === 'Y') {
        if (!noMods) return
        changeView(MULTI_MONTH_YEAR_VIEW_ID)
        e.preventDefault()
      } else if (e.key === 'l' || e.key === 'L') {
        if (!noMods) return
        changeView('listWeek')
        e.preventDefault()
      } else if (/^[2-9]$/.test(e.key)) {
        if (!noMods) return
        changeView(`timeGrid${e.key}Day`)
        e.preventDefault()
      }
    }
    window.addEventListener('keydown', onKey)
    return (): void => window.removeEventListener('keydown', onKey)
  }, [
    calendarRef,
    changeView,
    gotoDateOpen,
    calendarEventSearchOpen,
    scrollCalendarTodayIntoView,
    schedulingOpen,
    closeSchedulingPanel,
    quickCreate,
    dismissQuickCreate,
    setGotoDateOpen,
    setGotoDateDraft,
    setCalendarEventSearchOpen,
    setMiniMonth
  ])
}

export function useCalendarShellKeyboard(opts: UseCalendarShellKeyboardOptions): void {
  useCalendarShellTimeGridSlotKeyboard(opts.timeGridSlotMinutes, opts.setTimeGridSlotMinutes)
  useCalendarShellNavigationKeyboard(opts)
}
