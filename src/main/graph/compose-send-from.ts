import { GraphError } from '@microsoft/microsoft-graph-client'
import type { ComposeSendFromOption } from '@shared/types'
import { listAccounts } from '../accounts'
import { createGraphClient } from './client'
import { loadConfig } from '../config'
import { normalizeComposeEmail } from './graph-mailbox-root'

async function getClientFor(accountId: string): Promise<ReturnType<typeof createGraphClient>> {
  const config = await loadConfig()
  if (!config.microsoftClientId) {
    throw new Error('Keine Azure Client-ID konfiguriert.')
  }
  const homeAccountId = accountId.replace(/^ms:/, '')
  return createGraphClient(config.microsoftClientId, homeAccountId)
}

function parseProxyAddressSmtp(value: string): string | null {
  const v = value.trim()
  const lower = v.toLowerCase()
  if (lower.startsWith('smtp:')) return v.slice(5).trim()
  if (lower.startsWith('smtp2:')) return v.slice(6).trim()
  return null
}

function optionKey(email: string, kind: ComposeSendFromOption['kind']): string {
  return `${kind}:${normalizeComposeEmail(email)}`
}

async function canAccessSharedMailbox(
  client: ReturnType<typeof createGraphClient>,
  email: string
): Promise<boolean> {
  try {
    await client
      .api(`/users/${encodeURIComponent(email)}/mailFolders/inbox`)
      .select(['id'])
      .top(1)
      .get()
    return true
  } catch (e) {
    if (e instanceof GraphError && (e.statusCode === 403 || e.statusCode === 404)) {
      return false
    }
    return true
  }
}

export async function listComposeSendFromOptions(accountId: string): Promise<ComposeSendFromOption[]> {
  const accounts = await listAccounts()
  const acc = accounts.find((a) => a.id === accountId)
  if (!acc) throw new Error('Konto nicht gefunden.')

  const primaryNorm = normalizeComposeEmail(acc.email)
  const byKey = new Map<string, ComposeSendFromOption>()

  const add = (opt: ComposeSendFromOption): void => {
    const key = optionKey(opt.email, opt.kind)
    if (!byKey.has(key)) byKey.set(key, opt)
  }

  add({
    email: acc.email,
    displayName: acc.displayName,
    kind: 'primary'
  })

  if (acc.provider !== 'microsoft') {
    return [...byKey.values()]
  }

  try {
    const client = await getClientFor(accountId)
    const me = (await client
      .api('/me')
      .select(['mail', 'displayName', 'proxyAddresses', 'otherMails'])
      .get()) as {
      mail?: string | null
      displayName?: string | null
      proxyAddresses?: string[] | null
      otherMails?: string[] | null
    }

    for (const raw of me.proxyAddresses ?? []) {
      const smtp = parseProxyAddressSmtp(raw)
      if (!smtp) continue
      const norm = normalizeComposeEmail(smtp)
      if (norm === primaryNorm) continue
      add({
        email: smtp,
        displayName: me.displayName ?? acc.displayName,
        kind: 'alias'
      })
    }

    for (const other of me.otherMails ?? []) {
      const norm = normalizeComposeEmail(other)
      if (!norm || norm === primaryNorm) continue
      add({
        email: other.trim(),
        displayName: me.displayName ?? acc.displayName,
        kind: 'alias'
      })
    }
  } catch (e) {
    console.warn('[compose] Absender-Aliase von Graph:', e)
  }

  for (const entry of acc.sharedMailboxSendAs ?? []) {
    const email = entry.email?.trim()
    if (!email) continue
    const norm = normalizeComposeEmail(email)
    if (norm === primaryNorm) continue
    add({
      email,
      displayName: entry.displayName?.trim() || email,
      kind: 'shared'
    })
  }

  const sharedCandidates = [...byKey.values()].filter((o) => o.kind === 'shared')
  if (sharedCandidates.length > 0) {
    try {
      const client = await getClientFor(accountId)
      await Promise.all(
        sharedCandidates.map(async (o) => {
          const ok = await canAccessSharedMailbox(client, o.email)
          if (!ok) {
            byKey.delete(optionKey(o.email, o.kind))
          }
        })
      )
    } catch {
      // Konfigurierte Postfaecher trotzdem anzeigen
    }
  }

  const sortRank = (k: ComposeSendFromOption['kind']): number =>
    k === 'primary' ? 0 : k === 'alias' ? 1 : 2

  return [...byKey.values()].sort((a, b) => {
    const r = sortRank(a.kind) - sortRank(b.kind)
    if (r !== 0) return r
    return a.email.localeCompare(b.email, 'de')
  })
}
