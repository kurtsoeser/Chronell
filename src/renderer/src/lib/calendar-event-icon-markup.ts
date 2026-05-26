import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  calendarEventIconIsExplicit,
  resolveCalendarEventIcon
} from '@/lib/calendar-event-icons'

/** SVG-Markup für FullCalendar-Event-Inhalt (DOM, kein React-Root). */
export function calendarEventIconSvgMarkup(
  iconId: string | undefined | null,
  className: string,
  colorHex?: string | null,
  size = 14
): string | null {
  if (!calendarEventIconIsExplicit(iconId)) return null
  const Icon = resolveCalendarEventIcon(iconId)
  return renderToStaticMarkup(
    createElement(Icon, {
      className,
      size,
      strokeWidth: 2,
      color: colorHex ?? undefined,
      'aria-hidden': true
    })
  )
}

export function appendCalendarEventIconSvg(
  parent: HTMLElement,
  iconId: string | undefined | null,
  className: string,
  colorHex?: string | null,
  size = 14
): void {
  const markup = calendarEventIconSvgMarkup(iconId, className, colorHex, size)
  if (!markup) return
  const tpl = document.createElement('template')
  tpl.innerHTML = markup.trim()
  const svg = tpl.content.firstElementChild
  if (svg) parent.appendChild(svg)
}
