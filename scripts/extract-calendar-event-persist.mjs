import fs from 'node:fs'
import path from 'node:path'

const filePath = path.resolve(import.meta.dirname, '../src/renderer/src/app/calendar/CalendarShell.tsx')
const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/)
const start = lines.findIndex((l) => l.includes('const handleGraphEventChange = useCallback'))
const end = lines.findIndex((l, i) => i > start && l.trim().startsWith('/** Hex aus Sidebar-Kalenderliste'))
if (start < 0 || end < 0) {
  console.error('markers not found', start, end)
  process.exit(1)
}

const hook = `  const { handleGraphEventChange } = useCalendarShellEventPersist({
    calendarRef,
    lastRangeRef,
    fcTimeZone,
    accountColorById,
    cloudTaskByKeyRef,
    cloudTaskAllItemsRef,
    cloudTaskPlannedByKeyRef,
    cloudTaskPersistInFlightRef,
    graphCalendarPersistInFlightRef,
    graphCalendarReconcilingRef,
    skipCalendarReloadUntilRef,
    timelineReloadRef,
    taskAccounts,
    defaultGraphCalendarIdByAccount,
    setError,
    setMailTodoItems,
    setTodoSideListRefreshKey,
    setEvents,
    setPreviewCalendarEvent,
    setGraphCalendarSourceRev,
    setPreviewCloudTask,
    setPreviewCloudTaskPlannedFromTimeline,
    commitCloudTaskLayer,
    loadUserNotesForRange,
    setTodoScheduleForMessage,
    t
  })`

lines.splice(start, end - start, hook)
fs.writeFileSync(filePath, lines.join('\n'))
console.log(`replaced lines ${start + 1}..${end} (${end - start} lines removed)`)
