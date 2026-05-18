import { ipcMain } from 'electron'
import {
  IPC,
  type BookingsAppointmentRow,
  type BookingsBusinessDetail,
  type BookingsBusinessRow,
  type BookingsListAppointmentsInput,
  type BookingsListBusinessesInput,
  type BookingsListServicesInput,
  type BookingsListStaffMembersInput,
  type BookingsServiceRow,
  type BookingsStaffMemberRow
} from '@shared/types'
import {
  getBookingBusiness,
  listBookingsAppointments,
  listBookingsBusinesses,
  listBookingsServices,
  listBookingsStaffMembers
} from '../bookings-service'
import { assertAppOnline } from '../network-status'
import { formatGraphErrorMessage } from '../graph/graph-request-errors'

function rethrowBookingsIpcError(e: unknown, context: string): never {
  console.error(`[bookings-ipc] ${context}`, e)
  if (e instanceof Error && e.message && e.message !== 'Error') {
    throw e
  }
  throw new Error(formatGraphErrorMessage(e, context))
}

function normalizeAccountId(raw: unknown): string {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const accountId = typeof o.accountId === 'string' ? o.accountId.trim() : ''
  if (!accountId) throw new Error('Keine Konto-ID für Bookings.')
  return accountId
}

function normalizeBusinessId(raw: unknown): string {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const businessId = typeof o.businessId === 'string' ? o.businessId.trim() : ''
  if (!businessId) throw new Error('Keine Bookings-Unternehmens-ID.')
  return businessId
}

function normalizeAppointmentsInput(raw: unknown): BookingsListAppointmentsInput {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const accountId = normalizeAccountId(raw)
  const businessId = normalizeBusinessId(raw)
  const startIso = typeof o.startIso === 'string' ? o.startIso.trim() : ''
  const endIso = typeof o.endIso === 'string' ? o.endIso.trim() : ''
  if (!startIso || !endIso) throw new Error('Zeitraum für Bookings-Termine fehlt.')
  return { accountId, businessId, startIso, endIso }
}

export function registerBookingsIpc(): void {
  ipcMain.removeHandler(IPC.bookings.listBusinesses)
  ipcMain.handle(
    IPC.bookings.listBusinesses,
    async (_event, raw: unknown): Promise<BookingsBusinessRow[]> => {
      try {
        assertAppOnline()
        const accountId = normalizeAccountId(raw)
        return await listBookingsBusinesses({ accountId })
      } catch (e) {
        rethrowBookingsIpcError(e, 'Bookings-Unternehmen konnten nicht geladen werden.')
      }
    }
  )

  ipcMain.removeHandler(IPC.bookings.getBusiness)
  ipcMain.handle(
    IPC.bookings.getBusiness,
    async (_event, raw: unknown): Promise<BookingsBusinessDetail> => {
      try {
        assertAppOnline()
        const accountId = normalizeAccountId(raw)
        const businessId = normalizeBusinessId(raw)
        return await getBookingBusiness({ accountId, businessId })
      } catch (e) {
        rethrowBookingsIpcError(e, 'Buchungsseite konnte nicht geladen werden.')
      }
    }
  )

  ipcMain.removeHandler(IPC.bookings.listServices)
  ipcMain.handle(
    IPC.bookings.listServices,
    async (_event, raw: unknown): Promise<BookingsServiceRow[]> => {
      try {
        assertAppOnline()
        const accountId = normalizeAccountId(raw)
        const businessId = normalizeBusinessId(raw)
        return await listBookingsServices({ accountId, businessId })
      } catch (e) {
        rethrowBookingsIpcError(e, 'Bookings-Leistungen konnten nicht geladen werden.')
      }
    }
  )

  ipcMain.removeHandler(IPC.bookings.listStaffMembers)
  ipcMain.handle(
    IPC.bookings.listStaffMembers,
    async (_event, raw: unknown): Promise<BookingsStaffMemberRow[]> => {
      try {
        assertAppOnline()
        const accountId = normalizeAccountId(raw)
        const businessId = normalizeBusinessId(raw)
        return await listBookingsStaffMembers({ accountId, businessId })
      } catch (e) {
        rethrowBookingsIpcError(e, 'Bookings-Mitarbeiter konnten nicht geladen werden.')
      }
    }
  )

  ipcMain.removeHandler(IPC.bookings.listAppointments)
  ipcMain.handle(
    IPC.bookings.listAppointments,
    async (_event, raw: unknown): Promise<BookingsAppointmentRow[]> => {
      try {
        assertAppOnline()
        return await listBookingsAppointments(normalizeAppointmentsInput(raw))
      } catch (e) {
        rethrowBookingsIpcError(e, 'Bookings-Termine konnten nicht geladen werden.')
      }
    }
  )
}
