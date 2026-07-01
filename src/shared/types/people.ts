import type { Provider } from './account'

/** Kontakte-Modul: Navigations-/Listenfilter. */
export type PeopleListFilter = 'all' | 'favorites' | 'microsoft' | 'google'

/** Sortierung der Kontaktliste (serverseitig in SQLite). */
export type PeopleListSort = 'displayName' | 'givenName' | 'surname'

export interface PeopleListInput {
  filter: PeopleListFilter
  /** Optional: nur Kontakte dieses Kontos (z. B. Untermenue pro Konto). */
  accountId?: string | null
  query?: string
  limit?: number
  /** Standard: `displayName`. */
  sortBy?: PeopleListSort
}

/** Lokaler Kontakt (Cache), fuer Liste und Detailansicht. */
export interface PeopleContactView {
  id: number
  accountId: string
  provider: Provider
  remoteId: string
  changeKey: string | null
  displayName: string | null
  givenName: string | null
  surname: string | null
  company: string | null
  jobTitle: string | null
  department: string | null
  officeLocation: string | null
  birthdayIso: string | null
  webPage: string | null
  primaryEmail: string | null
  emailsJson: string | null
  phonesJson: string | null
  addressesJson: string | null
  categoriesJson: string | null
  notes: string | null
  photoLocalPath: string | null
  rawJson: string | null
  updatedRemote: string | null
  updatedLocal: string | null
  isFavorite: boolean
}

export interface PeopleNavAccountCount {
  accountId: string
  provider: Provider
  total: number
  email?: string
  displayName?: string
  /** Aus `people_sync_state` fuer dieses Konto. */
  lastSyncedAt?: string | null
}

export interface PeopleNavCounts {
  all: number
  favorites: number
  microsoftTotal: number
  googleTotal: number
  /** Neuestes `last_synced_at` ueber alle Konten (Kontakte). */
  lastSyncedAt: string | null
  byAccount: PeopleNavAccountCount[]
}

export interface PeopleSyncAccountResult {
  accountId: string
  provider: Provider
  imported: number
  /** Nur bei `syncAll`, wenn ein Konto fehlschlaegt. */
  error?: string
}

export interface PeopleSetFavoriteInput {
  accountId: string
  provider: Provider
  remoteId: string
  isFavorite: boolean
}

/** Felder fuer `people:update-contact` (MVP: Kernfelder). */
export interface PeopleUpdateContactPatch {
  displayName?: string | null
  givenName?: string | null
  surname?: string | null
  company?: string | null
  jobTitle?: string | null
  department?: string | null
  officeLocation?: string | null
  birthdayIso?: string | null
  webPage?: string | null
  primaryEmail?: string | null
  /** Ersetzt gesamte strukturierte Telefonliste (type/value). */
  phones?: Array<{ type: string; value: string }>
  /** Ersetzt E-Mail-Adressen (Graph: name+address; Google wird serverseitig gemappt). */
  emails?: Array<{ address: string; name?: string | null }>
  notes?: string | null
}

export interface PeopleUpdateContactInput {
  id: number
  patch: PeopleUpdateContactPatch
}

/** JPEG/PNG als Base64 (ohne oder mit `data:…;base64,`-Prefix) — Microsoft 365 Kontakte. */
export interface PeopleSetContactPhotoInput {
  id: number
  imageBase64: string
}

/** Neuer Kontakt im verbundenen Konto (Microsoft oder Google). */
export interface PeopleCreateContactInput {
  accountId: string
  displayName?: string | null
  givenName?: string | null
  surname?: string | null
  primaryEmail?: string | null
  company?: string | null
  jobTitle?: string | null
  mobilePhone?: string | null
  notes?: string | null
}

export type PeopleCreateContactPayload = Omit<PeopleCreateContactInput, 'accountId'>

