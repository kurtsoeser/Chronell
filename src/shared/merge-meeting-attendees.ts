import type { MeetingAttendeePartStat, MeetingInvitationAttendeeView } from './types'

function isKnownPartStat(stat: MeetingAttendeePartStat): boolean {
  return stat !== 'unknown' && stat !== 'needs-action'
}

/** Vereinigt ICS-Teilnehmer mit live Kalender-Status (Graph) und eigenem RSVP. */
export function mergeMeetingAttendees(
  baseAttendees: MeetingInvitationAttendeeView[],
  graphAttendees: MeetingInvitationAttendeeView[] | null | undefined,
  accountEmail: string | null,
  selfPartStat: MeetingAttendeePartStat | null
): MeetingInvitationAttendeeView[] {
  const byEmail = new Map<string, MeetingInvitationAttendeeView>()

  for (const attendee of baseAttendees) {
    byEmail.set(attendee.email.toLowerCase(), { ...attendee })
  }

  for (const graphAttendee of graphAttendees ?? []) {
    const key = graphAttendee.email.toLowerCase()
    const existing = byEmail.get(key)
    byEmail.set(key, {
      email: graphAttendee.email,
      name: existing?.name ?? graphAttendee.name,
      partStat: isKnownPartStat(graphAttendee.partStat)
        ? graphAttendee.partStat
        : (existing?.partStat ?? graphAttendee.partStat)
    })
  }

  const self = accountEmail?.trim().toLowerCase()
  if (self && selfPartStat) {
    const existing = byEmail.get(self)
    byEmail.set(self, {
      email: self,
      name: existing?.name ?? null,
      partStat: selfPartStat
    })
  }

  return Array.from(byEmail.values()).sort((a, b) => {
    const aName = (a.name ?? a.email).toLocaleLowerCase()
    const bName = (b.name ?? b.email).toLocaleLowerCase()
    return aName.localeCompare(bName, undefined, { sensitivity: 'base' })
  })
}
