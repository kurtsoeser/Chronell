/** Erlaubte Hintergrund-Poll-Intervalle für Cloud-Profil-Sync (Sekunden). */
export const PROFILE_SYNC_POLL_INTERVAL_SECONDS_MIN = 120
export const PROFILE_SYNC_POLL_INTERVAL_SECONDS_MAX = 1800
export const PROFILE_SYNC_POLL_INTERVAL_SECONDS_DEFAULT = 300

export const PROFILE_SYNC_POLL_INTERVAL_PRESETS = [
  120, 180, 300, 600, 900, 1800
] as const

export function clampProfileSyncPollIntervalSeconds(seconds: number): number {
  let s = Math.floor(seconds)
  if (s === 90) s = PROFILE_SYNC_POLL_INTERVAL_SECONDS_DEFAULT
  return Math.min(
    Math.max(s, PROFILE_SYNC_POLL_INTERVAL_SECONDS_MIN),
    PROFILE_SYNC_POLL_INTERVAL_SECONDS_MAX
  )
}
