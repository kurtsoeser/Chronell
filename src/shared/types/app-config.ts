export type { LocationSearchLanguage, LocationSuggestion } from '../location-search'
import type { MicrosoftMailTransport } from './account'

export interface AppConfig {
  microsoftClientId: string | null
  googleClientId: string | null
  /**
   * OAuth-Clientschlüssel aus der Google Cloud Console (Desktop-Client).
   * Optional wenn PKCE ohne Geheimnis (Desktop-Client / verifizierte App); sonst fuer Refresh noetig.
   */
  googleClientSecret: string | null
  /** Notion Public Integration — OAuth Client ID. */
  notionClientId: string | null
  /** Notion Public Integration — OAuth Client secret. */
  notionClientSecret: string | null
  /**
   * Wie weit (Tage) zurueck synchronisiert wird. `null` = keine Begrenzung.
   * Bereits lokal vorhandene aeltere Mails bleiben erhalten.
   */
  syncWindowDays: number | null
  /**
   * Hintergrund-Mail-Poll-Intervall in Sekunden (30–600). Standard: 60.
   */
  mailPollIntervalSeconds?: number
  /**
   * Microsoft-Mail-Aktionen: `auto` = EWS wenn OAuth-Scope vorhanden, sonst Graph.
   * Sync bleibt vorerst Graph; EWS beschleunigt Loeschen/Verschieben/Lesestatus.
   */
  microsoftMailTransport?: MicrosoftMailTransport
  /**
   * Mail-Bodies im Hintergrund fuer die Volltextsuche laden. Standard: an.
   */
  mailBodyIndexEnabled?: boolean
  /** Geschwindigkeit der Hintergrund-Body-Indexierung. Standard: `normal`. */
  mailBodyIndexSpeed?: import('../mail-body-index').MailBodyIndexSpeed
  /**
   * Externe Bilder in HTML-Mails automatisch laden. Wenn `false` muss der
   * Benutzer pro Mail explizit auf "Bilder laden" klicken.
   */
  autoLoadImages: boolean
  /**
   * Gravatar-Avatare fuer Absender/Kontakte (externe Anfragen an gravatar.com).
   * Standard: aus — siehe Einstellungen → Kontakte → Avatare.
   */
  gravatarEnabled?: boolean
  /** Kontaktfotos aus dem Adressbuch als Avatar. Standard: an. */
  contactPhotoAvatarEnabled?: boolean
  /** Domain-Favicons (Firmenlogos) fuer Mail-Absender. Standard: an (extern). */
  senderDomainAvatarEnabled?: boolean
  /** Konto-Profilbild, wenn Absender = verbundenes Konto. Standard: an. */
  accountProfileAvatarEnabled?: boolean
  /** Windows: App beim Anmelden starten. */
  launchOnLogin?: boolean
  /**
   * IANA-Zeitzone fuer Kalender-Anzeige und neue Termine (z. B. `Europe/Berlin`).
   * `null` = Systemzeitzone (Browser bzw. Node Intl).
   */
  calendarTimeZone: string | null
  /**
   * Wenn `true`: Hinweisdialog zu Triage-Ordnern (In Bearbeitung / Erledigt) nicht mehr beim Start zeigen.
   */
  workflowMailFoldersIntroDismissed?: boolean
  /**
   * Ersteinrichtungs-Assistent abgeschlossen oder uebersprungen.
   * Fehlt in aelteren config.json: gilt als erledigt (siehe configSchemaVersion).
   */
  firstRunSetupCompleted?: boolean
  /** Ab Version 2: steuert Migration des Ersteinrichtungs-Assistenten. */
  configSchemaVersion?: number
  /**
   * Wetterkachel (Open-Meteo): Koordinaten und Anzeigename nach Geocoding.
   * Alle `null`/`undefined`: Ort nicht gesetzt — Kachel zeigt Hinweis.
   */
  weatherLatitude?: number | null
  weatherLongitude?: number | null
  weatherLocationName?: string | null
  /** Aus MAILCLIENT_PRIVACY_URL (Build); nicht in config.json. */
  publisherPrivacyUrl?: string | null
  /** Aus MAILCLIENT_HELP_URL (Build); nicht in config.json. */
  publisherHelpUrl?: string | null
  /**
   * Chronell-Profil-Sync: `local` = nur dieses Gerät; `cloud` = Notizen/Einstellungen über Supabase.
   * Mail/Kalender kommen weiterhin über Microsoft/Google auf jedem Gerät.
   */
  profileDataMode?: ProfileDataMode
  /** Stabile Geräte-ID für Cloud-Sync (UUID). */
  profileDeviceId?: string | null
  /** ISO-Zeitstempel des letzten erfolgreichen Pulls aus der Cloud. */
  profileCloudLastPulledAt?: string | null
  /** ISO-Zeitstempel des letzten erfolgreichen Pushs in die Cloud. */
  profileCloudLastPushedAt?: string | null
  /** Gesetzt bei lokalen Profil-Änderungen; steuert Auto-Push. */
  profileCloudLocalDirtyAt?: string | null
  /** Hintergrund-Poll-Intervall in Sekunden (120–1800), Standard 300. */
  profileSyncPollIntervalSeconds?: number
  /** Automatisches JSON-Backup nach größeren Änderungen (ohne Dialog). */
  settingsAutoBackupEnabled?: boolean
  /** Zielordner für Auto-Backup (`mailclient-einstellungen-latest.json` + datierte Kopien). */
  settingsAutoBackupDirectory?: string | null
  settingsAutoBackupLastAt?: string | null
  settingsAutoBackupLastPath?: string | null
  settingsAutoBackupLastError?: string | null
}

export type ProfileDataMode = 'local' | 'cloud'

export interface ProfileSyncSessionInfo {
  userId: string
  email: string | null
}

export interface ProfileSyncStatus {
  configured: boolean
  dataMode: ProfileDataMode
  deviceId: string | null
  signedIn: boolean
  session: ProfileSyncSessionInfo | null
  lastPulledAt: string | null
  lastPushedAt: string | null
  remoteUpdatedAt: string | null
  lastError: string | null
  /** Läuft gerade ein Sync (manuell oder automatisch). */
  syncing: boolean
  /** Cloud-Snapshot ist neuer als letzter Pull — anderes Gerät hat kürzlich geschrieben. */
  conflictRemoteNewer: boolean
  /** Cloud und lokaler Stand weichen ab — bitte manuell wählen (kein Auto-Pull/Push). */
  conflictPending: boolean
  autoSyncActive: boolean
}

export type ProfileSyncResolution = 'auto' | 'pull' | 'push'

export type ProfileSyncRunResult =
  | {
      ok: true
      pulled: boolean
      pushed: boolean
      remoteUpdatedAt: string | null
      conflictRemoteNewer: boolean
      /** Auto-Sync übersprungen, weil ein Konflikt aufgelöst werden muss. */
      skippedConflict?: boolean
      attachmentsUploaded: number
      attachmentsDownloaded: number
      /** Nach Pull: localStorage-Einträge für den Renderer. */
      localStorage?: Record<string, string>
    }
  | { ok: false; error: string }

/** Payload fuer `config:set-weather-location` (Speichern oder `null` = loeschen). */
export interface AppConfigWeatherLocation {
  latitude: number
  longitude: number
  /** Kurzbezeichnung (z. B. Stadt, Region). */
  name: string
}

export interface OpenMeteoGeocodeHit {
  latitude: number
  longitude: number
  label: string
}

export interface OpenMeteoForecastCurrent {
  temperatureC: number
  apparentTemperatureC: number
  humidityPct: number
  windKmh: number
  weatherCode: number
}

export interface OpenMeteoForecastDay {
  dateIso: string
  weatherCode: number
  tempMaxC: number
  tempMinC: number
}

export interface OpenMeteoForecast {
  current: OpenMeteoForecastCurrent
  daily: OpenMeteoForecastDay[]
}

export interface AppConnectivityState {
  online: boolean
}

/** Aktuelle Version der JSON-Datei fuer Einstellungen-Export/-Import. */
