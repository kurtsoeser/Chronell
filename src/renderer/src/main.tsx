import React from 'react'
import ReactDOM from 'react-dom/client'
import { APP_PRODUCT_NAME } from '@shared/app-version'
import { initI18n } from './i18n'
import { App } from './App'
import { TeamsChatPopoutShell } from './app/chat/TeamsChatPopoutShell'
import { isTeamsChatPopoutWindow } from './app/chat/teams-chat-popout-route'
import { MailReadingPopoutShell } from './app/layout/MailReadingPopoutShell'
import { isMailReadingPopoutWindow } from './app/layout/mail-reading-popout-route'
import '@fontsource/noto-sans/400.css'
import '@fontsource/noto-sans/600.css'
import './styles/globals.css'
import './stores/theme'
import './stores/ui-scale'

function resolveRootShell(): typeof App {
  if (isMailReadingPopoutWindow()) return MailReadingPopoutShell
  if (isTeamsChatPopoutWindow()) return TeamsChatPopoutShell
  return App
}

const RootShell = resolveRootShell()

document.title = APP_PRODUCT_NAME

void initI18n().then(() => {
  void import('./stores/locale')
  ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
      <RootShell />
    </React.StrictMode>
  )
})
