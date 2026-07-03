import React from 'react'
import ReactDOM from 'react-dom/client'
import { APP_PRODUCT_NAME } from '@shared/app-version'
import { initI18n } from './i18n'
import { App } from './App'
import { TeamsChatPopoutShell } from './app/chat/TeamsChatPopoutShell'
import { isTeamsChatPopoutWindow } from './app/chat/teams-chat-popout-route'
import { MailReadingPopoutShell } from './app/layout/MailReadingPopoutShell'
import { isMailReadingPopoutWindow } from './app/layout/mail-reading-popout-route'
import { QuickCapturePopoutShell } from './app/notes/QuickCapturePopoutShell'
import { isQuickCapturePopoutWindow } from './app/notes/quick-capture-popout-route'
import { PanelPopoutShell } from './app/panel-popout/PanelPopoutShell'
import { isPanelPopoutWindow } from './app/panel-popout/panel-popout-route'
import '@fontsource/noto-sans/400.css'
import '@fontsource/noto-sans/600.css'
import './styles/globals.css'
import './stores/theme'
import './stores/ui-scale'

function resolveRootShell(): typeof App {
  if (isMailReadingPopoutWindow()) return MailReadingPopoutShell
  if (isQuickCapturePopoutWindow()) return QuickCapturePopoutShell
  if (isPanelPopoutWindow()) return PanelPopoutShell
  if (isTeamsChatPopoutWindow()) return TeamsChatPopoutShell
  return App
}

document.title = APP_PRODUCT_NAME

interface ReactRootContainer extends HTMLElement {
  __reactRoot?: ReturnType<typeof ReactDOM.createRoot>
}

function getOrCreateReactRoot(container: ReactRootContainer): ReturnType<typeof ReactDOM.createRoot> {
  if (!container.__reactRoot) {
    container.__reactRoot = ReactDOM.createRoot(container)
  }
  return container.__reactRoot
}

function AppRoot(): JSX.Element {
  const Shell = resolveRootShell()
  return (
    <React.StrictMode>
      <Shell />
    </React.StrictMode>
  )
}

void initI18n().then(() => {
  void import('./stores/locale')
  const container = document.getElementById('root') as ReactRootContainer
  getOrCreateReactRoot(container).render(<AppRoot />)
})
