export type ContactCorrespondenceAccountScope = 'current_account' | 'all_accounts'

export interface ContactCorrespondenceSettings {
  accountScope: ContactCorrespondenceAccountScope
  includeDeletedJunk: boolean
  includeContactAliases: boolean
}

const STORAGE_KEY = 'mailclient.contactCorrespondence.settings.v1'

const DEFAULTS: ContactCorrespondenceSettings = {
  accountScope: 'current_account',
  includeDeletedJunk: false,
  includeContactAliases: true
}

export function readContactCorrespondenceSettings(): ContactCorrespondenceSettings {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULTS }
    const parsed = JSON.parse(raw) as Partial<ContactCorrespondenceSettings>
    return {
      accountScope:
        parsed.accountScope === 'all_accounts' ? 'all_accounts' : 'current_account',
      includeDeletedJunk: parsed.includeDeletedJunk === true,
      includeContactAliases: parsed.includeContactAliases !== false
    }
  } catch {
    return { ...DEFAULTS }
  }
}

export function persistContactCorrespondenceSettings(
  patch: Partial<ContactCorrespondenceSettings>
): ContactCorrespondenceSettings {
  const next = { ...readContactCorrespondenceSettings(), ...patch }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // ignore
  }
  return next
}
