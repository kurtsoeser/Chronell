/** Microsoft Bookings – Unternehmens-Buchungsseite (Graph `/solutions/bookingBusinesses`). */

export interface BookingsBusinessRow {
  id: string
  displayName: string
  email: string | null
  phone: string | null
  webSiteUrl: string | null
  /** Öffentliche Buchungsseite, falls von Graph geliefert (nach „Veröffentlichen“ in Bookings). */
  publicUrl: string | null
  isPublished: boolean | null
}

export interface BookingsGetBusinessInput {
  accountId: string
  businessId: string
}

/** Einzelne Buchungsseite inkl. aufgelöster öffentlicher URL. */
export interface BookingsBusinessDetail extends BookingsBusinessRow {
  /** Nach Graph + Fallbacks (Leistungs-webUrl, OWA-Muster). */
  resolvedPublicUrl: string | null
  resolvedPublicUrlSource: 'graph' | 'service' | 'inferred' | null
}

export interface BookingsServiceRow {
  id: string
  displayName: string
  defaultDurationMinutes: number | null
  defaultPrice: number | null
  isHiddenFromCustomers: boolean
  /** Pro Leistung; Basis oft für die Kunden-Buchungsseite. */
  bookingWebUrl: string | null
}

export interface BookingsAppointmentRow {
  id: string
  startIso: string
  endIso: string
  customerName: string | null
  customerEmail: string | null
  serviceName: string | null
  staffMemberIds: string[]
  isCancelled: boolean
}

export interface BookingsListBusinessesInput {
  accountId: string
}

export interface BookingsListServicesInput {
  accountId: string
  businessId: string
}

export interface BookingsStaffMemberRow {
  id: string
  displayName: string
  emailAddress: string | null
  role: string | null
}

export type BookingsListStaffMembersInput = BookingsListServicesInput

export interface BookingsListAppointmentsInput {
  accountId: string
  businessId: string
  /** ISO-8601, z. B. Start des Abfragezeitraums. */
  startIso: string
  /** ISO-8601, Ende des Abfragezeitraums. */
  endIso: string
}
