import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js'
import WebSocket from 'ws'
import { readSecure, writeSecure, deleteSecure } from '../secure-store'
import { getSupabasePublishableKey, getSupabaseUrl, isSupabaseConfigured } from './supabase-config'

const SESSION_STORE_KEY = 'chronell_supabase_session'

export interface StoredSupabaseSession {
  access_token: string
  refresh_token: string
  expires_at?: number
  user: { id: string; email?: string | null }
}

export async function readStoredSession(): Promise<StoredSupabaseSession | null> {
  const raw = await readSecure(SESSION_STORE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as StoredSupabaseSession
    if (typeof parsed.access_token !== 'string' || typeof parsed.refresh_token !== 'string') {
      return null
    }
    if (!parsed.user?.id) return null
    return parsed
  } catch {
    return null
  }
}

export async function writeStoredSession(session: Session): Promise<void> {
  const stored: StoredSupabaseSession = {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at ?? undefined,
    user: {
      id: session.user.id,
      email: session.user.email ?? null
    }
  }
  await writeSecure(SESSION_STORE_KEY, JSON.stringify(stored))
}

export async function clearStoredSession(): Promise<void> {
  await deleteSecure(SESSION_STORE_KEY)
}

export function createSupabaseAnonClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null
  const url = getSupabaseUrl()
  const key = getSupabasePublishableKey()
  if (!url || !key) return null
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    },
    // Electron Main = Node 20: natives WebSocket fehlt; Realtime braucht `ws`.
    realtime: {
      transport: WebSocket as unknown as import('@supabase/realtime-js').WebSocketLikeConstructor
    }
  })
}

export async function createAuthenticatedSupabaseClient(): Promise<SupabaseClient | null> {
  const base = createSupabaseAnonClient()
  const stored = await readStoredSession()
  if (!base || !stored) return null

  const { data, error } = await base.auth.setSession({
    access_token: stored.access_token,
    refresh_token: stored.refresh_token
  })
  if (error || !data.session) {
    await clearStoredSession()
    return null
  }

  if (
    data.session.access_token !== stored.access_token ||
    data.session.refresh_token !== stored.refresh_token
  ) {
    await writeStoredSession(data.session)
  }

  return base
}
