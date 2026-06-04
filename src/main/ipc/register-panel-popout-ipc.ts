import { ipcMain } from 'electron'
import { IPC } from '@shared/ipc-channels'
import type {
  PanelPopoutDockPayload,
  PanelPopoutOpenInput,
  PanelPopoutRef,
  PanelPopoutStashInput
} from '@shared/panel-popout'
import { PANEL_POPOUT_KINDS } from '@shared/panel-popout'
import {
  clearPanelPopoutPayload,
  stashPanelPopoutPayload,
  takePanelPopoutPayload
} from '../panel-popout/panel-popout-payload'
import { broadcastPanelPopoutDock } from './ipc-broadcasts'
import {
  closeAllPanelPopouts,
  closePanelPopout,
  focusPanelPopout,
  isPanelPopoutOpen,
  openPanelPopout
} from '../panel-popout/panel-popout-window'

function assertPanelKind(panel: string): asserts panel is PanelPopoutOpenInput['panel'] {
  if (!(PANEL_POPOUT_KINDS as readonly string[]).includes(panel)) {
    throw new Error(`Unbekannter Panel-Typ: ${panel}`)
  }
}

export function registerPanelPopoutIpc(): void {
  ipcMain.removeHandler(IPC.panelPopout.open)
  ipcMain.removeHandler(IPC.panelPopout.close)
  ipcMain.removeHandler(IPC.panelPopout.closeAll)
  ipcMain.removeHandler(IPC.panelPopout.focus)
  ipcMain.removeHandler(IPC.panelPopout.isOpen)
  ipcMain.removeHandler(IPC.panelPopout.stashPayload)
  ipcMain.removeHandler(IPC.panelPopout.takePayload)
  ipcMain.removeHandler(IPC.panelPopout.requestDock)

  ipcMain.handle(IPC.panelPopout.open, (_event, input: PanelPopoutOpenInput): void => {
    assertPanelKind(input.panel)
    openPanelPopout(input)
  })

  ipcMain.handle(IPC.panelPopout.close, (_event, ref: PanelPopoutRef): void => {
    assertPanelKind(ref.panel)
    closePanelPopout(ref.panel, ref.instanceKey)
  })

  ipcMain.handle(IPC.panelPopout.closeAll, (): void => {
    closeAllPanelPopouts()
  })

  ipcMain.handle(
    IPC.panelPopout.focus,
    (_event, ref: PanelPopoutRef): boolean => {
      assertPanelKind(ref.panel)
      return focusPanelPopout(ref.panel, ref.instanceKey)
    }
  )

  ipcMain.handle(
    IPC.panelPopout.isOpen,
    (_event, ref: PanelPopoutRef): boolean => {
      assertPanelKind(ref.panel)
      return isPanelPopoutOpen(ref.panel, ref.instanceKey)
    }
  )

  ipcMain.handle(
    IPC.panelPopout.stashPayload,
    (_event, input: PanelPopoutStashInput): void => {
      if (!input?.key?.trim()) throw new Error('stashKey fehlt.')
      stashPanelPopoutPayload(input.key.trim(), input.payload)
    }
  )

  ipcMain.handle(
    IPC.panelPopout.takePayload,
    (_event, key: string): unknown => {
      if (typeof key !== 'string' || !key.trim()) return null
      return takePanelPopoutPayload(key.trim())
    }
  )

  ipcMain.handle(IPC.panelPopout.requestDock, (_event, input: PanelPopoutDockPayload): void => {
    assertPanelKind(input.panel)
    const instanceKey = input.instanceKey?.trim() || ''
    closePanelPopout(input.panel, instanceKey || undefined)
    broadcastPanelPopoutDock({
      panel: input.panel,
      instanceKey,
      stashKey: input.stashKey?.trim() || undefined,
      params: input.params
    })
  })
}
