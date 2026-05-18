import React from 'react'
import ReactDOM from 'react-dom/client'
import { APP_PRODUCT_NAME } from '@shared/app-version'
import { initI18n } from './i18n'
import { App } from './App'
import { TeamsChatPopoutShell } from './app/chat/TeamsChatPopoutShell'
import { isTeamsChatPopoutWindow } from './app/chat/teams-chat-popout-route'
import './styles/globals.css'
import './stores/theme'

const RootShell = isTeamsChatPopoutWindow() ? TeamsChatPopoutShell : App

document.title = APP_PRODUCT_NAME

void initI18n().then(() => {
  void import('./stores/locale')
  ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
      <RootShell />
    </React.StrictMode>
  )
})
