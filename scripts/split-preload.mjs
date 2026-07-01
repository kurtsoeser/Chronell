/**
 * Split src/preload/index.ts → src/preload/api/*.ts + ipc-listeners.ts
 */
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const srcPath = path.join(root, 'src/preload/index.ts')
const lines = fs.readFileSync(srcPath, 'utf8').split(/\r?\n/)
const apiDir = path.join(root, 'src/preload/api')

/** [exportName, fileName, startLine, endLine] — Zeilen innerhalb des API-Objekts (Inhalt ohne äußere Klammer) */
const sections = [
  ['appApi', 'app.ts', 308, 323],
  ['mailBodyIndexApi', 'mail-body-index.ts', 326, 332],
  ['filesApi', 'files.ts', 335, 365],
  ['configApi', 'config.ts', 368, 399],
  ['settingsBackupApi', 'settings-backup.ts', 402, 428],
  ['profileSyncApi', 'profile-sync.ts', 431, 455],
  ['localDataApi', 'local-data.ts', 458, 465],
  ['weatherApi', 'weather.ts', 468, 475],
  ['locationApi', 'location.ts', 478, 485],
  ['notionApi', 'notion.ts', 488, 512],
  ['authApi', 'auth.ts', 515, 535],
  ['graphApi', 'graph.ts', 538, 551],
  ['teamsChatPopoutApi', 'teams-chat-popout.ts', 554, 568],
  ['mailReadingPopoutApi', 'mail-reading-popout.ts', 571, 585],
  ['panelPopoutApi', 'panel-popout.ts', 588, 602],
  ['entityLinksApi', 'entity-links.ts', 605, 673],
  ['aiConnectionsApi', 'ai-connections.ts', 676, 697],
  ['notesApi', 'notes.ts', 700, 778],
  ['mailApi', 'mail.ts', 781, 975],
  ['folderApi', 'folder.ts', 978, 990],
  ['composeApi', 'compose.ts', 993, 1025],
  ['calendarApi', 'calendar.ts', 1028, 1129],
  ['tasksApi', 'tasks.ts', 1132, 1165],
  ['bookingsApi', 'bookings.ts', 1168, 1177],
  ['peopleApi', 'people.ts', 1180, 1202],
  ['workflowApi', 'workflow.ts', 1205, 1209],
  ['vipApi', 'vip.ts', 1212, 1216],
  ['rulesApi', 'rules.ts', 1219, 1251]
]

const sharedImports = lines.slice(2, 164).join('\n')
const entityLinksImport = lines.slice(164, 181).join('\n')
const aiConnectionsImport = lines.slice(181, 187).join('\n')
const mailRulesImport = lines.slice(187, 194).join('\n')

const baseImports = `import { ipcRenderer, type IpcRendererEvent } from 'electron'
${sharedImports}
${entityLinksImport}
${aiConnectionsImport}
${mailRulesImport}`

function wrapApiExport(exportName, start, end) {
  const body = lines
    .slice(start - 1, end)
    .join('\n')
    .trim()
    .replace(/,\s*$/, '')
  return `export const ${exportName} = {\n${body}\n}`
}

fs.mkdirSync(apiDir, { recursive: true })

for (const [exportName, fileName, start, end] of sections) {
  const content = `${baseImports}\n\n${wrapApiExport(exportName, start, end)}\n`
  fs.writeFileSync(path.join(apiDir, fileName), content)
  console.log('wrote api/', fileName)
}

const listeners = lines.slice(195, 304).join('\n')
fs.writeFileSync(
  path.join(root, 'src/preload/ipc-listeners.ts'),
  `import { ipcRenderer, type IpcRendererEvent } from 'electron'\nimport { mergeMailChangedPayload } from '@shared/mail-changed-merge'\nimport type { MailChangedPayload } from '@shared/types'\nimport type { ZoomShortcutIntent } from '@shared/zoom-shortcut-keys'\n\n${listeners}\n\nexport {\n  mailChangedHandlers,\n  calendarChangedHandlers,\n  tasksChangedHandlers,\n  zoomShortcutHandlers\n}\n`
)

const eventsContent = `${baseImports.replace("import { ipcRenderer } from 'electron'", "import { ipcRenderer, type IpcRendererEvent } from 'electron'")}
import {
  mailChangedHandlers,
  calendarChangedHandlers,
  tasksChangedHandlers,
  zoomShortcutHandlers
} from '../ipc-listeners'

${wrapApiExport('eventsApi', 1254, 1462)}
`
fs.writeFileSync(path.join(apiDir, 'events.ts'), eventsContent)
console.log('wrote api/events.ts')

const index = `import { contextBridge, ipcRenderer } from 'electron'
import './ipc-listeners'
import { appApi } from './api/app'
import { mailBodyIndexApi } from './api/mail-body-index'
import { filesApi } from './api/files'
import { configApi } from './api/config'
import { settingsBackupApi } from './api/settings-backup'
import { profileSyncApi } from './api/profile-sync'
import { localDataApi } from './api/local-data'
import { weatherApi } from './api/weather'
import { locationApi } from './api/location'
import { notionApi } from './api/notion'
import { authApi } from './api/auth'
import { graphApi } from './api/graph'
import { teamsChatPopoutApi } from './api/teams-chat-popout'
import { mailReadingPopoutApi } from './api/mail-reading-popout'
import { panelPopoutApi } from './api/panel-popout'
import { entityLinksApi } from './api/entity-links'
import { aiConnectionsApi } from './api/ai-connections'
import { notesApi } from './api/notes'
import { mailApi } from './api/mail'
import { folderApi } from './api/folder'
import { composeApi } from './api/compose'
import { calendarApi } from './api/calendar'
import { tasksApi } from './api/tasks'
import { bookingsApi } from './api/bookings'
import { peopleApi } from './api/people'
import { workflowApi } from './api/workflow'
import { vipApi } from './api/vip'
import { rulesApi } from './api/rules'
import { eventsApi } from './api/events'

const api = {
  app: appApi,
  mailBodyIndex: mailBodyIndexApi,
  files: filesApi,
  config: configApi,
  settingsBackup: settingsBackupApi,
  profileSync: profileSyncApi,
  localData: localDataApi,
  weather: weatherApi,
  location: locationApi,
  notion: notionApi,
  auth: authApi,
  graph: graphApi,
  teamsChatPopout: teamsChatPopoutApi,
  mailReadingPopout: mailReadingPopoutApi,
  panelPopout: panelPopoutApi,
  entityLinks: entityLinksApi,
  aiConnections: aiConnectionsApi,
  notes: notesApi,
  mail: mailApi,
  folder: folderApi,
  compose: composeApi,
  calendar: calendarApi,
  tasks: tasksApi,
  bookings: bookingsApi,
  people: peopleApi,
  workflow: workflowApi,
  vip: vipApi,
  rules: rulesApi,
  events: eventsApi,
  invoke: (channel: string, payload?: unknown): Promise<unknown> =>
    ipcRenderer.invoke(channel, payload)
}

contextBridge.exposeInMainWorld('mailClient', api)

export type MailClientApi = typeof api
`

fs.writeFileSync(srcPath, index)
console.log('wrote preload/index.ts')
