import type { AccountAvatarIconId, AccountAvatarKind } from '../account-avatar'
import type { MailRuleDefinition, MailRuleTrigger } from '../mail-rules'

export type Provider = 'microsoft' | 'google'

/** Transport fuer Microsoft-Mail-Aktionen (Sync weiterhin Graph). */
export type MicrosoftMailTransport = 'graph' | 'ews' | 'auto'

/** Payload fuer das Renderer-Event `mail:changed`. */
export interface MailChangedPayload {
  accountId: string
  /** `poll` = Hintergrund-Sync; `action` = Nutzeraktion oder Regel. */
  kind?: 'poll' | 'action'
  /** Betroffene lokale Ordner-IDs (optional, fuer gezielte Reloads). */
  folderIds?: number[]
}

/** Gespeicherte Signatur-Vorlage pro Mailkonto (lokal). */
export interface AccountSignatureTemplate {
  id: string
  name: string
  /** HTML im Compose-Subset (Renderer bereinigt vor dem Speichern). */
  html: string
  /** ISO-Zeitstempel der letzten Speicherung (optional). */
  updatedAt?: string
}

export interface ConnectedAccount {
  id: string
  provider: Provider
  email: string
  displayName: string
  tenantId?: string
  /** Kontokennung in der UI: Tailwind `bg-*`-Klasse oder Hex `#rrggbb`. */
  color: string
  initials: string
  addedAt: string
  /**
   * Dateiname unter userData/avatars (Microsoft Graph /me/photo oder Google-Profilbild-URL aus id_token).
   * Renderer laedt die Data-URL per IPC nach.
   */
  profilePhotoFile?: string | null
  /**
   * Avatar-Darstellung: Provider-Foto, Initialen, Icon oder eigenes Bild.
   * `undefined` = `provider` (bisheriges Verhalten).
   */
  avatarKind?: AccountAvatarKind
  /** Lucide-Icon (kebab-case), wenn `avatarKind === 'icon'`. */
  avatarIconId?: AccountAvatarIconId | null
  /** Eigenes Bild unter userData/avatars, wenn `avatarKind === 'custom'`. */
  customAvatarFile?: string | null
  /**
   * Kalender-API: maximal wie viele Tage ab heute (Mitternacht lokal) in die Zukunft Termine geladen werden.
   * `null` = keine Begrenzung (bis zum Ende des angefragten Ansichtszeitraums).
   * `undefined` = Standard 365 Tage.
   */
  calendarLoadAheadDays?: number | null
  /** Signatur-Vorlagen fuer dieses Konto (lokal gespeichert). */
  signatureTemplates?: AccountSignatureTemplate[]
  /**
   * ID einer Vorlage aus `signatureTemplates` fuer neue Entwuerfe.
   * `null`/`undefined` = keine automatische Signatur.
   */
  defaultSignatureTemplateId?: string | null
  /**
   * Persoenliche Microsoft-Book-with-me-Buchungsseite (HTTPS).
   * `null`/`undefined` = nicht gespeichert.
   */
  bookWithMeUrl?: string | null
  /**
   * Freigegebene Postfaecher / Send-as-Adressen (Microsoft 365, lokal konfiguriert).
   */
  sharedMailboxSendAs?: SharedMailboxSendAs[]
}

/** Freigegebenes Postfach zum Senden (Microsoft 365). */
export interface SharedMailboxSendAs {
  email: string
  displayName?: string | null
}

/** Absender-Option im Compose «Von»-Feld. */
export interface ComposeSendFromOption {
  email: string
  displayName?: string | null
  kind: 'primary' | 'alias' | 'shared'
}

/** Kalender-Referenz fuer gefiltertes Laden (Microsoft Graph- oder Google-Kalender-ID). */
export type CalendarIncludeCalendarRef = {
  accountId: string
  graphCalendarId: string
}

/** IPC `auth:patch-account` — mindestens eines der optionalen Felder. */
export interface PatchAccountInput {
  accountId: string
  color?: string
  avatarKind?: AccountAvatarKind
  avatarIconId?: AccountAvatarIconId | null
  /**
   * `null` = keine zeitliche Begrenzung nach vorn.
   * `'default'` = Standard-Vorausschau (365 Tage), gespeicherten Wert entfernen.
   */
  calendarLoadAheadDays?: number | null | 'default'
  /** Ersetzt die komplette Vorlagenliste (max. 40 Eintraege). */
  signatureTemplates?: AccountSignatureTemplate[]
  /** Standard-Signatur fuer neue Mails; `null` = leer starten. */
  defaultSignatureTemplateId?: string | null
  /** Persoenliche Book-with-me-URL; `null` = entfernen. */
  bookWithMeUrl?: string | null
  /** Freigegebene Postfaecher ersetzen die gespeicherte Liste vollstaendig. */
  sharedMailboxSendAs?: SharedMailboxSendAs[]
}

export interface AuthResult {
  account: ConnectedAccount
}

export interface AuthError {
  code: string
  message: string
}

