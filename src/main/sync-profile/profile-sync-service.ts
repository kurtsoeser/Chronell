import { hostname } from 'node:os'
import { randomUUID } from 'node:crypto'
import type {
  ProfileDataMode,
  ProfileSyncResolution,
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
import {
  pullNoteAttachmentsFromCloud,
  pushLocalNoteAttachmentsToCloud
} from './profile-sync-attachments'
import { broadcastProfileSyncStatus } from '../ipc/ipc-broadcasts'

let lastSyncError: string | null = null
let syncInProgress = false

/** Vermeidet zusaetzliche Supabase-Reads beim Status-Broadcast direkt nach einem Sync. */
let remoteUpdatedAtCache: { value: string | null; at: number } | null = null
const REMOTE_STATUS_CACHE_MS = 45_000

function setRemoteUpdatedAtCache(value: string | null): void {
  remoteUpdatedAtCache = { value, at: Date.now() }
}

function readCachedRemoteUpdatedAt(): string | null | undefined {
  if (!remoteUpdatedAtCache) return undefined
  if (Date.now() - remoteUpdatedAtCache.at > REMOTE_STATUS_CACHE_MS) return undefined
  return remoteUpdatedAtCache.value
}

async function ensureProfileDeviceId(): Promise<string> {
  const config = await loadConfig()
  const existing = config.profileDeviceId?.trim()
  if (existing) return existing
  const id = randomUUID()
  await updateConfig({ profileDeviceId: id })
  return id
}

function computeConflictRemoteNewer(
  remoteMs: number,
  localPulledAt: number,
  localPushedAt: number
): boolean {
  if (!Number.isFinite(remoteMs) || remoteMs <= 0) return false
  return remoteMs > localPulledAt && remoteMs > localPushedAt
}

/** Cloud ist neuer als letzter Pull — Auto-Sync wartet auf Nutzerwahl. */
function computeConflictPending(
  remoteMs: number,
  localPulledAt: number,
  localPushedAt: number,
  localDirty: boolean,
  hasRemote: boolean
): boolean {
  if (!hasRemote || !Number.isFinite(remoteMs) || remoteMs <= 0) return false
  if (remoteMs <= localPulledAt) {
    return localDirty && localPushedAt > 0 && remoteMs > localPushedAt
  }
  if (localDirty) return true
  if (localPushedAt > 0 && remoteMs > localPushedAt) return true
  return true
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
  const cachedRemote = readCachedRemoteUpdatedAt()
  if (cachedRemote !== undefined) {
    remoteUpdatedAt = cachedRemote
  } else if (isSupabaseConfigured() && stored) {
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
        setRemoteUpdatedAtCache(remoteUpdatedAt)
      }
    } catch {
      /* optional */
    }
  }

  const remoteMs = remoteUpdatedAt ? Date.parse(remoteUpdatedAt) : 0
  const localPulledAt = config.profileCloudLastPulledAt
    ? Date.parse(config.profileCloudLastPulledAt)
    : 0
  const localPushedAt = config.profileCloudLastPushedAt
    ? Date.parse(config.profileCloudLastPushedAt)
    : 0
  const localDirty = Boolean(config.profileCloudLocalDirtyAt?.trim())
  const hasRemote = remoteUpdatedAt != null
  const conflictRemoteNewer = computeConflictRemoteNewer(remoteMs, localPulledAt, localPushedAt)
  const conflictPending = computeConflictPending(
    remoteMs,
    localPulledAt,
    localPushedAt,
    localDirty,
    hasRemote
  )

  return {
    configured: isSupabaseConfigured(),
    dataMode: config.profileDataMode ?? 'local',
    deviceId,
    signedIn: stored != null,
    session,
    lastPulledAt: config.profileCloudLastPulledAt ?? null,
    lastPushedAt: config.profileCloudLastPushedAt ?? null,
    remoteUpdatedAt,
    lastError: lastSyncError,
    syncing: syncInProgress,
    conflictRemoteNewer,
    conflictPending,
    autoSyncActive: config.profileDataMode === 'cloud' && stored != null
  }
}

export async function setProfileDataMode(mode: ProfileDataMode): Promise<ProfileSyncStatus> {
  await updateConfig({ profileDataMode: mode })
  lastSyncError = null
  if (mode === 'cloud') {
    const { startProfileSyncRunner } = await import('./profile-sync-runner')
    startProfileSyncRunner()
  } else {
    const { stopProfileSyncRunner } = await import('./profile-sync-runner')
    stopProfileSyncRunner()
  }
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
  await updateConfig({ profileDataMode: 'cloud', profileCloudLocalDirtyAt: new Date().toISOString() })
  lastSyncError = null
  const { startProfileSyncRunner } = await import('./profile-sync-runner')
  startProfileSyncRunner()
  void runProfileSyncInternal({ localStorage: {}, source: 'auto' })
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
  await updateConfig({ profileDataMode: 'cloud', profileCloudLocalDirtyAt: new Date().toISOString() })
  lastSyncError = null
  const { startProfileSyncRunner } = await import('./profile-sync-runner')
  startProfileSyncRunner()
  return getProfileSyncStatus()
}

export async function signOutProfileSync(): Promise<ProfileSyncStatus> {
  const client = await createAuthenticatedSupabaseClient()
  if (client) {
    await client.auth.signOut()
  }
  await clearStoredSession()
  await updateConfig({ profileDataMode: 'local', profileCloudLocalDirtyAt: null })
  lastSyncError = null
  const { stopProfileSyncRunner } = await import('./profile-sync-runner')
  stopProfileSyncRunner()
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

export interface RunProfileSyncOptions {
  localStorage: Record<string, string>
  source: 'manual' | 'auto'
  resolution?: ProfileSyncResolution
}

export async function runProfileSyncInternal(
  options: RunProfileSyncOptions
): Promise<ProfileSyncRunResult> {
  if (syncInProgress) {
    return { ok: false, error: 'Sync läuft bereits.' }
  }

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

  syncInProgress = true
  void broadcastProfileSyncStatus()

  const deviceId = await ensureProfileDeviceId()
  let pulled = false
  let pushed = false
  let remoteUpdatedAt: string | null = null
  let pulledLocalStorage: Record<string, string> | undefined
  let attachmentsUploaded = 0
  let attachmentsDownloaded = 0

  try {
    const resolution = options.resolution ?? 'auto'
    const useLightPoll = options.source === 'auto' && resolution === 'auto'

    type RemoteRow = Pick<SnapshotRow, 'payload' | 'updated_at' | 'device_id'>
    let row: RemoteRow | null = null

    const { data: lightRow, error: lightErr } = await client
      .from('chronell_profile_snapshots')
      .select(useLightPoll ? 'updated_at' : 'payload, updated_at, device_id')
      .eq('user_id', stored.user.id)
      .maybeSingle()

    if (lightErr) {
      throw new Error(lightErr.message)
    }

    row = (lightRow as RemoteRow | null) ?? null
    if (row?.updated_at) {
      remoteUpdatedAt = row.updated_at
      setRemoteUpdatedAtCache(remoteUpdatedAt)
    }

    const remoteMs = remoteUpdatedAt ? Date.parse(remoteUpdatedAt) : 0
    const localPulledAt = config.profileCloudLastPulledAt
      ? Date.parse(config.profileCloudLastPulledAt)
      : 0
    const localPushedAt = config.profileCloudLastPushedAt
      ? Date.parse(config.profileCloudLastPushedAt)
      : 0
    const localDirty = Boolean(config.profileCloudLocalDirtyAt?.trim())
    const hasRemote = remoteUpdatedAt != null
    const conflictRemoteNewer = computeConflictRemoteNewer(remoteMs, localPulledAt, localPushedAt)
    const conflictPending = computeConflictPending(
      remoteMs,
      localPulledAt,
      localPushedAt,
      localDirty,
      hasRemote
    )

    if (resolution === 'auto' && conflictPending) {
      lastSyncError = null
      return {
        ok: true,
        pulled: false,
        pushed: false,
        remoteUpdatedAt,
        conflictRemoteNewer,
        skippedConflict: true,
        attachmentsUploaded: 0,
        attachmentsDownloaded: 0
      }
    }

    const forcePull = resolution === 'pull'
    const forcePush = resolution === 'push'

    const wouldPull =
      forcePull ||
      (resolution === 'auto' &&
        hasRemote &&
        Number.isFinite(remoteMs) &&
        remoteMs > localPulledAt &&
        !localDirty)

    const wouldPush =
      forcePush ||
      (resolution === 'auto' &&
        (localDirty ||
          !hasRemote ||
          !Number.isFinite(remoteMs) ||
          (Number.isFinite(remoteMs) && remoteMs <= localPulledAt)))

    if (useLightPoll && !wouldPull && !wouldPush) {
      lastSyncError = null
      return {
        ok: true,
        pulled: false,
        pushed: false,
        remoteUpdatedAt,
        conflictRemoteNewer,
        attachmentsUploaded: 0,
        attachmentsDownloaded: 0
      }
    }

    if (useLightPoll && wouldPull && row?.payload == null) {
      const { data: fullRow, error: fullErr } = await client
        .from('chronell_profile_snapshots')
        .select('payload, updated_at, device_id')
        .eq('user_id', stored.user.id)
        .maybeSingle()
      if (fullErr) {
        throw new Error(fullErr.message)
      }
      row = (fullRow as RemoteRow | null) ?? null
      if (row?.updated_at) {
        remoteUpdatedAt = row.updated_at
        setRemoteUpdatedAtCache(remoteUpdatedAt)
      }
    }

    const shouldPull = wouldPull && row?.payload != null

    if (shouldPull && row?.payload != null) {
      const remotePayload = parseRemotePayload(row.payload)
      if (remotePayload) {
        await applyProfileSyncPayload(remotePayload)
        pulled = true
        pulledLocalStorage = remotePayload.localStorage
        attachmentsDownloaded = await pullNoteAttachmentsFromCloud(client, stored.user.id)
        await updateConfig({
          profileCloudLastPulledAt: new Date().toISOString(),
          profileCloudLocalDirtyAt: null
        })
      }
    }

    const configAfterPull = await loadConfig()
    const localDirtyAfterPull = Boolean(configAfterPull.profileCloudLocalDirtyAt?.trim())
    const localPayload = await buildProfileSyncPayload(options.localStorage)

    const shouldPush =
      forcePush ||
      (resolution === 'auto' &&
        (localDirtyAfterPull ||
          !hasRemote ||
          !Number.isFinite(remoteMs) ||
          (Number.isFinite(remoteMs) && remoteMs <= localPulledAt)))

    if (shouldPush) {
      attachmentsUploaded = await pushLocalNoteAttachmentsToCloud(client, stored.user.id)
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
      setRemoteUpdatedAtCache(remoteUpdatedAt)
      await updateConfig({
        profileCloudLastPushedAt: new Date().toISOString(),
        profileCloudLocalDirtyAt: null
      })
    }

    lastSyncError = null
    return {
      ok: true,
      pulled,
      pushed,
      remoteUpdatedAt,
      conflictRemoteNewer,
      attachmentsUploaded,
      attachmentsDownloaded,
      ...(pulledLocalStorage ? { localStorage: pulledLocalStorage } : {})
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    lastSyncError = message
    return { ok: false, error: message }
  } finally {
    syncInProgress = false
    void broadcastProfileSyncStatus()
  }
}

export async function runProfileSyncNow(
  localStorage: Record<string, string>
): Promise<ProfileSyncRunResult> {
  return runProfileSyncInternal({ localStorage, source: 'manual', resolution: 'auto' })
}

export async function resolveProfileSyncConflict(
  resolution: 'pull' | 'push',
  localStorage: Record<string, string>
): Promise<ProfileSyncRunResult> {
  return runProfileSyncInternal({ localStorage, source: 'manual', resolution })
}

export function defaultProfileDeviceLabel(): string {
  try {
    return hostname()
  } catch {
    return 'Chronell'
  }
}
