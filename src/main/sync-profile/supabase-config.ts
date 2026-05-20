/**
 * Supabase-Verbindung für Chronell-Profil-Sync.
 * URL und Publishable Key aus Build-Umgebung (siehe .env.example).
 */

export function getSupabaseUrl(): string | null {
  const v = process.env.CHRONELL_SUPABASE_URL?.trim()
  return v && v.length > 0 ? v : null
}

export function getSupabasePublishableKey(): string | null {
  const v = process.env.CHRONELL_SUPABASE_PUBLISHABLE_KEY?.trim()
  return v && v.length > 0 ? v : null
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseUrl() != null && getSupabasePublishableKey() != null
}
