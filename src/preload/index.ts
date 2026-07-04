import { contextBridge, ipcRenderer } from 'electron'
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
import { quickCaptureApi } from './api/quick-capture'
import { demoApi } from './api/demo'

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
  quickCapture: quickCaptureApi,
  demo: demoApi,
  invoke: (channel: string, payload?: unknown): Promise<unknown> =>
    ipcRenderer.invoke(channel, payload)
}

contextBridge.exposeInMainWorld('mailClient', api)

export type MailClientApi = typeof api
