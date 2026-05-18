/**
 * Öffentliche Microsoft-Bookings-URL: Graph liefert `publicUrl` oft erst nach „Veröffentlichen“.
 * Fallback: Basis-URL aus bookingService.webUrl oder typisches OWA-Muster.
 */
export function inferBusinessBookingPageUrlFromServiceWebUrl(webUrl: string): string | null {
  const trimmed = webUrl.trim()
  if (!trimmed) return null
  const owa = trimmed.match(/^(https:\/\/[^?#]+\/owa\/calendar\/[^/]+\/bookings)/i)
  if (owa?.[1]) return owa[1]
  const generic = trimmed.match(/^(https:\/\/[^?#]+\/bookings)/i)
  if (generic?.[1]) return generic[1]
  return null
}

export function resolveBookingsPublicUrl(options: {
  publicUrl?: string | null
  businessId?: string
  serviceWebUrls?: Array<string | null | undefined>
}): { url: string | null; source: 'graph' | 'service' | 'inferred' | null } {
  const direct = options.publicUrl?.trim()
  if (direct) return { url: direct, source: 'graph' }

  for (const raw of options.serviceWebUrls ?? []) {
    const u = raw?.trim()
    if (!u) continue
    const inferred = inferBusinessBookingPageUrlFromServiceWebUrl(u)
    if (inferred) return { url: inferred, source: 'service' }
  }

  const id = options.businessId?.trim()
  if (id && id.includes('@')) {
    return {
      url: `https://outlook.office365.com/owa/calendar/${id}/bookings`,
      source: 'inferred'
    }
  }

  return { url: null, source: null }
}
