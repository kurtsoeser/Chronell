/**
 * Eigene Microsoft Forms auflisten (formapi) und Ausfuell-Link bauen.
 */

import { buildMsFormsResponseUrl } from '@shared/note-msforms-embed'
import type { MsFormListItem } from '@shared/msforms-types'
import { loadConfig } from '../config'
import { acquireFormsAccessToken } from '../auth/microsoft-forms'
import { createGraphClient } from './client'
import { runGraphMailboxRequest } from './graph-account-request'

interface FormsApiCollection<T> {
  value?: T[]
}

interface FormsApiLightForm {
  id?: string
  title?: string | null
  createdDate?: string | null
  modifiedDate?: string | null
  category?: string | null
}

function decodeJwtPayload(token: string): { tid?: string; oid?: string } {
  try {
    const part = token.split('.')[1]
    if (!part) return {}
    const json = Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
    return JSON.parse(json) as { tid?: string; oid?: string }
  } catch {
    return {}
  }
}

async function resolveTenantAndUser(
  accountId: string,
  formsToken: string
): Promise<{ tenantId: string; userId: string }> {
  const fromJwt = decodeJwtPayload(formsToken)
  if (fromJwt.tid?.trim() && fromJwt.oid?.trim()) {
    return { tenantId: fromJwt.tid.trim(), userId: fromJwt.oid.trim() }
  }

  const config = await loadConfig()
  if (!config.microsoftClientId) {
    throw new Error('Keine Azure Client-ID konfiguriert.')
  }
  const homeAccountId = accountId.replace(/^ms:/, '')
  const client = createGraphClient(config.microsoftClientId, homeAccountId)
  const me = (await client.api('/me').select(['id']).get()) as { id?: string }
  const orgs = (await client.api('/organization').select(['id']).get()) as {
    value?: Array<{ id?: string }>
  }
  const userId = me.id?.trim()
  const tenantId = orgs.value?.[0]?.id?.trim() || fromJwt.tid?.trim()
  if (!userId || !tenantId) {
    throw new Error('Tenant- oder Benutzer-ID fuer Forms konnte nicht ermittelt werden.')
  }
  return { tenantId, userId }
}

async function fetchFormsJson<T>(
  url: string,
  accessToken: string
): Promise<T> {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'User-Agent': 'Chronell-MailClient/1.0'
    }
  })
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) {
    const msg =
      typeof body.message === 'string'
        ? body.message
        : typeof body.error === 'object' &&
            body.error &&
            typeof (body.error as { message?: string }).message === 'string'
          ? (body.error as { message: string }).message
          : res.statusText
    throw new Error(`Microsoft Forms API (${res.status}): ${msg || 'Fehler'}`)
  }
  return body as T
}

function mapForm(raw: FormsApiLightForm): MsFormListItem | null {
  const id = raw.id?.trim()
  if (!id) return null
  const title = (raw.title?.trim() || 'Ohne Titel').slice(0, 200)
  return {
    id,
    title,
    createdDate: raw.createdDate?.trim() || null,
    modifiedDate: raw.modifiedDate?.trim() || null,
    responseUrl: buildMsFormsResponseUrl({ formId: id, host: 'forms.office.com' })
  }
}

export async function listMyMsForms(accountId: string): Promise<MsFormListItem[]> {
  const id = accountId.trim()
  if (!id) throw new Error('Keine Konto-ID fuer Forms.')

  return runGraphMailboxRequest(id, 'msforms.listMine', async () => {
    const config = await loadConfig()
    if (!config.microsoftClientId) {
      throw new Error('Keine Azure Client-ID konfiguriert.')
    }
    const accessToken = await acquireFormsAccessToken(config.microsoftClientId, id)
    const { tenantId, userId } = await resolveTenantAndUser(id, accessToken)

    const candidates = [
      `https://forms.office.com/formapi/api/${tenantId}/users/${userId}/light/ownedforms`,
      `https://forms.office.com/formapi/api/${tenantId}/users/${userId}/light/forms`
    ]

    let lastError: unknown = null
    for (const url of candidates) {
      try {
        const data = await fetchFormsJson<FormsApiCollection<FormsApiLightForm>>(url, accessToken)
        const rows = (data.value ?? [])
          .map(mapForm)
          .filter((r): r is MsFormListItem => r != null)
        rows.sort((a, b) => {
          const am = a.modifiedDate ? Date.parse(a.modifiedDate) : 0
          const bm = b.modifiedDate ? Date.parse(b.modifiedDate) : 0
          return bm - am
        })
        return rows
      } catch (e) {
        lastError = e
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error('Microsoft Forms konnten nicht geladen werden.')
  })
}
