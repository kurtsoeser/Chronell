import type { AppConfig, SettingsBackupPayload } from './types'

export interface SettingsBackupSummaryGroup {
  label: string
  count: number
}

export interface SettingsBackupContentsSummary {
  formatVersion: number
  exportedAt: string
  appVersion: string
  localStorageKeyCount: number
  localStorageGroups: SettingsBackupSummaryGroup[]
  configHighlights: string[]
  database: {
    mailRules: number
    workflowBoards: number
    quickSteps: number
    mailTemplates: number
    metaFolders: number
    vipSenders: number
    workflowMailFolders: number
    composeScheduledPending: number
    userNotes: number
    noteSections: number
    userNoteLinks: number
    entityLinks: number
    fullEntityLinks: number
    calendarColorOverrides: number
  }
  secure: {
    accountPreferences: number
    accountsWithSignatures: number
    accountsWithSharedMailboxes: number
    notionFavorites: number
    aiConnectionsIncluded: boolean
    aiDismissedPairs: number
  }
  warnings: string[]
  hasDatabaseExtras: boolean
  hasSecureExtras: boolean
}

function groupLocalStorageKeys(keys: string[]): SettingsBackupSummaryGroup[] {
  const groups = new Map<string, number>()
  for (const k of keys) {
    let label = 'other'
    if (k.startsWith('mailclient.')) {
      const rest = k.slice('mailclient.'.length)
      label = rest.split('.')[0] || 'mailclient'
    } else if (k.startsWith('mailclient:')) {
      label = k.split(':')[0] ?? k
    }
    groups.set(label, (groups.get(label) ?? 0) + 1)
  }
  return [...groups.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({ label, count }))
}

function configHighlightLines(config: AppConfig): string[] {
  const lines: string[] = []
  if (config.syncWindowDays != null) {
    lines.push(`syncWindowDays: ${config.syncWindowDays}`)
  }
  if (config.mailPollIntervalSeconds != null) {
    lines.push(`mailPollIntervalSeconds: ${config.mailPollIntervalSeconds}`)
  }
  if (config.mailBodyIndexEnabled != null) {
    lines.push(`mailBodyIndexEnabled: ${config.mailBodyIndexEnabled}`)
  }
  if (config.mailBodyIndexSpeed) {
    lines.push(`mailBodyIndexSpeed: ${config.mailBodyIndexSpeed}`)
  }
  lines.push(`autoLoadImages: ${config.autoLoadImages}`)
  if (config.gravatarEnabled != null) {
    lines.push(`gravatarEnabled: ${config.gravatarEnabled}`)
  }
  if (config.launchOnLogin != null) {
    lines.push(`launchOnLogin: ${config.launchOnLogin}`)
  }
  if (config.calendarTimeZone) {
    lines.push(`calendarTimeZone: ${config.calendarTimeZone}`)
  }
  if (config.weatherLocationName) {
    lines.push(`weather: ${config.weatherLocationName}`)
  }
  if (config.microsoftClientId?.trim()) {
    lines.push('microsoftClientId: (gesetzt)')
  }
  if (config.googleClientId?.trim()) {
    lines.push('googleClientId: (gesetzt)')
  }
  if (config.notionClientId?.trim()) {
    lines.push('notionClientId: (gesetzt)')
  }
  return lines
}

export function summarizeSettingsBackupPayload(
  payload: SettingsBackupPayload
): SettingsBackupContentsSummary {
  const keys = Object.keys(payload.localStorage ?? {})
  const de = payload.databaseExtras
  const se = payload.secureExtras
  const prefs = se?.accountPreferences ?? []

  const warnings: string[] = []
  if (payload.formatVersion < 2) {
    warnings.push('format_v1_no_secure_extras')
  }
  if (!de) {
    warnings.push('no_database_extras')
  }
  warnings.push('no_oauth_tokens')
  warnings.push('no_api_keys')
  if (payload.config.microsoftClientId?.trim() || payload.config.googleClientSecret?.trim()) {
    warnings.push('may_contain_client_secrets')
  }

  return {
    formatVersion: payload.formatVersion,
    exportedAt: payload.exportedAt,
    appVersion: payload.appVersion,
    localStorageKeyCount: keys.length,
    localStorageGroups: groupLocalStorageKeys(keys),
    configHighlights: configHighlightLines(payload.config),
    database: {
      mailRules: de?.mailRules?.length ?? 0,
      workflowBoards: de?.workflowBoards?.length ?? 0,
      quickSteps: de?.quickSteps?.length ?? 0,
      mailTemplates: de?.mailTemplates?.length ?? 0,
      metaFolders: de?.metaFolders?.length ?? 0,
      vipSenders: de?.vipSenders?.length ?? 0,
      workflowMailFolders: de?.workflowMailFolders?.length ?? 0,
      composeScheduledPending: de?.composeScheduledPending?.length ?? 0,
      userNotes: de?.userNotes?.length ?? 0,
      noteSections: de?.noteSections?.length ?? 0,
      userNoteLinks: de?.userNoteLinks?.length ?? 0,
      entityLinks: de?.entityLinks?.length ?? 0,
      fullEntityLinks: de?.fullEntityLinks?.length ?? 0,
      calendarColorOverrides: de?.calendarColorOverrides?.length ?? 0
    },
    secure: {
      accountPreferences: prefs.length,
      accountsWithSignatures: prefs.filter(
        (p) => Array.isArray(p.signatureTemplates) && p.signatureTemplates.length > 0
      ).length,
      accountsWithSharedMailboxes: prefs.filter(
        (p) => Array.isArray(p.sharedMailboxSendAs) && p.sharedMailboxSendAs.length > 0
      ).length,
      notionFavorites: se?.notionDestinations?.favorites?.length ?? 0,
      aiConnectionsIncluded: Boolean(se?.aiConnections?.settings),
      aiDismissedPairs: se?.aiConnections?.dismissedPairs?.length ?? 0
    },
    warnings,
    hasDatabaseExtras: de != null,
    hasSecureExtras: se != null
  }
}
