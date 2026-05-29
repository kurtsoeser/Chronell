import { create } from 'zustand'
import { isMailClientRuntimeComplete, warnMailClientMissingOnce } from '@/lib/mail-client-runtime'
import type { AccountAvatarIconId, AccountAvatarKind } from '@shared/account-avatar'
import type { AppConfig, AppConfigWeatherLocation, ConnectedAccount, PatchAccountInput } from '@shared/types'
import { safeSetCalendarTimeZone, safeSetGoogleClientId, safeSetWeatherLocation } from '@/lib/config-invoke'

/** Entfernt den Konten-Änderungs-Listener (auch nach Vite-HMR, siehe window-Hook unten). */
let disposeAccountsChanged: (() => void) | undefined

type AccountsChangedWindow = Window & {
  __chronellDisposeAccountsChanged?: () => void
}

async function loadAccountDisplayAvatarDataUrls(
  accounts: ConnectedAccount[]
): Promise<Record<string, string>> {
  const pairs = await Promise.all(
    accounts.map(async (a) => {
      try {
        const url = await window.mailClient.auth.getAccountDisplayAvatarDataUrl(a.id)
        return url ? ([a.id, url] as const) : null
      } catch {
        return null
      }
    })
  )
  return Object.fromEntries(pairs.filter((p): p is [string, string] => p !== null))
}

async function loadAccountPhotoMaps(accounts: ConnectedAccount[]): Promise<{
  profilePhotoDataUrls: Record<string, string>
  accountDisplayAvatarDataUrls: Record<string, string>
}> {
  const [profilePhotoDataUrls, accountDisplayAvatarDataUrls] = await Promise.all([
    loadProfilePhotoDataUrls(accounts),
    loadAccountDisplayAvatarDataUrls(accounts)
  ])
  return { profilePhotoDataUrls, accountDisplayAvatarDataUrls }
}

function attachAccountsChangedListener(
  applyAccounts: (
    next: ConnectedAccount[],
    profilePhotoDataUrls: Record<string, string>,
    accountDisplayAvatarDataUrls: Record<string, string>
  ) => void
): void {
  disposeAccountsChanged?.()
  const w = window as AccountsChangedWindow
  w.__chronellDisposeAccountsChanged?.()
  w.__chronellDisposeAccountsChanged = undefined

  const onChanged = window.mailClient.events?.onAccountsChanged
  if (typeof onChanged !== 'function') return

  disposeAccountsChanged = onChanged((next) => {
    void (async (): Promise<void> => {
      try {
        const maps = await loadAccountPhotoMaps(next)
        applyAccounts(next, maps.profilePhotoDataUrls, maps.accountDisplayAvatarDataUrls)
      } catch (e) {
        console.warn('[accounts] Kontenbilder konnten nicht geladen werden:', e)
        applyAccounts(next, {}, {})
      }
    })()
  })
  w.__chronellDisposeAccountsChanged = disposeAccountsChanged
}

async function loadProfilePhotoDataUrls(accounts: ConnectedAccount[]): Promise<Record<string, string>> {
  const withPhoto = accounts.filter((a) => a.profilePhotoFile)
  const pairs = await Promise.all(
    withPhoto.map(async (a) => {
      try {
        const url = await window.mailClient.auth.getProfilePhotoDataUrl(a.id)
        return url ? ([a.id, url] as const) : null
      } catch {
        return null
      }
    })
  )
  return Object.fromEntries(pairs.filter((p): p is [string, string] => p !== null))
}

interface AccountsState {
  accounts: ConnectedAccount[]
  /** Data-URLs der Provider-Profilfotos, keyed by account id */
  profilePhotoDataUrls: Record<string, string>
  /** Anzeige-Avatar (Provider oder eigenes Bild), keyed by account id */
  accountDisplayAvatarDataUrls: Record<string, string>
  config: AppConfig | null
  loading: boolean
  error: string | null

  initialize: () => Promise<void>
  setMicrosoftClientId: (clientId: string) => Promise<void>
  setGoogleClientId: (clientId: string, clientSecret?: string | null) => Promise<void>
  setNotionCredentials: (clientId: string, clientSecret?: string | null) => Promise<void>
  setSyncWindowDays: (days: number | null) => Promise<void>
  setMailPollIntervalSeconds: (seconds: number) => Promise<void>
  setMicrosoftMailTransport: (
    mode: import('@shared/types').MicrosoftMailTransport
  ) => Promise<void>
  setMailBodyIndexSettings: (patch: {
    enabled?: boolean
    speed?: import('@shared/mail-body-index').MailBodyIndexSpeed
  }) => Promise<void>
  setAutoLoadImages: (value: boolean) => Promise<void>
  setGravatarEnabled: (value: boolean) => Promise<void>
  setAvatarPreferences: (
    patch: Partial<import('@shared/avatar-preferences').AvatarPreferencesPatch>
  ) => Promise<void>
  setCalendarTimeZone: (iana: string | null) => Promise<void>
  setWeatherLocation: (loc: AppConfigWeatherLocation | null) => Promise<void>
  addMicrosoftAccount: () => Promise<void>
  addGoogleAccount: () => Promise<void>
  refreshMicrosoftAccount: (id: string) => Promise<void>
  refreshGoogleAccount: (id: string) => Promise<void>
  removeAccount: (id: string) => Promise<void>
  patchAccountColor: (accountId: string, color: string) => Promise<void>
  patchAccountAvatarKind: (accountId: string, kind: AccountAvatarKind) => Promise<void>
  patchAccountAvatarIcon: (accountId: string, iconId: AccountAvatarIconId) => Promise<void>
  pickAccountCustomAvatar: (accountId: string) => Promise<boolean>
  patchAccountCalendarLoadAhead: (
    accountId: string,
    value: number | null | 'default'
  ) => Promise<void>
  patchAccountSignatures: (
    accountId: string,
    patch: Pick<PatchAccountInput, 'signatureTemplates' | 'defaultSignatureTemplateId'>
  ) => Promise<void>
  patchAccountBookWithMeUrl: (accountId: string, bookWithMeUrl: string | null) => Promise<void>
  dismissWorkflowMailFoldersIntro: () => Promise<void>
  setFirstRunSetupCompleted: (value: boolean) => Promise<void>
}

export const useAccountsStore = create<AccountsState>((set, get) => ({
  accounts: [],
  profilePhotoDataUrls: {},
  accountDisplayAvatarDataUrls: {},
  config: null,
  loading: false,
  error: null,

  async initialize(): Promise<void> {
    if (typeof window === 'undefined' || !isMailClientRuntimeComplete()) {
      warnMailClientMissingOnce(
        'accounts-store-init',
        '[accounts] `window.mailClient` unvollständig: Konten/Config nicht geladen.'
      )
      return
    }
    set({ loading: true, error: null })
    try {
      const [accounts, config] = await Promise.all([
        window.mailClient.auth.listAccounts(),
        window.mailClient.config.get()
      ])
      let profilePhotoDataUrls: Record<string, string> = {}
      let accountDisplayAvatarDataUrls: Record<string, string> = {}
      try {
        const maps = await loadAccountPhotoMaps(accounts)
        profilePhotoDataUrls = maps.profilePhotoDataUrls
        accountDisplayAvatarDataUrls = maps.accountDisplayAvatarDataUrls
      } catch (e) {
        console.warn('[accounts] Kontenbilder konnten nicht geladen werden:', e)
      }
      set({ accounts, config, profilePhotoDataUrls, accountDisplayAvatarDataUrls, loading: false })

      attachAccountsChangedListener((next, profileUrls, displayUrls) => {
        set({
          accounts: next,
          profilePhotoDataUrls: profileUrls,
          accountDisplayAvatarDataUrls: displayUrls
        })
      })
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : String(e) })
    }
  },

  async setGoogleClientId(clientId: string, clientSecret?: string | null): Promise<void> {
    set({ error: null })
    try {
      const config = await safeSetGoogleClientId(clientId, clientSecret)
      set({ config })
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) })
      throw e
    }
  },

  async setNotionCredentials(clientId: string, clientSecret?: string | null): Promise<void> {
    set({ error: null })
    try {
      const config = await window.mailClient.config.setNotionCredentials(clientId, clientSecret)
      set({ config })
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) })
      throw e
    }
  },

  async addGoogleAccount(): Promise<void> {
    set({ loading: true, error: null })
    try {
      const account = await window.mailClient.auth.addGoogle()
      const existing = get().accounts.filter((a) => a.id !== account.id)
      const nextAccounts = [...existing, account]
      const maps = await loadAccountPhotoMaps(nextAccounts)
      set({
        accounts: nextAccounts,
        profilePhotoDataUrls: maps.profilePhotoDataUrls,
        accountDisplayAvatarDataUrls: maps.accountDisplayAvatarDataUrls,
        loading: false
      })
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : String(e) })
      throw e
    }
  },

  async refreshGoogleAccount(id: string): Promise<void> {
    set({ error: null })
    try {
      await window.mailClient.auth.refreshGoogle(id)
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) })
      throw e
    }
  },

  async setMicrosoftClientId(clientId: string): Promise<void> {
    set({ error: null })
    try {
      const config = await window.mailClient.config.setMicrosoftClientId(clientId)
      set({ config })
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) })
      throw e
    }
  },

  async setSyncWindowDays(days: number | null): Promise<void> {
    set({ error: null })
    try {
      const config = await window.mailClient.config.setSyncWindowDays(days)
      set({ config })
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) })
      throw e
    }
  },

  async setMailPollIntervalSeconds(seconds: number): Promise<void> {
    set({ error: null })
    try {
      const config = await window.mailClient.config.setMailPollIntervalSeconds(seconds)
      set({ config })
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) })
      throw e
    }
  },

  async setMicrosoftMailTransport(
    mode: import('@shared/types').MicrosoftMailTransport
  ): Promise<void> {
    set({ error: null })
    try {
      const config = await window.mailClient.config.setMicrosoftMailTransport(mode)
      set({ config })
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) })
      throw e
    }
  },

  async setMailBodyIndexSettings(patch: {
    enabled?: boolean
    speed?: import('@shared/mail-body-index').MailBodyIndexSpeed
  }): Promise<void> {
    set({ error: null })
    try {
      await window.mailClient.mailBodyIndex.setSettings(patch)
      const config = await window.mailClient.config.get()
      set({ config })
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) })
      throw e
    }
  },

  async setAutoLoadImages(value: boolean): Promise<void> {
    set({ error: null })
    try {
      const config = await window.mailClient.config.setAutoLoadImages(value)
      set({ config })
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) })
      throw e
    }
  },

  async setGravatarEnabled(value: boolean): Promise<void> {
    await get().setAvatarPreferences({ gravatarEnabled: value })
  },

  async setAvatarPreferences(
    patch: Partial<import('@shared/avatar-preferences').AvatarPreferencesPatch>
  ): Promise<void> {
    set({ error: null })
    try {
      const config = await window.mailClient.config.setAvatarPreferences(patch)
      set({ config })
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) })
      throw e
    }
  },

  async setCalendarTimeZone(iana: string | null): Promise<void> {
    set({ error: null })
    try {
      const config = await safeSetCalendarTimeZone(iana)
      set({ config })
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) })
      throw e
    }
  },

  async setWeatherLocation(loc: AppConfigWeatherLocation | null): Promise<void> {
    set({ error: null })
    try {
      const config = await safeSetWeatherLocation(loc)
      set({ config })
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) })
      throw e
    }
  },

  async addMicrosoftAccount(): Promise<void> {
    set({ loading: true, error: null })
    try {
      const account = await window.mailClient.auth.addMicrosoft()
      const existing = get().accounts.filter((a) => a.id !== account.id)
      const nextAccounts = [...existing, account]
      const maps = await loadAccountPhotoMaps(nextAccounts)
      set({
        accounts: nextAccounts,
        profilePhotoDataUrls: maps.profilePhotoDataUrls,
        accountDisplayAvatarDataUrls: maps.accountDisplayAvatarDataUrls,
        loading: false
      })
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : String(e) })
      throw e
    }
  },

  async refreshMicrosoftAccount(id: string): Promise<void> {
    set({ error: null })
    try {
      await window.mailClient.auth.refreshMicrosoft(id)
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) })
      throw e
    }
  },

  async removeAccount(id: string): Promise<void> {
    set({ error: null })
    try {
      const next = await window.mailClient.auth.remove(id)
      const maps = await loadAccountPhotoMaps(next)
      set({
        accounts: next,
        profilePhotoDataUrls: maps.profilePhotoDataUrls,
        accountDisplayAvatarDataUrls: maps.accountDisplayAvatarDataUrls
      })
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) })
      throw e
    }
  },

  async patchAccountColor(accountId: string, color: string): Promise<void> {
    set({ error: null })
    try {
      await window.mailClient.auth.patchAccount({ accountId, color })
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) })
      throw e
    }
  },

  async patchAccountAvatarKind(accountId: string, kind: AccountAvatarKind): Promise<void> {
    set({ error: null })
    try {
      await window.mailClient.auth.patchAccount({ accountId, avatarKind: kind })
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) })
      throw e
    }
  },

  async patchAccountAvatarIcon(accountId: string, iconId: AccountAvatarIconId): Promise<void> {
    set({ error: null })
    try {
      await window.mailClient.auth.patchAccount({ accountId, avatarIconId: iconId })
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) })
      throw e
    }
  },

  async pickAccountCustomAvatar(accountId: string): Promise<boolean> {
    set({ error: null })
    try {
      const result = await window.mailClient.auth.pickAccountCustomAvatar(accountId)
      if (result && typeof result === 'object' && 'cancelled' in result) {
        return false
      }
      return true
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) })
      throw e
    }
  },

  async patchAccountCalendarLoadAhead(
    accountId: string,
    value: number | null | 'default'
  ): Promise<void> {
    set({ error: null })
    try {
      await window.mailClient.auth.patchAccount({ accountId, calendarLoadAheadDays: value })
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) })
      throw e
    }
  },

  async patchAccountSignatures(
    accountId: string,
    patch: Pick<PatchAccountInput, 'signatureTemplates' | 'defaultSignatureTemplateId'>
  ): Promise<void> {
    set({ error: null })
    try {
      const updated = await window.mailClient.auth.patchAccount({ accountId, ...patch })
      set((state) => ({
        accounts: state.accounts.map((a) => (a.id === accountId ? updated : a))
      }))
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) })
      throw e
    }
  },

  async patchAccountBookWithMeUrl(accountId: string, bookWithMeUrl: string | null): Promise<void> {
    set({ error: null })
    try {
      await window.mailClient.auth.patchAccount({ accountId, bookWithMeUrl })
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) })
      throw e
    }
  },

  async dismissWorkflowMailFoldersIntro(): Promise<void> {
    set({ error: null })
    try {
      const config = await window.mailClient.config.setWorkflowMailFoldersIntroDismissed(true)
      set({ config })
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) })
      throw e
    }
  },

  async setFirstRunSetupCompleted(value: boolean): Promise<void> {
    set({ error: null })
    try {
      const config = await window.mailClient.config.setFirstRunSetupCompleted(value)
      set({ config })
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) })
      throw e
    }
  }
}))
