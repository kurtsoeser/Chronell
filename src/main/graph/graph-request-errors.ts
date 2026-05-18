import { GraphError } from '@microsoft/microsoft-graph-client'

export function readGraphStatusCode(e: unknown): number | undefined {
  if (e instanceof GraphError) return e.statusCode
  if (e && typeof e === 'object' && 'statusCode' in e) {
    const c = (e as { statusCode?: unknown }).statusCode
    return typeof c === 'number' ? c : undefined
  }
  return undefined
}

function graphErrorBodyMessage(e: unknown): { code?: string; message?: string } {
  if (!(e instanceof GraphError)) return {}
  const body = e.body
  if (typeof body === 'string') {
    try {
      const parsed = JSON.parse(body) as { error?: { code?: string; message?: string } }
      return { code: parsed.error?.code, message: parsed.error?.message }
    } catch {
      return { message: body.trim() || undefined }
    }
  }
  if (body && typeof body === 'object') {
    const err = (body as { error?: { code?: string; message?: string } }).error
    return { code: err?.code, message: err?.message }
  }
  return {}
}

/** Lesbare Fehlermeldung für IPC/Renderer (GraphError serialisiert sonst oft nur als „Error“). */
export function formatGraphErrorMessage(e: unknown, context?: string): string {
  const status = readGraphStatusCode(e)
  const { code, message: bodyMsg } = graphErrorBodyMessage(e)
  const base =
    bodyMsg?.trim() ||
    (e instanceof Error ? e.message?.trim() : '') ||
    (typeof e === 'string' ? e.trim() : '')

  if (status === 403 || code === 'Authorization_RequestDenied' || /Insufficient privileges/i.test(base)) {
    return (
      (context ? `${context} ` : '') +
      'Fehlende Microsoft-Bookings-Berechtigung (Bookings.Read.All). ' +
      'In Entra Admin-Einwilligung erteilen und das Microsoft-Konto in der App erneut verbinden.'
    )
  }
  if (status === 401) {
    return (
      (context ? `${context} ` : '') +
      'Microsoft-Anmeldung abgelaufen. Bitte das Konto unter Einstellungen erneut verbinden.'
    )
  }

  const parts = [context, code, base, status != null ? `HTTP ${status}` : ''].filter(
    (p): p is string => Boolean(p && String(p).trim())
  )
  if (parts.length > 0) return parts.join(' — ')
  return context ?? 'Unbekannter Graph-Fehler'
}

/**
 * Graph / Exchange liefern 404 + ErrorItemNotFound, wenn die Ressource
 * unter der bekannten Id nicht mehr existiert (verschoben, gelöscht, veralteter Cache).
 */
export function isGraphItemNotFound(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false
  const o = e as {
    statusCode?: number
    code?: string
    body?: unknown
    message?: string
  }
  if (o.statusCode === 404) return true
  if (o.code === 'ErrorItemNotFound') return true
  if (typeof o.message === 'string' && o.message.includes('ErrorItemNotFound')) return true
  const body = o.body
  if (typeof body === 'string' && body.includes('ErrorItemNotFound')) return true
  if (body && typeof body === 'object') {
    const code = (body as { error?: { code?: string } }).error?.code
    if (code === 'ErrorItemNotFound') return true
  }
  return false
}
