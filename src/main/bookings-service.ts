import type {
  BookingsAppointmentRow,
  BookingsBusinessDetail,
  BookingsBusinessRow,
  BookingsGetBusinessInput,
  BookingsListAppointmentsInput,
  BookingsListBusinessesInput,
  BookingsListServicesInput,
  BookingsListStaffMembersInput,
  BookingsServiceRow,
  BookingsStaffMemberRow
} from '@shared/bookings-types'
import {
  graphGetBookingBusiness,
  graphListBookingAppointments,
  graphListBookingBusinesses,
  graphListBookingServices,
  graphListBookingStaffMembers
} from './graph/bookings-graph'

export async function getBookingBusiness(input: BookingsGetBusinessInput): Promise<BookingsBusinessDetail> {
  return graphGetBookingBusiness(input.accountId, input.businessId)
}

export async function listBookingsBusinesses(
  input: BookingsListBusinessesInput
): Promise<BookingsBusinessRow[]> {
  return graphListBookingBusinesses(input.accountId)
}

export async function listBookingsServices(
  input: BookingsListServicesInput
): Promise<BookingsServiceRow[]> {
  return graphListBookingServices(input.accountId, input.businessId)
}

export async function listBookingsStaffMembers(
  input: BookingsListStaffMembersInput
): Promise<BookingsStaffMemberRow[]> {
  return graphListBookingStaffMembers(input.accountId, input.businessId)
}

export async function listBookingsAppointments(
  input: BookingsListAppointmentsInput
): Promise<BookingsAppointmentRow[]> {
  return graphListBookingAppointments(
    input.accountId,
    input.businessId,
    input.startIso,
    input.endIso
  )
}
