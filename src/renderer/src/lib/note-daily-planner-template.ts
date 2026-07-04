import { addMinutes, format, parse } from 'date-fns'
import type { Locale } from 'date-fns'

export interface DailyPlannerLabels {
  titlePrefix: string
  scheduleDay: string
  scheduleNight: string
  checklist: string
  priority: string
  action: string
  plainList: string
  gridNotes: string
  linedNotes: string
  quadrantNotes: string
}

const TASK_ITEM = (label = ''): string =>
  `<li data-checked="false" data-type="taskItem"><p>${label}</p></li>`

const TASK_LIST = (...items: string[]): string =>
  `<ul data-type="taskList">${items.join('')}</ul>`

function cellP(lines = 1): string {
  return Array.from({ length: lines }, () => '<p><br></p>').join('')
}

function td(content: string, attrs: { bgcolor?: string; className?: string; colspan?: number } = {}): string {
  const parts = [
    attrs.className ? `class="${attrs.className}"` : '',
    attrs.bgcolor ? `bgcolor="${attrs.bgcolor}"` : '',
    attrs.colspan ? `colspan="${attrs.colspan}"` : ''
  ].filter(Boolean)
  return `<td${parts.length ? ` ${parts.join(' ')}` : ''}>${content}</td>`
}

function timeSlots(minTime: string, maxTime: string, stepMinutes: number): string[] {
  const start = parse(minTime.slice(0, 5), 'HH:mm', new Date())
  const end = parse(maxTime.slice(0, 5), 'HH:mm', new Date())
  const step = Math.max(15, stepMinutes)
  const labels: string[] = []
  let cursor = start
  while (cursor < end) {
    labels.push(format(cursor, 'HH:mm'))
    cursor = addMinutes(cursor, step)
  }
  return labels
}

function nightTimeSlots(stepMinutes: number): string[] {
  const step = Math.max(15, stepMinutes)
  const labels: string[] = []
  let cursor = parse('22:00', 'HH:mm', new Date())
  for (let i = 0; i < 24; i++) {
    labels.push(format(cursor, 'HH:mm'))
    cursor = addMinutes(cursor, step)
    if (format(cursor, 'HH:mm') === '07:00') break
  }
  return labels
}

function buildScheduleBlock(label: string, slots: string[]): string {
  const rows = slots
    .map((time, index) => {
      const stripe = index % 2 === 1 ? '#f3f3f3' : undefined
      return `<tr>${td(`<p>${time}</p>`, {
        bgcolor: '#ececec',
        className: 'note-daily-time-cell'
      })}${td(cellP(1), { bgcolor: stripe, className: 'note-daily-schedule-slot' })}</tr>`
    })
    .join('')
  return [
    `<p class="note-daily-section-label"><strong>${label}</strong></p>`,
    `<table class="mail-compose-table mail-tbl-bordered note-daily-schedule-table"><tbody>${rows}</tbody></table>`
  ].join('')
}

function buildMiniListBlock(title: string, bgColor: string, taskList: boolean): string {
  const body = taskList
    ? TASK_LIST(TASK_ITEM(''), TASK_ITEM(''), TASK_ITEM(''))
    : cellP(3)
  return [
    `<p class="note-daily-mini-list-title"><strong>${title}</strong></p>`,
    `<table class="mail-compose-table mail-tbl-bordered note-daily-mini-list"><tbody><tr>${td(body, {
      bgcolor: bgColor,
      className: 'note-daily-mini-list-cell'
    })}</tr></tbody></table>`
  ].join('')
}

const CATEGORY_ROW_COLORS = ['#2d6a4f', '#bc9c22', '#e07a3a', '#4a90d9', '#1e3a5f', '#5c5c5c', '#2d2d2d']
const NOTE_BLOCK_COLORS = ['#ececec', '#fff9db', '#fde8d8', '#dbeafe']

function buildCategoryColorBlock(): string {
  const rows = CATEGORY_ROW_COLORS.map(
    (color) => `<tr>${td(cellP(1), { bgcolor: color, className: 'note-daily-category-row' })}</tr>`
  ).join('')
  return `<table class="mail-compose-table mail-tbl-bordered note-daily-category-table"><tbody>${rows}</tbody></table>`
}

function buildNoteBlocks(): string {
  return NOTE_BLOCK_COLORS.map(
    (color) =>
      `<div class="note-daily-note-block" style="background-color:${color}">${cellP(4)}</div>`
  ).join('')
}

function buildQuadrantBlock(): string {
  const cell = td(cellP(3), { className: 'note-daily-quadrant-cell' })
  return `<table class="mail-compose-table mail-tbl-bordered note-daily-quadrant-table"><tbody><tr>${cell}${cell}</tr><tr>${cell}${cell}</tr></tbody></table>`
}

export function buildDailyPlannerHtml(
  day: Date,
  labels: DailyPlannerLabels,
  locale: Locale,
  slotMinutes: number,
  dayStart = '07:00:00',
  dayEnd = '22:00:00'
): string {
  const dayLabel = format(day, 'EEEE, dd.MM.yyyy', { locale })
  const title = `${labels.titlePrefix} · ${dayLabel}`

  const daySlots = timeSlots(dayStart, dayEnd, slotMinutes)
  const nightSlots = nightTimeSlots(slotMinutes)

  const scheduleCol = [
    buildScheduleBlock(labels.scheduleDay, daySlots),
    buildScheduleBlock(labels.scheduleNight, nightSlots)
  ].join('')

  const tasksCol = [
    buildMiniListBlock(labels.checklist, '#e8dff5', true),
    buildMiniListBlock(labels.priority, '#dde4ec', true),
    buildMiniListBlock(labels.action, '#ececec', true),
    buildMiniListBlock(labels.plainList, '#ffffff', false),
    buildCategoryColorBlock(),
    buildNoteBlocks()
  ].join('')

  const sketchCol = [
    `<p class="note-daily-section-label"><strong>${labels.gridNotes}</strong></p>`,
    `<div class="note-daily-grid-paper">${cellP(2)}</div>`,
    `<p class="note-daily-section-label"><strong>${labels.linedNotes}</strong></p>`,
    `<div class="note-daily-lined-paper">${cellP(6)}</div>`,
    `<p class="note-daily-section-label"><strong>${labels.quadrantNotes}</strong></p>`,
    buildQuadrantBlock()
  ].join('')

  return [
    `<h2>${title}</h2>`,
    `<table class="mail-compose-table mail-tbl-bordered note-daily-planner-layout" data-chronell-planner="daily"><tbody><tr>`,
    td(scheduleCol, { className: 'note-daily-col note-daily-col-schedule' }),
    td(tasksCol, { className: 'note-daily-col note-daily-col-tasks' }),
    td(sketchCol, { className: 'note-daily-col note-daily-col-sketch' }),
    `</tr></tbody></table>`
  ].join('')
}
