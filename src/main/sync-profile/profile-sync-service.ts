import { hostname } from 'node:os'
import { randomUUID } from 'node:crypto'
import type {
  ProfileDataMode,
  ProfileSyncRunResult,
  ProfileSyncSessionInfo,
  ProfileSyncStatus,
  SettingsBackupPayload
} from '@shared/types'
import { SETTINGS_BACKUP_FORMAT_VERSION } from '@shared/types'
import { loadConfig, updateConfig } from '../config'
import { isSupabaseConfigured } from './supabase-config'
import {
  clearStoredSession,
  createAuthenticatedSupabaseClient,
  createSupabaseAnonClient,
  readStoredSession,
  writeStoredSession
} from './supabase-session'
import { applyProfileSyncPayload, buildProfileSyncPayload } from './profile-sync-payload'
import { loginProfileSyncWithMicrosoft365 } from './profile-sync-azure-auth'

let lastSyncError: string | null = null

async function ensureProfileDeviceId(): Promise<string> {
  const config = await loadConfig()
  const existing = config.profileDeviceId?.trim()
  if (existing) return existing
  const id = randomUUID()
  await updateConfig({ profileDeviceId: id })
  return id
}

export async function getProfileSyncStatus(): Promise<ProfileSyncStatus> {
  const config = await loadConfig()
  const stored = await readStoredSession()
  const deviceId = config.profileDeviceId?.trim() || (await ensureProfileDeviceId())

  let session: ProfileSyncSessionInfo | null = null
  if (stored?.user?.id) {
    session = {
      userId: stored.user.id,
      email: stored.user.email ?? null
    }
  }

  let remoteUpdatedAt: string | null = null
  if (isSupabaseConfigured() && stored) {
    try {
      const client = await createAuthenticatedSupabaseClient()
      if (client) {
        const { data } = await client
          .from('chronell_profile_snapshots')
          .select('updated_at')
          .eq('user_id', stored.user.id)
          .maybeSingle()
        if (data && typeof data.updated_at === 'string') {
          remoteUpdatedAt = data.updated_at
        }
      }
    } catch {
      /* optional */
    }
  }

  return {
    configured: isSupabaseConfigured(),
    dataMode: config.profileDataMode ?? 'local',
    deviceId,
    signedIn: stored != null,
    session,
    lastPulledAt: config.profileCloudLastPulledAt ?? null,
    lastPushedAt: config.profileCloudLastPushedAt ?? null,
    remoteUpdatedAt,
    lastError: lastSyncError
  }
}

export async function setProfileDataMode(mode: ProfileDataMode): Promise<ProfileSyncStatus> {
  await updateConfig({ profileDataMode: mode })
  lastSyncError = null
  return getProfileSyncStatus()
}

export async function sendProfileSyncOtp(email: string): Promise<void> {
  const client = createSupabaseAnonClient()
  if (!client) {
    throw new Error('Supabase ist nicht konfiguriert (CHRONELL_SUPABASE_URL / KEY in .env).')
  }
  const trimmed = email.trim().toLowerCase()
  if (!trimmed.includes('@')) {
    throw new Error('Ungültige E-Mail-Adresse.')
  }
  const { error } = await client.auth.signInWithOtp({
    email: trimmed,
    options: { shouldCreateUser: true }
  })
  if (error) {
    throw new Error(error.message)
  }
  lastSyncError = null
}

export async function signInProfileSyncWithMicrosoft365(): Promise<ProfileSyncStatus> {
  const session = await loginProfileSyncWithMicrosoft365()
  await writeStoredSession(session)
  await updateConfig({ profileDataMode: 'cloud' })
  lastSyncError = null
  return getProfileSyncStatus()
}

export async function verifyProfileSyncOtp(email: string, token: string): Promise<ProfileSyncStatus> {
  const client = createSupabaseAnonClient()
  if (!client) {
    throw new Error('Supabase ist nicht konfiguriert.')
  }
  const trimmedEmail = email.trim().toLowerCase()
  const trimmedToken = token.trim()
  if (!trimmedToken) {
    throw new Error('Bitte den Code aus der E-Mail eingeben.')
  }
  const { data, error } = await client.auth.verifyOtp({
    email: trimmedEmail,
    token: trimmedToken,
    type: 'email'
  })
  if (error || !data.session) {
    throw new Error(error?.message ?? 'Anmeldung fehlgeschlagen.')
  }
  await writeStoredSession(data.session)
  await updateConfig({ profileDataMode: 'cloud' })
  lastSyncError = null
  return getProfileSyncStatus()
}

export async function signOutProfileSync(): Promise<ProfileSyncStatus> {
  const client = await createAuthenticatedSupabaseClient()
  if (client) {
    await client.auth.signOut()
  }
  await clearStoredSession()
  await updateConfig({ profileDataMode: 'local' })
  lastSyncError = null
  return getProfileSyncStatus()
}

type SnapshotRow = {
  user_id: string
  device_id: string
  payload: SettingsBackupPayload
  payload_version: number
  updated_at: string
}

function parseRemotePayload(raw: unknown): SettingsBackupPayload | null {
  if (!raw || typeof raw !== 'object') return null
  const p = raw as SettingsBackupPayload
  if (typeof p.formatVersion !== 'number' || typeof p.exportedAt !== 'string') {
    return null
  }
  return p
}

export async function runProfileSyncNow(
  localStorage: Record<string, string>
): Promise<ProfileSyncRunResult> {
  const config = await loadConfig()
  if (config.profileDataMode !== 'cloud') {
    return { ok: false, error: 'Cloud-Sync ist deaktiviert (Modus: nur lokal).' }
  }

  const client = await createAuthenticatedSupabaseClient()
  if (!client) {
    return { ok: false, error: 'Nicht angemeldet. Bitte zuerst mit Microsoft 365 oder E-Mail-Code anmelden.' }
  }

  const stored = await readStoredSession()
  if (!stored?.user?.id) {
    return { ok: false, error: 'Keine gültige Supabase-Sitzung.' }
  }

  const deviceId = await ensureProfileDeviceId()
  let pulled = false
  let pushed = false
  let remoteUpdatedAt: string | null = null
  let pulledLocalStorage: Record<string, string> | undefined

  try {
    const { data: remoteRow, error: fetchErr } = await client
      .from('chronell_profile_snapshots')
      .select('payload, updated_at, device_id')
      .eq('user_id', stored.user.id)
      .maybeSingle()

    if (fetchErr) {
      throw new Error(fetchErr.message)
    }

    const row = remoteRow as Pick<SnapshotRow, 'payload' | 'updated_at' | 'device_id'> | null
    if (row?.updated_at) {
      remoteUpdatedAt = row.updated_at
    }

    const remoteMs = remoteUpdatedAt ? Date.parse(remoteUpdatedAt) : 0
    const localPulledAt = config.profileCloudLastPulledAt
      ? Date.parse(config.profileCloudLastPulledAt)
      : 0

    const shouldPull =
      row?.payload != null && Number.isFinite(remoteMs) && remoteMs > localPulledAt

    if (shouldPull) {
      const remotePayload = parseRemotePayload(row.payload)
      if (remotePayload) {
        await applyProfileSyncPayload(remotePayload)
        pulled = true
        pulledLocalStorage = remotePayload.localStorage
        await updateConfig({ profileCloudLastPulledAt: new Date().toISOString() })
      }
    }

    const localPayload = await buildProfileSyncPayload(localStorage)
    const upsertBody: SnapshotRow = {
      user_id: stored.user.id,
      device_id: deviceId,
      payload: localPayload,
      payload_version: SETTINGS_BACKUP_FORMAT_VERSION,
      updated_at: new Date().toISOString()
    }
    const { error: upsertErr } = await client.from('chronell_profile_snapshots').upsert(upsertBody, {
      onConflict: 'user_id'
    })
    if (upsertErr) {
      throw new Error(upsertErr.message)
    }
    pushed = true
    remoteUpdatedAt = upsertBody.updated_at
    await updateConfig({ profileCloudLastPushedAt: new Date().toISOString() })

    lastSyncError = null
    return {
      ok: true,
      pulled,
      pushed,
      remoteUpdatedAt,
      ...(pulledLocalStorage ? { localStorage: pulledLocalStorage } : {})
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    lastSyncError = message
    return { ok: false, error: message }
  }
}

export function defaultProfileDeviceLabel(): string {
  try {
    return hostname()
  } catch {
    return 'Chronell'
  }
}
