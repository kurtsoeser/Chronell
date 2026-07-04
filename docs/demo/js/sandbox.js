/**
 * Chronell /demo — interactive sandbox (mail, calendar, tasks, connections).
 * Data: demo-snapshot.json from src/demo/export-demo-snapshot.ts
 */

/** @typedef {import('./demo-types')} DemoSnapshot */

const KIND_COLORS = {
  mail: '#60a5fa',
  note: '#a78bfa',
  calendar: '#34d399',
  task: '#fbbf24',
  contact: '#f472b6'
}

const WEEKDAY_SHORT_DE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
const WEEKDAY_SHORT_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function createSandbox(root, snapshot, strings, lang) {
  const state = structuredClone(snapshot)
  const t = (key) => getNested(strings, key) ?? key
  const fmt = (key, vars) => {
    let s = t(key)
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        s = s.replace(`{${k}}`, String(v))
      }
    }
    return s
  }

  const toastEl = document.getElementById('demo-toast')
  let toastTimer = null
  function toast(msg) {
    if (!toastEl) return
    toastEl.textContent = msg
    toastEl.classList.add('visible')
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => toastEl.classList.remove('visible'), 2200)
  }

  const panels = {
    mail: root.querySelector('[data-sb-panel="mail"]'),
    calendar: root.querySelector('[data-sb-panel="calendar"]'),
    tasks: root.querySelector('[data-sb-panel="tasks"]'),
    connections: root.querySelector('[data-sb-panel="connections"]')
  }

  let mailSelection = new Set()
  let activeMailId = null
  let activeCalDay = null
  let activeGraphNode = null

  function activateTab(id) {
    root.querySelectorAll('[data-sb-tab]').forEach((tab) => {
      const on = tab.dataset.sbTab === id
      tab.classList.toggle('active', on)
      tab.setAttribute('aria-selected', on ? 'true' : 'false')
    })
    Object.entries(panels).forEach(([key, panel]) => {
      if (!panel) return
      const on = key === id
      panel.classList.toggle('active', on)
      panel.hidden = !on
    })
  }

  root.querySelectorAll('[data-sb-tab]').forEach((tab) => {
    tab.addEventListener('click', () => {
      const id = tab.dataset.sbTab
      if (id) activateTab(id)
    })
  })

  const resetBtn = root.querySelector('[data-sb-reset]')
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      state.messages = structuredClone(snapshot.messages)
      state.cloudTasks = structuredClone(snapshot.cloudTasks)
      mailSelection = new Set()
      activeMailId = null
      activeCalDay = null
      activeGraphNode = null
      renderMail()
      renderCalendar()
      renderTasks()
      renderGraph()
      toast(t('sandbox.reset'))
    })
  }

  // —— Mail ——
  function renderMail() {
    const list = panels.mail?.querySelector('[data-sb-mail-list]')
    const bulk = panels.mail?.querySelector('[data-sb-mail-bulk]')
    const bulkCount = panels.mail?.querySelector('[data-sb-mail-bulk-count]')
    const preview = panels.mail?.querySelector('[data-sb-mail-preview]')
    if (!list || !preview) return

    list.innerHTML = ''
    const inbox = state.messages.filter((m) => !m.snoozedUntil)
    for (const m of inbox) {
      const row = document.createElement('div')
      row.className = 'sb-mail-row'
      if (!m.isRead) row.classList.add('unread')
      if (m.isFlagged) row.classList.add('flagged')
      if (mailSelection.has(m.id)) row.classList.add('selected')
      if (activeMailId === m.id) row.classList.add('selected')

      const check = document.createElement('div')
      check.className = 'sb-mail-check' + (mailSelection.has(m.id) ? ' checked' : '')
      check.addEventListener('click', (e) => {
        e.stopPropagation()
        if (mailSelection.has(m.id)) mailSelection.delete(m.id)
        else mailSelection.add(m.id)
        renderMail()
      })

      const body = document.createElement('div')
      const from = document.createElement('div')
      from.className = 'sb-mail-from'
      from.textContent = m.fromName
      const subj = document.createElement('div')
      subj.className = 'sb-mail-subject'
      subj.textContent = m.subject
      const snip = document.createElement('div')
      snip.className = 'sb-mail-snippet'
      snip.textContent = m.snippet
      body.append(from, subj, snip)
      if (m.waitingForReplyUntil) {
        const badge = document.createElement('span')
        badge.className = 'sb-mail-badge'
        badge.textContent = t('sandbox.mail.waiting')
        body.appendChild(badge)
      }
      row.append(check, body)
      row.addEventListener('click', () => {
        activeMailId = m.id
        if (!m.isRead) {
          m.isRead = true
          toast(t('sandbox.toastRead'))
        }
        renderMail()
      })
      list.appendChild(row)
    }

    if (bulk && bulkCount) {
      const n = mailSelection.size
      bulk.classList.toggle('visible', n > 0)
      bulkCount.textContent = fmt('sandbox.mail.selected', { count: n })
    }

    if (activeMailId) {
      const m = state.messages.find((x) => x.id === activeMailId)
      if (m) {
        preview.innerHTML = `
          <h3>${escapeHtml(m.subject)}</h3>
          <div class="sb-mail-preview-meta">${escapeHtml(m.fromName)} · ${escapeHtml(m.fromAddr)}</div>
          <div class="sb-mail-preview-body">${escapeHtml(m.snippet)}</div>
        `
      }
    } else {
      preview.innerHTML = `<div class="sb-mail-preview-empty">${escapeHtml(t('sandbox.mail.previewEmpty'))}</div>`
    }
  }

  panels.mail?.querySelector('[data-sb-mail-mark-read]')?.addEventListener('click', () => {
    for (const id of mailSelection) {
      const m = state.messages.find((x) => x.id === id)
      if (m) m.isRead = true
    }
    mailSelection.clear()
    toast(t('sandbox.toastRead'))
    renderMail()
  })

  panels.mail?.querySelector('[data-sb-mail-plan-todo]')?.addEventListener('click', () => {
    toast(t('sandbox.toastTodo'))
    mailSelection.clear()
    renderMail()
  })

  // —— Calendar ——
  function startOfWeekMonday(d) {
    const x = new Date(d)
    const day = x.getDay()
    const diff = day === 0 ? -6 : 1 - day
    x.setDate(x.getDate() + diff)
    x.setHours(0, 0, 0, 0)
    return x
  }

  function renderCalendar() {
    const grid = panels.calendar?.querySelector('[data-sb-cal-grid]')
    const detail = panels.calendar?.querySelector('[data-sb-cal-detail]')
    const weekLabel = panels.calendar?.querySelector('[data-sb-cal-week]')
    if (!grid) return

    const now = new Date()
    const weekStart = startOfWeekMonday(now)
    const weekdays = lang === 'en' ? WEEKDAY_SHORT_EN : WEEKDAY_SHORT_DE
    if (weekLabel) {
      const end = new Date(weekStart)
      end.setDate(end.getDate() + 6)
      weekLabel.textContent = `${t('sandbox.calendar.week')} · ${formatShortDate(weekStart, lang)} – ${formatShortDate(end, lang)}`
    }

    grid.innerHTML = ''
    for (let i = 0; i < 7; i++) {
      const day = new Date(weekStart)
      day.setDate(day.getDate() + i)
      const dayKey = day.toISOString().slice(0, 10)
      const cell = document.createElement('div')
      cell.className = 'sb-cal-day'
      if (sameDay(day, now)) cell.classList.add('today')
      if (activeCalDay === dayKey) cell.classList.add('active')

      const label = document.createElement('div')
      label.className = 'sb-cal-day-label'
      label.textContent = `${weekdays[i]} ${day.getDate()}.`
      cell.appendChild(label)

      const dayEvents = state.calendarEvents.filter((ev) => eventOnDay(ev, day))
      if (dayEvents.length === 0) {
        const empty = document.createElement('div')
        empty.style.fontSize = '0.6rem'
        empty.style.color = 'hsl(var(--muted))'
        empty.textContent = '—'
        cell.appendChild(empty)
      }
      for (const ev of dayEvents) {
        const el = document.createElement('div')
        el.className = 'sb-cal-event ' + (ev.colorClass.includes('emerald') ? 'green' : 'blue')
        const time = ev.isAllDay
          ? t('sandbox.calendar.allDay')
          : formatTimeRange(ev.startIso, ev.endIso, lang)
        el.innerHTML = `<div class="sb-cal-event-time">${escapeHtml(time)}</div><div>${escapeHtml(ev.title)}</div>`
        el.addEventListener('click', (e) => {
          e.stopPropagation()
          activeCalDay = dayKey
          if (detail) {
            detail.innerHTML = `
              <strong>${escapeHtml(ev.title)}</strong><br>
              ${escapeHtml(time)}${ev.location ? ` · ${escapeHtml(ev.location)}` : ''}<br>
              ${ev.organizer ? `<span style="color:hsl(var(--muted))">${escapeHtml(t('sandbox.calendar.detailOrganizer'))}: ${escapeHtml(ev.organizer)}</span>` : ''}
            `
          }
          renderCalendar()
        })
        cell.appendChild(el)
      }
      cell.addEventListener('click', () => {
        activeCalDay = dayKey
        if (detail && dayEvents.length === 0) {
          detail.textContent = t('sandbox.calendar.noEvents')
        }
        renderCalendar()
      })
      grid.appendChild(cell)
    }
  }

  // —— Tasks ——
  function renderTasks() {
    const wrap = panels.tasks?.querySelector('[data-sb-tasks-cols]')
    if (!wrap) return
    wrap.innerHTML = ''

    const todayStr = new Date().toISOString().slice(0, 10)
    const groups = [
      { key: 'overdue', label: t('sandbox.tasks.overdue'), filter: (task) => !task.completed && task.dueIso && task.dueIso < todayStr },
      { key: 'today', label: t('sandbox.tasks.today'), filter: (task) => !task.completed && task.dueIso === todayStr },
      { key: 'later', label: t('sandbox.tasks.later'), filter: (task) => !task.completed && task.dueIso && task.dueIso > todayStr },
      { key: 'nodue', label: t('sandbox.tasks.noDue'), filter: (task) => !task.completed && !task.dueIso },
      { key: 'done', label: t('sandbox.tasks.completed'), filter: (task) => task.completed }
    ]

    for (const g of groups) {
      const col = document.createElement('div')
      col.className = 'sb-task-col'
      const h = document.createElement('h4')
      h.textContent = g.label
      col.appendChild(h)

      const items = state.cloudTasks.filter(g.filter)
      if (items.length === 0) {
        const empty = document.createElement('div')
        empty.className = 'sb-task-empty'
        empty.textContent = t('sandbox.tasks.empty')
        col.appendChild(empty)
      }
      for (const task of items) {
        const row = document.createElement('div')
        row.className = 'sb-task-item' + (task.completed ? ' done' : '')
        const check = document.createElement('div')
        check.className = 'sb-task-check'
        const body = document.createElement('div')
        const title = document.createElement('div')
        title.className = 'sb-task-title'
        title.textContent = task.title
        const meta = document.createElement('div')
        meta.className = 'sb-task-meta'
        const acc = state.accounts.find((a) => a.id === task.accountId)
        meta.textContent = acc ? acc.displayName : task.listName
        body.append(title, meta)
        row.append(check, body)
        row.addEventListener('click', () => {
          if (!task.completed) {
            task.completed = true
            toast(t('sandbox.toastDone'))
          } else {
            task.completed = false
          }
          renderTasks()
        })
        col.appendChild(row)
      }
      wrap.appendChild(col)
    }
  }

  // —— Graph ——
  function renderGraph() {
    const svg = panels.connections?.querySelector('[data-sb-graph-svg]')
    const linkCount = panels.connections?.querySelector('[data-sb-graph-count]')
    if (!svg) return
    const ns = 'http://www.w3.org/2000/svg'
    svg.innerHTML = ''

    const nodes = state.graphNodes
    const edges = state.graphEdges
    const byId = new Map(nodes.map((n) => [n.id, n]))

    if (linkCount) {
      linkCount.textContent = fmt('sandbox.connections.links', { count: edges.length })
    }

    const connected = new Set()
    if (activeGraphNode) {
      connected.add(activeGraphNode)
      for (const e of edges) {
        if (e.from === activeGraphNode) connected.add(e.to)
        if (e.to === activeGraphNode) connected.add(e.from)
      }
    }

    const gEdges = document.createElementNS(ns, 'g')
    for (const e of edges) {
      const a = byId.get(e.from)
      const b = byId.get(e.to)
      if (!a || !b) continue
      const line = document.createElementNS(ns, 'line')
      line.setAttribute('x1', String(a.x))
      line.setAttribute('y1', String(a.y))
      line.setAttribute('x2', String(b.x))
      line.setAttribute('y2', String(b.y))
      line.setAttribute('class', 'sb-graph-edge')
      if (activeGraphNode && (e.from === activeGraphNode || e.to === activeGraphNode)) {
        line.classList.add('highlight')
      }
      if (activeGraphNode && !connected.has(e.from) && !connected.has(e.to)) {
        line.style.opacity = '0.15'
      }
      gEdges.appendChild(line)
    }
    svg.appendChild(gEdges)

    const gNodes = document.createElementNS(ns, 'g')
    for (const n of nodes) {
      const g = document.createElementNS(ns, 'g')
      g.setAttribute('class', 'sb-graph-node')
      g.setAttribute('transform', `translate(${n.x},${n.y})`)
      if (activeGraphNode === n.id) g.classList.add('highlight')
      else if (activeGraphNode && !connected.has(n.id)) g.classList.add('dim')

      const circle = document.createElementNS(ns, 'circle')
      circle.setAttribute('r', '14')
      circle.setAttribute('fill', KIND_COLORS[n.kind] || '#888')
      circle.setAttribute('fill-opacity', '0.25')
      circle.setAttribute('stroke', KIND_COLORS[n.kind] || '#888')

      const text = document.createElementNS(ns, 'text')
      text.setAttribute('text-anchor', 'middle')
      text.setAttribute('y', '32')
      const label = n.label.length > 22 ? `${n.label.slice(0, 20)}…` : n.label
      text.textContent = label

      g.append(circle, text)
      g.addEventListener('click', () => {
        activeGraphNode = activeGraphNode === n.id ? null : n.id
        renderGraph()
      })
      gNodes.appendChild(g)
    }
    svg.appendChild(gNodes)
  }

  activateTab('mail')
  renderMail()
  renderCalendar()
  renderTasks()
  renderGraph()

  return {
    activateTab,
    reset: () => resetBtn?.click()
  }
}

function getNested(obj, path) {
  return path.split('.').reduce((acc, key) => (acc && acc[key] != null ? acc[key] : null), obj)
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function eventOnDay(ev, day) {
  const start = new Date(ev.startIso)
  const end = new Date(ev.endIso)
  const d0 = new Date(day)
  d0.setHours(0, 0, 0, 0)
  const d1 = new Date(d0)
  d1.setDate(d1.getDate() + 1)
  return start < d1 && end >= d0
}

function formatShortDate(d, lang) {
  return d.toLocaleDateString(lang === 'en' ? 'en-GB' : 'de-AT', { day: 'numeric', month: 'short' })
}

function formatTimeRange(startIso, endIso, lang) {
  const loc = lang === 'en' ? 'en-GB' : 'de-AT'
  const s = new Date(startIso)
  const e = new Date(endIso)
  const opts = { hour: '2-digit', minute: '2-digit' }
  return `${s.toLocaleTimeString(loc, opts)}–${e.toLocaleTimeString(loc, opts)}`
}
