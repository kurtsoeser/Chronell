import type { PluginDef } from '@fullcalendar/core'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import listPlugin from '@fullcalendar/list'
import multiMonthPlugin from '@fullcalendar/multimonth'
import interactionPlugin from '@fullcalendar/interaction'
import luxonPlugin from '@fullcalendar/luxon'

/** Standard-Plugins ohne Jahres-/Quartals-Raster (eingebettete Mail-ToDo-Kalender). */
export const CALENDAR_FC_CORE_PLUGINS: PluginDef[] = [
  dayGridPlugin,
  timeGridPlugin,
  listPlugin,
  interactionPlugin,
  luxonPlugin
]

/** Vollständiges Plugin-Set für die Kalender-Hauptansicht. */
export const CALENDAR_FC_PLUGINS: PluginDef[] = [...CALENDAR_FC_CORE_PLUGINS, multiMonthPlugin]
