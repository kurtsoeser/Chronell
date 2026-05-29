/** Darstellung des Konto-Avatars in der UI. */
export type AccountAvatarKind = 'provider' | 'initials' | 'icon' | 'custom'

/** Erlaubte Lucide-Icon-IDs (kebab-case) fuer `avatarIconId`. */
export const ACCOUNT_AVATAR_ICON_IDS = [
  'mail',
  'inbox',
  'building-2',
  'briefcase',
  'user',
  'users',
  'home',
  'school',
  'graduation-cap',
  'heart',
  'star',
  'zap',
  'globe',
  'cloud',
  'server',
  'database',
  'folder',
  'calendar',
  'phone',
  'message-circle',
  'send',
  'at-sign',
  'hash',
  'shield'
] as const

export type AccountAvatarIconId = (typeof ACCOUNT_AVATAR_ICON_IDS)[number]

const ICON_SET = new Set<string>(ACCOUNT_AVATAR_ICON_IDS as unknown as string[])

export function isAccountAvatarIconId(id: string): id is AccountAvatarIconId {
  return ICON_SET.has(id.trim())
}

export function normalizeAccountAvatarKind(raw: unknown): AccountAvatarKind | null {
  if (raw === 'provider' || raw === 'initials' || raw === 'icon' || raw === 'custom') {
    return raw
  }
  return null
}
