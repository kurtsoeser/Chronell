/**
 * Wire useCalendarShellGraphEvents into CalendarShell.tsx (remove duplicated graph-event logic).
 */
import fs from 'node:fs'
import path from 'node:path'

const filePath = path.resolve(import.meta.dirname, '../src/renderer/src/app/calendar/CalendarShell.tsx')
let lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/)

// 1) Add import after use-calendar-shell-event-persist import
const eventPersistImport = lines.findIndex((l) =>
  l.includes("from '@/app/calendar/use-calendar-shell-event-persist'")
)
if (eventPersistImport < 0) throw new Error('event persist import not found')
if (!lines.some((l) => l.includes('use-calendar-shell-graph-events'))) {
  lines.splice(
    eventPersistImport,
    0,
    "import { useCalendarShellGraphEvents } from '@/app/calendar/use-calendar-shell-graph-events'"
  )
}

// 2) Remove early events/loading/error state (keep todoSideListRefreshKey block)
const eventsStateStart = lines.findIndex((l) => l.includes('const [events, setEvents]'))
const todoRefreshLine = lines.findIndex((l) => l.includes('const [todoSideListRefreshKey'))
if (eventsStateStart < 0 || todoRefreshLine < 0) throw new Error('state markers not found')
lines.splice(eventsStateStart, todoRefreshLine - eventsStateStart)

// 3) Remove reloadCalendarEventsOnlyRef declaration
const reloadRefStart = lines.findIndex((l) => l.includes('const reloadCalendarEventsOnlyRef = useRef'))
const timelineLoadingLine = lines.findIndex((l) => l.includes('const [timelineLoading, setTimelineLoading]'))
if (reloadRefStart >= 0 && timelineLoadingLine > reloadRefStart) {
  lines.splice(reloadRefStart, timelineLoadingLine - reloadRefStart)
}

// 4) Remove reminder effect (re-insert after hook)
const reminderStart = lines.findIndex(
  (l) => l.includes('void runCalendarEventReminders(eventsRef.current')
)
let reminderBlock = []
if (reminderStart >= 0) {
  const reminderEffectStart = lines.findIndex(
    (l, i) => i < reminderStart && l.trim() === 'useEffect(() => {',
    reminderStart
  )
  // find useEffect before runCalendarEventReminders
  let effectStart = reminderStart
  while (effectStart > 0 && !lines[effectStart].trim().startsWith('useEffect(() => {')) effectStart--
  while (effectStart > 0 && !lines[effectStart - 1].includes('useEffect(() => {')) {
    if (lines[effectStart].trim().startsWith('useEffect(() => {')) break
    effectStart--
  }
  effectStart = lines.findIndex((l, i) => i <= reminderStart && l.trim() === 'useEffect(() => {')
  const effectEnd = lines.findIndex((l, i) => i > effectStart && l.trim() === '}, [events.length])')
  if (effectStart >= 0 && effectEnd > effectStart) {
    reminderBlock = lines.slice(effectStart, effectEnd + 1)
    lines.splice(effectStart, effectEnd - effectStart + 1)
  }
}

// 5) Insert hook after loadCloudTasksForRangeRef assignment
const hookAnchor = lines.findIndex((l) => l.includes('loadCloudTasksForRangeRef.current = loadCloudTasksForRange'))
if (hookAnchor < 0) throw new Error('hook anchor not found')

const hookCall = `
  const {
    events,
    setEvents,
    eventsRef,
    graphCalendarSourceRev,
    setGraphCalendarSourceRev,
    loading,
    error,
    setError,
    loadRange,
    reloadVisibleRange,
    reloadCalendarEventsOnly,
    reloadCalendarEventsOnlyRef,
    applyOptimisticGraphCalendarEvent,
    defaultGraphCalendarIdByAccount,
    graphFcEventsForFc
  } = useCalendarShellGraphEvents({
    calendarRef,
    lastRangeRef,
    calendarLinkedAccounts,
    calendarsByAccount,
    hiddenCalendarKeys,
    sidebarHiddenCalendarKeys,
    activeViewId,
    calendarEventSearchQuery,
    graphCalendarPersistInFlightRef,
    skipCalendarReloadUntilRef,
    graphCalendarReconcilingRef,
    mailTodoOverlayRef,
    cloudTaskOverlayRef,
    userNoteOverlayRef,
    loadMailTodosForRange,
    loadCloudTasksForRange,
    loadUserNotesForRange
  })
`.trimEnd()

if (!lines.some((l) => l.includes('useCalendarShellGraphEvents({'))) {
  lines.splice(hookAnchor + 1, 0, hookCall)
  if (reminderBlock.length > 0) {
    lines.splice(hookAnchor + 2, 0, ...reminderBlock)
  }
}

// 6) Remove loadRange through reloadCalendarEventsOnlyRef assignment
const loadRangeStart = lines.findIndex((l) => l.includes('const loadRange = useCallback'))
const applyOptimisticStart = lines.findIndex((l) =>
  l.includes('const applyOptimisticGraphCalendarEvent = useCallback')
)
if (loadRangeStart >= 0 && applyOptimisticStart > loadRangeStart) {
  lines.splice(loadRangeStart, applyOptimisticStart - loadRangeStart)
}

// 7) Remove applyOptimisticGraphCalendarEvent block
const applyEnd = lines.findIndex(
  (l, i) => i > applyOptimisticStart && l.trim() === '}, [])'
)
const handleSavedStart = lines.findIndex((l) => l.includes('const handleCalendarEventSaved = useCallback'))
if (applyOptimisticStart >= 0 && handleSavedStart > applyOptimisticStart) {
  lines.splice(applyOptimisticStart, handleSavedStart - applyOptimisticStart)
}

// 8) Remove hidden-calendar reload effect
const visEffectStart = lines.findIndex((l) =>
  l.includes('/** Ein-/Ausblenden in der Sidebar: `includeCalendars`')
)
const scheduleMailsLine = lines.findIndex((l) => l.includes('const scheduleMailsOnCalendar = useCallback'))
if (visEffectStart >= 0 && scheduleMailsLine > visEffectStart) {
  lines.splice(visEffectStart, scheduleMailsLine - visEffectStart)
}

// 9) Remove defaultGraphCalendarIdByAccount through graphFcEventsForFc (before cloudTaskFcEventsRef)
const defaultGraphStart = lines.findIndex((l) =>
  l.includes('const defaultGraphCalendarIdByAccount = useMemo')
)
const cloudTaskFcRef = lines.findIndex((l) => l.includes('const cloudTaskFcEventsRef = useRef'))
if (defaultGraphStart >= 0 && cloudTaskFcRef > defaultGraphStart) {
  lines.splice(defaultGraphStart, cloudTaskFcRef - defaultGraphStart)
}

// 10) Remove graphFcEventsDisplayed and graphFcEventsForFc memos (keep filterCalendarSearchEvents)
const graphDisplayedStart = lines.findIndex((l) =>
  l.includes('const graphFcEventsDisplayed = useMemo')
)
const mailTodoDisplayedStart = lines.findIndex((l) =>
  l.includes('const mailTodoFcEventsDisplayed = useMemo')
)
if (graphDisplayedStart >= 0 && mailTodoDisplayedStart > graphDisplayedStart) {
  lines.splice(graphDisplayedStart, mailTodoDisplayedStart - graphDisplayedStart)
}

// 11) Remove onCalendarChanged effect for graph
const calChangedEffect = lines.findIndex((l) =>
  l.includes('window.mailClient.events.onCalendarChanged(() => {')
)
const datesSetCleanup = lines.findIndex(
  (l, i) => i > calChangedEffect && l.trim() === '}, [reloadCalendarEventsOnly])'
)
if (calChangedEffect >= 0 && datesSetCleanup > calChangedEffect) {
  lines.splice(calChangedEffect - 1, datesSetCleanup - calChangedEffect + 2)
}

fs.writeFileSync(filePath, lines.join('\n'))
console.log('CalendarShell graph-events wiring updated')
