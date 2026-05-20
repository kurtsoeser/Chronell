import { shell } from 'electron'
import type { Session } from '@supabase/supabase-js'
import { createSupabaseAnonClient } from './supabase-session'
import { PROFILE_SYNC_OAUTH_REDIRECT_URI } from './profile-sync-oauth-constants'
import {
  startProfileSyncOAuthLoopback,
  waitForProfileSyncOAuthCallback,
  type ProfileSyncOAuthCallback
} from './profile-sync-oauth-loopback'

async function sessionFromCallback(
  client: NonNullable<ReturnType<typeof createSupabaseAnonClient>>,
  callback: ProfileSyncOAuthCallback
): Promise<Session> {
  if (callback.kind === 'tokens') {
    const { data, error } = await client.auth.setSession({
      access_token: callback.accessToken,
      refresh_token: callback.refreshToken
    })
    if (error || !data.session) {
      throw new Error(error?.message ?? 'Sitzung konnte nicht gesetzt werden.')
    }
    return data.session
  }

  const exchange = client.auth as {
    exchangeCodeForSession?: (code: string) => Promise<{
      data: { session: Session | null }
      error: { message: string } | null
    }>
  }

  if (typeof exchange.exchangeCodeForSession === 'function') {
    const { data, error } = await exchange.exchangeCodeForSession(callback.code)
    if (error || !data.session) {
      throw new Error(error?.message ?? 'Code-Austausch fehlgeschlagen.')
    }
    return data.session
  }

  throw new Error(
    'OAuth-Code erhalten, aber exchangeCodeForSession nicht verfügbar. Bitte Redirect-URL in Supabase prüfen.'
  )
}

function formatSupabaseAuthError(message: string): string {
  if (message.includes('provider is not enabled') || message.includes('Unsupported provider')) {
    return (
      'Azure ist im Supabase-Projekt „Chronell“ (rueobtpqmeagsqjqtbwn) nicht aktiviert. ' +
      'Dashboard → Authentication → Sign In / Providers → Azure → Enable einschalten und speichern. ' +
      'Häufige Ursache: Azure wurde im falschen Projekt (z. B. GigPal) konfiguriert.'
    )
  }
  if (message.includes('email from external provider')) {
    return (
      'Microsoft hat keine E-Mail an Supabase übermittelt. Bitte in Azure (App-Registrierung für Chronell Supabase Auth): ' +
      '(1) Token configuration → Add optional claim → ID token → email und preferred_username; ' +
      '(2) API permissions → Microsoft Graph → User.Read + openid, profile, email; ' +
      '(3) ggf. Admin consent erteilen. ' +
      'Alternativ in Supabase unter Azure: „Allow users without an email“ aktivieren (weniger ideal). ' +
      'Danach erneut anmelden (ggf. Abmelden bei Microsoft im Browser).'
    )
  }
  return message
}

/** Microsoft 365 / Azure über Supabase Auth (getrennt von Mail-OAuth). */
export async function loginProfileSyncWithMicrosoft365(): Promise<Session> {
  const client = createSupabaseAnonClient()
  if (!client) {
    throw new Error('Supabase ist nicht konfiguriert (CHRONELL_SUPABASE_URL / KEY in .env).')
  }

  const loopback = await startProfileSyncOAuthLoopback()

  const { data, error } = await client.auth.signInWithOAuth({
    provider: 'azure',
    options: {
      redirectTo: PROFILE_SYNC_OAUTH_REDIRECT_URI,
      skipBrowserRedirect: true,
      scopes: 'email openid profile offline_access',
      queryParams: {
        prompt: 'consent'
      }
    }
  })

  if (error) {
    loopback.cancel()
    throw new Error(formatSupabaseAuthError(error.message))
  }
  if (!data?.url) {
    loopback.cancel()
    throw new Error('Supabase hat keine Anmelde-URL zurückgegeben.')
  }

  await shell.openExternal(data.url)
  const callback = await waitForProfileSyncOAuthCallback(loopback)
  return sessionFromCallback(client, callback)
}
