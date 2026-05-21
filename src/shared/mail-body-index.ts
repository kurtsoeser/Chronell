/** Hintergrund-Indexierung: Geschwindigkeit der Mail-Body-Volltextsuche. */
export type MailBodyIndexSpeed = 'slow' | 'normal' | 'fast'

export interface MailBodyIndexSpeedPreset {
  batchSize: number
  intervalSeconds: number
}

export const MAIL_BODY_INDEX_SPEED_PRESETS: Record<MailBodyIndexSpeed, MailBodyIndexSpeedPreset> =
  {
    slow: { batchSize: 3, intervalSeconds: 120 },
    normal: { batchSize: 6, intervalSeconds: 90 },
    fast: { batchSize: 12, intervalSeconds: 45 }
  }

export const MAIL_BODY_INDEX_SPEED_OPTIONS: MailBodyIndexSpeed[] = ['slow', 'normal', 'fast']

export function normalizeMailBodyIndexSpeed(raw: unknown): MailBodyIndexSpeed {
  if (raw === 'slow' || raw === 'fast' || raw === 'normal') return raw
  return 'normal'
}

export function resolveMailBodyIndexPreset(speed: MailBodyIndexSpeed): MailBodyIndexSpeedPreset {
  return MAIL_BODY_INDEX_SPEED_PRESETS[speed] ?? MAIL_BODY_INDEX_SPEED_PRESETS.normal
}

export interface MailBodyIndexProgress {
  /** Noch ohne lokalen Body (DB). */
  pending: number
  /** In dieser App-Sitzung bereits indexiert. */
  indexedThisSession: number
  /** Fortschritt im aktuellen Batch (0 wenn zwischen Batches). */
  batchCurrent: number
  batchTotal: number
  active: boolean
}

export interface MailBodyIndexStatus {
  enabled: boolean
  speed: MailBodyIndexSpeed
  pending: number
  progress: MailBodyIndexProgress | null
}
