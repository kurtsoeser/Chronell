import fs from 'node:fs'
import path from 'node:path'

const filePath = path.resolve(import.meta.dirname, '../src/renderer/src/app/calendar/CalendarShell.tsx')
let lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/)

const graphImport = lines.findIndex((l) =>
  l.includes("from '@/app/calendar/use-calendar-shell-graph-events'")
)
if (graphImport < 0) throw new Error('graph events import not found')
if (!lines.some((l) => l.includes('use-calendar-shell-cloud-tasks'))) {
  lines.splice(
    graphImport,
    0,
    "import { useCalendarShellCloudTasks } from '@/app/calendar/use-calendar-shell-cloud-tasks'"
  )
}

// Remove cloud-task state block (keep graph persist refs)
const overlayStart = lines.findIndex((l) => l.includes('const [cloudTaskOverlay, setCloudTaskOverlay]'))
const hiddenStart = lines.findIndex((l) => l.includes('const [hiddenCalendarKeys, setHiddenCalendarKeys]'))
if (overlayStart < 0 || hiddenStart <= overlayStart) throw new Error('cloud task state block not found')
lines.splice(overlayStart, hiddenStart - overlayStart)

// Remove reloadCloudTasksAll .. loadCloudTasksForRangeRef block
const reloadAllStart = lines.findIndex((l) => l.includes('const reloadCloudTasksAll = useCallback'))
const graphHookStart = lines.findIndex((l) => l.includes('} = useCalendarShellGraphEvents({'))
if (reloadAllStart < 0 || graphHookStart <= reloadAllStart) throw new Error('cloud task logic block not found')
const hookCall = `
  const {
    cloudTaskOverlay,
    setCloudTaskOverlay,
    cloudTaskOverlayRef,
    cloudTaskAllItems,
    setCloudTaskAllItems,
    cloudTaskRangeItems,
    setCloudTaskRangeItems,
    cloudTaskPlannedByKey,
    setCloudTaskPlannedByKey,
    cloudTaskAllItemsRef,
    cloudTaskPlannedByKeyRef,
    cloudTaskByKeyRef,
    cloudTaskPersistInFlightRef,
    cloudTaskElByKeyRef,
    reloadCloudTasksAll,
    commitCloudTaskLayer,
    loadCloudTasksForRange,
    loadCloudTasksForRangeRef,
    reloadCloudTasksForAccounts,
    bumpCloudTaskLayerRevision,
    cloudTaskFcEvents,
    syncPreviewCloudTaskOnCalendar
  } = useCalendarShellCloudTasks({
    taskAccounts,
    fcTimeZone,
    accountColorById,
    calendarRef,
    lastRangeRef,
    previewCloudTask
  })
`.trimEnd()
lines.splice(reloadAllStart, graphHookStart - reloadAllStart, hookCall)

// Remove cloudTaskFcEvents useMemo block
const fcStart = lines.findIndex((l) => l.includes('const cloudTaskFcEventsRef = useRef'))
const filterStart = lines.findIndex((l) => l.includes('const filterCalendarSearchEvents = useCallback'))
if (fcStart >= 0 && filterStart > fcStart) {
  lines.splice(fcStart, filterStart - fcStart)
}

// Remove cloud-task effects (onTasksChanged, preview ring, overlay toggle)
const tasksEffectStart = lines.findIndex(
  (l) => l.includes('if (!cloudTaskOverlay) return') && lines[lines.indexOf(l) - 1]?.includes('useEffect(() => {')
)
// find first of three effects after fcEventSources
let effectBlockStart = lines.findIndex((l, i) => {
  if (!l.includes('useEffect(() => {')) return false
  const next = lines[i + 1]?.trim()
  return next === 'if (!cloudTaskOverlay) return'
})
if (effectBlockStart < 0) {
  effectBlockStart = lines.findIndex((l) => l.trim() === 'useEffect(() => {')
  while (effectBlockStart >= 0) {
    if (lines[effectBlockStart + 1]?.includes('if (!cloudTaskOverlay) return')) break
    effectBlockStart = lines.findIndex((l, i) => i > effectBlockStart && l.trim() === 'useEffect(() => {')
  }
}
const miniCalStart = lines.findIndex((l) => l.includes('const applyMiniCalendarDayRange = useCallback'))
if (effectBlockStart >= 0 && miniCalStart > effectBlockStart) {
  // back up to include blank line before applyMini
  let end = miniCalStart
  while (end > effectBlockStart && lines[end - 1]?.trim() === '') end--
  lines.splice(effectBlockStart, end - effectBlockStart)
}

// scheduleCloudTaskFromExternalDrop: replace sig clears with bumpCloudTaskLayerRevision
const scheduleIdx = lines.findIndex((l) => l.includes('const scheduleCloudTaskFromExternalDrop = useCallback'))
if (scheduleIdx >= 0) {
  const block = lines.slice(scheduleIdx, scheduleIdx + 35).join('\n')
  const updated = block
    .replace(
      `        cloudTaskLayerSigRef.current = ''
        cloudTaskFcEventsSigRef.current = ''
        commitCloudTaskLayer(items, planned, start, end)`,
      `        bumpCloudTaskLayerRevision()
        commitCloudTaskLayer(items, planned, start, end)`
    )
    .replace('[fcTimeZone, taskAccounts, commitCloudTaskLayer]', '[fcTimeZone, taskAccounts, commitCloudTaskLayer, bumpCloudTaskLayerRevision]')
  lines.splice(scheduleIdx, 35, ...updated.split('\n'))
}

// savePreviewCloudTask: use syncPreviewCloudTaskOnCalendar
const saveIdx = lines.findIndex((l) => l.includes('const savePreviewCloudTask = useCallback'))
if (saveIdx >= 0) {
  let saveEnd = saveIdx
  while (saveEnd < lines.length && !lines[saveEnd].includes('const calendarPreviewBody = useMemo')) saveEnd++
  const block = lines.slice(saveIdx, saveEnd).join('\n')
  const updated = block
    .replace(
      `        syncFullCalendarCloudTaskEventFromLayer(
          api,
          merged,
          planned ?? undefined,
          fcTimeZone,
          accountColorById
        )`,
      `        syncPreviewCloudTaskOnCalendar(merged, planned ?? undefined)`
    )
    .replace(
      '      accountColorById\n    ]',
      '      syncPreviewCloudTaskOnCalendar\n    ]'
    )
  lines.splice(saveIdx, saveEnd - saveIdx, ...updated.split('\n'))
}

fs.writeFileSync(filePath, lines.join('\n'))
console.log('CalendarShell cloud-tasks wiring updated')
