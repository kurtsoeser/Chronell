export const OPEN_ACCOUNT_SETTINGS_EVENT = 'mailclient:open-account-settings'
export const CLOSE_ACCOUNT_SETTINGS_EVENT = 'mailclient:close-account-settings'

export type OpenAccountSettingsTab =
  | 'general'
  | 'accounts'
  | 'mail'
  | 'calendar'
  | 'bookings'
  | 'contacts'
  | 'notes'
  | 'tasks'
  | 'ai'
  | 'info'

export type OpenAccountSettingsDetail = {
  tab?: OpenAccountSettingsTab
  /** Unterpunkt im Allgemein-Tab (z. B. `appearance`, `language`). */
  generalSubNav?: string
  /** Unterpunkt im Mail-Tab (z. B. `rules`, `signatures`, `textSnippets`). */
  mailSubNav?: string
  /** Unterpunkt im Bookings-Tab (z. B. `personal`, `access`). */
  bookingsSubNav?: string
  /** Unterpunkt im KI-Tab (z. B. `connections`, `mail`, `compose`). */
  aiSubNav?: string
}

export function requestOpenAccountSettings(detail: OpenAccountSettingsDetail = {}): void {
  window.dispatchEvent(new CustomEvent(OPEN_ACCOUNT_SETTINGS_EVENT, { detail }))
}

export function requestCloseAccountSettings(): void {
  window.dispatchEvent(new CustomEvent(CLOSE_ACCOUNT_SETTINGS_EVENT))
}
