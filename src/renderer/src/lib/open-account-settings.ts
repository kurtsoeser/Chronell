export const OPEN_ACCOUNT_SETTINGS_EVENT = 'mailclient:open-account-settings'

export type OpenAccountSettingsTab =
  | 'general'
  | 'accounts'
  | 'mail'
  | 'calendar'
  | 'bookings'
  | 'contacts'
  | 'notes'
  | 'info'

export type OpenAccountSettingsDetail = {
  tab?: OpenAccountSettingsTab
  /** Unterpunkt im Mail-Tab (z. B. `rules`, `signatures`). */
  mailSubNav?: string
  /** Unterpunkt im Bookings-Tab (z. B. `personal`, `access`). */
  bookingsSubNav?: string
}

export function requestOpenAccountSettings(detail: OpenAccountSettingsDetail = {}): void {
  window.dispatchEvent(new CustomEvent(OPEN_ACCOUNT_SETTINGS_EVENT, { detail }))
}
