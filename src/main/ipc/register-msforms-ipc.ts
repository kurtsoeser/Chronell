import { ipcMain } from 'electron'
import { IPC, type MsFormListItem, type MsFormsListMineInput } from '@shared/types'
import { listMyMsForms } from '../graph/msforms-graph'
import { assertAppOnline } from '../network-status'
import { formatGraphErrorMessage } from '../graph/graph-request-errors'

function rethrowMsFormsIpcError(e: unknown, context: string): never {
  console.error(`[msforms-ipc] ${context}`, e)
  if (e instanceof Error && e.message && e.message !== 'Error') {
    throw e
  }
  throw new Error(formatGraphErrorMessage(e, context))
}

function normalizeListInput(raw: unknown): MsFormsListMineInput {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const accountId = typeof o.accountId === 'string' ? o.accountId.trim() : ''
  if (!accountId) throw new Error('Keine Konto-ID für Microsoft Forms.')
  return { accountId }
}

export function registerMsFormsIpc(): void {
  ipcMain.removeHandler(IPC.msForms.listMine)
  ipcMain.handle(
    IPC.msForms.listMine,
    async (_event, raw: unknown): Promise<MsFormListItem[]> => {
      try {
        assertAppOnline()
        const { accountId } = normalizeListInput(raw)
        return await listMyMsForms(accountId)
      } catch (e) {
        rethrowMsFormsIpcError(e, 'Microsoft Forms konnten nicht geladen werden.')
      }
    }
  )
}
