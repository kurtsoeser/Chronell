import type { AppConfig, SettingsBackupPayload } from '@shared/types'
import { loadConfig } from '../config'
import {
  applySettingsBackupPayload,
  buildSettingsBackupPayload
} from '../settings-backup-service'

function pickCloudSafeConfig(source: AppConfig, overlay: AppConfig): AppConfig {
  const local = source
  return {
    ...overlay,
    microsoftClientId: local.microsoftClientId,
    googleClientId: local.googleClientId,
    googleClientSecret: local.googleClientSecret,
    notionClientId: local.notionClientId,
    notionClientSecret: local.notionClientSecret,
    publisherPrivacyUrl: local.publisherPrivacyUrl,
    publisherHelpUrl: local.publisherHelpUrl,
    profileDataMode: local.profileDataMode,
    profileDeviceId: local.profileDeviceId,
    profileCloudLastPulledAt: local.profileCloudLastPulledAt,
    profileCloudLastPushedAt: local.profileCloudLastPushedAt
  }
}

function mergeCloudConfig(local: AppConfig, remote: AppConfig): AppConfig {
  return pickCloudSafeConfig(local, {
    ...local,
    syncWindowDays: remote.syncWindowDays,
    mailPollIntervalSeconds: remote.mailPollIntervalSeconds,
    microsoftMailTransport: remote.microsoftMailTransport,
    mailBodyIndexEnabled: remote.mailBodyIndexEnabled,
    mailBodyIndexSpeed: remote.mailBodyIndexSpeed,
    autoLoadImages: remote.autoLoadImages,
    gravatarEnabled: remote.gravatarEnabled,
    contactPhotoAvatarEnabled: remote.contactPhotoAvatarEnabled,
    senderDomainAvatarEnabled: remote.senderDomainAvatarEnabled,
    accountProfileAvatarEnabled: remote.accountProfileAvatarEnabled,
    launchOnLogin: remote.launchOnLogin,
    calendarTimeZone: remote.calendarTimeZone,
    weatherLatitude: remote.weatherLatitude,
    weatherLongitude: remote.weatherLongitude,
    weatherLocationName: remote.weatherLocationName,
    workflowMailFoldersIntroDismissed: remote.workflowMailFoldersIntroDismissed,
    firstRunSetupCompleted: remote.firstRunSetupCompleted,
    profileSyncPollIntervalSeconds: remote.profileSyncPollIntervalSeconds
  })
}

export async function buildProfileSyncPayload(
  localStorage: Record<string, string>
): Promise<SettingsBackupPayload> {
  const payload = await buildSettingsBackupPayload(localStorage)
  const local = await loadConfig()
  return { ...payload, config: pickCloudSafeConfig(local, payload.config) }
}

export async function applyProfileSyncPayload(remote: SettingsBackupPayload): Promise<void> {
  const local = await loadConfig()
  const toApply: SettingsBackupPayload = {
    ...remote,
    config: mergeCloudConfig(local, remote.config)
  }
  await applySettingsBackupPayload(toApply)
}
