import type { ConnectedAccount, Provider } from '@shared/types'
import { listAccounts } from '../accounts'
import { DemoReadOnlyError } from './demo-errors'

export function isDemoProvider(provider: Provider): boolean {
  return provider === 'demo'
}

export function isDemoAccount(account: Pick<ConnectedAccount, 'provider' | 'isDemo'>): boolean {
  return account.isDemo === true || isDemoProvider(account.provider)
}

export async function findAccountById(accountId: string): Promise<ConnectedAccount | undefined> {
  const accounts = await listAccounts()
  return accounts.find((a) => a.id === accountId)
}

export async function isDemoAccountId(accountId: string): Promise<boolean> {
  const acc = await findAccountById(accountId)
  return acc ? isDemoAccount(acc) : false
}

export function assertAccountWritable(account: ConnectedAccount, action?: string): void {
  if (!isDemoAccount(account)) return
  const hint = action ? ` (${action})` : ''
  throw new DemoReadOnlyError(`Demo-Modus${hint}: Es wird nichts an Microsoft, Google oder andere Dienste gesendet.`)
}
