import type { AppConfig } from './types'

export type AvatarPreferencesPatch = Pick<
  AppConfig,
  | 'gravatarEnabled'
  | 'contactPhotoAvatarEnabled'
  | 'senderDomainAvatarEnabled'
  | 'accountProfileAvatarEnabled'
>

/** Gravatar (extern, opt-in). */
export function isGravatarEnabled(config: AppConfig | null | undefined): boolean {
  return config?.gravatarEnabled === true
}

/** Kontaktfotos aus dem lokalen Adressbuch (Microsoft/Google-Sync). */
export function isContactPhotoAvatarEnabled(config: AppConfig | null | undefined): boolean {
  return config?.contactPhotoAvatarEnabled !== false
}

/** Firmen-/Organisations-Logos anhand der Absender-Domain (Favicon, extern). */
export function isSenderDomainAvatarEnabled(config: AppConfig | null | undefined): boolean {
  return config?.senderDomainAvatarEnabled !== false
}

/** Profilbild des verbundenen Kontos, wenn Absender = eigenes Konto. */
export function isAccountProfileAvatarEnabled(config: AppConfig | null | undefined): boolean {
  return config?.accountProfileAvatarEnabled !== false
}

export function normalizeAvatarPreferencesPatch(
  raw: unknown
): Partial<AvatarPreferencesPatch> {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const out: Partial<AvatarPreferencesPatch> = {}
  if ('gravatarEnabled' in o) out.gravatarEnabled = Boolean(o.gravatarEnabled)
  if ('contactPhotoAvatarEnabled' in o) {
    out.contactPhotoAvatarEnabled = Boolean(o.contactPhotoAvatarEnabled)
  }
  if ('senderDomainAvatarEnabled' in o) {
    out.senderDomainAvatarEnabled = Boolean(o.senderDomainAvatarEnabled)
  }
  if ('accountProfileAvatarEnabled' in o) {
    out.accountProfileAvatarEnabled = Boolean(o.accountProfileAvatarEnabled)
  }
  return out
}
