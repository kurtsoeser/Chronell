import { IPC, type ComposeSendFromOption } from '@shared/types'

type InvokeFn = (channel: string, payload?: unknown) => Promise<unknown>

function getInvoke(): InvokeFn | undefined {
  const m = window.mailClient as typeof window.mailClient & { invoke?: InvokeFn }
  return typeof m.invoke === 'function' ? m.invoke : undefined
}

/**
 * Absender-Optionen (Hauptkonto, Alias, freigegebene Postfächer).
 * Nach Vite-HMR kann `mailClient.compose.listSendFromOptions` fehlen — dann `invoke`.
 */
export async function listComposeSendFromOptions(
  accountId: string
): Promise<ComposeSendFromOption[]> {
  const fn = window.mailClient?.compose?.listSendFromOptions
  if (typeof fn === 'function') {
    return fn(accountId)
  }
  const inv = getInvoke()
  if (inv) {
    return inv(IPC.compose.listSendFromOptions, { accountId }) as Promise<ComposeSendFromOption[]>
  }
  return []
}
