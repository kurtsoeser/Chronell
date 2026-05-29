/** Hintergrund-Poll fuer Mail-Sync (Sekunden). */
export const MAIL_POLL_INTERVAL_SECONDS_MIN = 30
export const MAIL_POLL_INTERVAL_SECONDS_MAX = 600
export const MAIL_POLL_INTERVAL_SECONDS_DEFAULT = 30

export const MAIL_POLL_INTERVAL_PRESETS = [30, 60, 120, 180, 300, 600] as const

export function clampMailPollIntervalSeconds(seconds: number): number {
  const s = Math.floor(seconds)
  return Math.min(Math.max(s, MAIL_POLL_INTERVAL_SECONDS_MIN), MAIL_POLL_INTERVAL_SECONDS_MAX)
}
