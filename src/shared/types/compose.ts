import type { TodoDueKindList } from './mail'

export interface ComposeRecipient {
  address: string
  name?: string
}

/**
 * Anhang fuer den Compose-Send-Aufruf.
 * `dataBase64` ist der reine Base64-String OHNE Daten-URL-Prefix.
 * Bei `isInline=true` muss `contentId` gesetzt sein (wird im HTML als
 * `<img src="cid:...">` referenziert).
 */
export interface ComposeAttachment {
  name: string
  contentType: string
  size: number
  dataBase64: string
  isInline?: boolean
  contentId?: string
}

/** Microsoft-365-Cloud-Anhang (ReferenceAttachment), ohne Datei lokal zu laden. */
export interface ComposeReferenceAttachment {
  name: string
  /** `webUrl` der Datei (OneDrive/SharePoint), wird als `sourceUrl` an Graph uebergeben. */
  sourceUrl: string
  /** z.B. `oneDriveBusiness` (Standard fuer M365). */
  providerType?: 'oneDriveBusiness' | 'oneDriveConsumer' | 'documentLibrary'
}

export type MailImportance = 'low' | 'normal' | 'high'

export interface ComposeSendInput {
  accountId: string
  /**
   * SMTP-Absender; `null`/`undefined` = Hauptkonto.
   * Microsoft: freigegebenes Postfach oder Alias (`/users/{smtp}/sendMail`).
   */
  sendFromEmail?: string | null
  subject: string
  bodyHtml: string
  to: ComposeRecipient[]
  cc?: ComposeRecipient[]
  bcc?: ComposeRecipient[]
  attachments?: ComposeAttachment[]
  /** Nur Microsoft Graph: Cloud-Datei als Link-Anhang. */
  referenceAttachments?: ComposeReferenceAttachment[]
  replyToRemoteId?: string
  replyMode?: 'reply' | 'replyAll' | 'forward'
  /**
   * Lokale Message-ID der Mail, auf die geantwortet/weitergeleitet wird.
   * Wird fuer "Antwort erwarten" nach erfolgreichem Senden benoetigt.
   */
  trackWaitingOnMessageId?: number
  /** Wenn gesetzt: nach Senden Waiting-for auf `trackWaitingOnMessageId` setzen. */
  expectReplyInDays?: number
  /** Microsoft Graph: Wichtigkeit (Gmail: derzeit ignoriert). */
  importance?: MailImportance
  /** Microsoft Graph: Zustellbestaetigung anfordern. */
  isDeliveryReceiptRequested?: boolean
  /** Microsoft Graph: Lesebestaetigung anfordern. */
  isReadReceiptRequested?: boolean
  /**
   * ISO-Zeitpunkt: wenn in der Zukunft, wird die Nachricht lokal eingeplant
   * statt sofort gesendet (Anhaenge-Groesse beachten).
   */
  scheduledSendAt?: string | null
  /**
   * Bereits gespeicherter Server-Entwurf: nach dem Senden aus «Entwürfe» entfernen
   * (bzw. ueber diesen Entwurf senden).
   */
  remoteDraftId?: string | null
  /** Lokale Mail-ID des Entwurfs in der DB (Ordner Entwuerfe). */
  linkedMessageId?: number | null
}

/** Ergebnis nach sofortigem Versand (nicht bei geplantem Versand). */
export interface ComposeSendResult {
  /** Lokale Nachrichten-ID in «Gesendet», falls nach Sync auffindbar. */
  messageId: number | null
}

/** Server-Entwurf speichern (Ordner «Entwürfe» / Gmail-Drafts). */
export interface ComposeSaveDraftInput {
  accountId: string
  sendFromEmail?: string | null
  subject: string
  bodyHtml: string
  to: ComposeRecipient[]
  cc?: ComposeRecipient[]
  bcc?: ComposeRecipient[]
  attachments?: ComposeAttachment[]
  referenceAttachments?: ComposeReferenceAttachment[]
  replyToRemoteId?: string
  replyMode?: 'reply' | 'replyAll' | 'forward'
  /**
   * Bereits angelegter Server-Entwurf: PATCH/Update statt neu anlegen.
   * Microsoft: `message.id`; Gmail: Draft-Ressourcen-ID von `drafts.create`.
   */
  remoteDraftId?: string | null
  importance?: MailImportance
  isDeliveryReceiptRequested?: boolean
  isReadReceiptRequested?: boolean
}

export interface ComposeSaveDraftResult {
  remoteDraftId: string
}

/** Server-Entwurf und lokale Kopie entfernen (Verwerfen). */
export interface ComposeDisposeDraftInput {
  accountId: string
  remoteDraftId?: string | null
  linkedMessageId?: number | null
}

/** Vorschlag fuer Empfaenger-Autocomplete (Compose). */
export interface ComposeRecipientSuggestion {
  email: string
  displayName?: string | null
  source: 'people-local' | 'mail-history' | 'graph-people' | 'graph-directory' | 'graph-group'
}

/** OneDrive/SharePoint-Explorer: Bereich und optional aktueller Ordner. */
export type ComposeDriveExplorerScope = 'recent' | 'myfiles' | 'shared' | 'sharepoint'

export interface ComposeListDriveExplorerInput {
  accountId: string
  scope: ComposeDriveExplorerScope
  /** Bei `myfiles`/`shared`: Ordner-Item-ID; `null` = Wurzel. */
  folderId?: string | null
  /** Bei `shared` (und Unterordnern): Ziel-Drive-ID aus Graph `parentReference.driveId`. */
  folderDriveId?: string | null
  /**
   * Nur `sharepoint`: Graph-Site-ID, um Dokumentbibliotheken (`/sites/{id}/drives`) zu listen.
   * Fehlt/leer = Uebersicht (verfolgte Sites + Team-Websites).
   */
  siteId?: string | null
}

/** Geltungsbereich eines per Graph `createLink` erzeugten Freigabe-Links. */
export type ComposeDriveSharingLinkScope = 'anonymous' | 'organization'

/** Berechtigung des Freigabe-Links. */
export type ComposeDriveSharingLinkType = 'view' | 'edit'

export interface ComposeCreateDriveSharingLinkInput {
  accountId: string
  itemId: string
  driveId?: string | null
  type: ComposeDriveSharingLinkType
  scope: ComposeDriveSharingLinkScope
  /** ISO-8601, optional (Graph `expirationDateTime`). */
  expirationDateTime?: string | null
}

export interface ComposeCreateDriveSharingLinkResult {
  webUrl: string
}

/** Eintrag im OneDrive-Explorer (Datei oder Ordner). */
export interface ComposeDriveExplorerEntry {
  id: string
  name: string
  webUrl: string | null
  size: number | null
  mimeType: string | null
  isFolder: boolean
  /** Nur bei geteilten Drives fuer Navigation zu Kindern. */
  driveId?: string | null
  /** Nur SharePoint-Website-Zeilen: Navigation zur Bibliotheken-Liste. */
  siteId?: string | null
}

/** Brotkrumen-Pfad im OneDrive/SharePoint-Explorer (Favoriten + Navigation). */
export interface ComposeDriveExplorerNavCrumb {
  id: string | null
  name: string
  driveId?: string | null
  siteId?: string | null
}

/** Lokal gespeicherter Favorit (userData), optional mit Eintrags-Cache. */
export interface ComposeDriveExplorerFavorite {
  id: string
  accountId: string
  label: string
  scope: ComposeDriveExplorerScope
  crumbs: ComposeDriveExplorerNavCrumb[]
  savedAt: string
  /** Reihenfolge in der Sidebar (kleiner = weiter oben). Fehlt bei Altbestand -> Fallback `savedAt`. */
  sortOrder?: number
  cachedEntries?: ComposeDriveExplorerEntry[] | null
  cachedAt?: string | null
}

export interface ComposeAddDriveExplorerFavoriteInput {
  accountId: string
  scope: ComposeDriveExplorerScope
  crumbs: ComposeDriveExplorerNavCrumb[]
  label?: string | null
  cachedEntries?: ComposeDriveExplorerEntry[] | null
}

export interface ComposeRemoveDriveExplorerFavoriteInput {
  accountId: string
  id: string
}

export interface ComposeUpdateDriveExplorerFavoriteCacheInput {
  accountId: string
  id: string
  entries: ComposeDriveExplorerEntry[]
}

export interface ComposeRenameDriveExplorerFavoriteInput {
  accountId: string
  id: string
  label: string
}

export interface ComposeReorderDriveExplorerFavoritesInput {
  accountId: string
  /** IDs in gewuenschter Reihenfolge (oben -> unten), muss exakt den Favoriten dieses Kontos entsprechen. */
  orderedIds: string[]
}

export interface ComposeDriveItemRow {
  id: string
  name: string
  webUrl: string
  size: number | null
  mimeType: string | null
}

/** Textbaustein aus der lokalen `templates`-Tabelle (Compose). */
export interface MailTemplate {
  id: number
  name: string
  bodyHtml: string
  bodyText: string | null
  /** JSON-Objekt mit Platzhalter -> Wert, z.B. `{"vorname":"Kurt"}`. */
  variablesJson?: string | null
  shortcut: string | null
  sortOrder: number
}

/** QuickStep-Metadaten (ohne Aktions-JSON) fuer UI-Listen. */
export interface MailQuickStep {
  id: number
  name: string
  icon: string | null
  shortcut: string | null
  sortOrder: number
  /** Abgeleitet aus actions_json: Icon wie ToDo-Bucket (Heute, Morgen, Erledigt, …). */
  visualBucket?: TodoDueKindList | null
}
