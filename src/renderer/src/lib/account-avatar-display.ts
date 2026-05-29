import type { AccountAvatarKind } from '@shared/account-avatar'
import type { ConnectedAccount } from '@shared/types'

export function effectiveAccountAvatarKind(account: ConnectedAccount): AccountAvatarKind {
  return account.avatarKind ?? 'provider'
}

/** Bild-URL fuer Konto-Avatar (Provider-Foto oder eigenes Bild), sonst `undefined`. */
export function accountDisplayAvatarImageSrc(
  account: ConnectedAccount,
  displayAvatarDataUrls: Record<string, string>
): string | undefined {
  const kind = effectiveAccountAvatarKind(account)
  if (kind === 'initials' || kind === 'icon') return undefined
  return displayAvatarDataUrls[account.id]
}
