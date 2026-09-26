import { createGraphClient } from './client'
import { loadConfig } from '../config'
import { preferTeamsJoinUrl } from '@shared/teams-join-url'
import { cleanTeamsMeetingJoinInformationHtml } from '@shared/calendar-event-body-html'

async function getClientFor(accountId: string): Promise<ReturnType<typeof createGraphClient>> {
  const config = await loadConfig()
  if (!config.microsoftClientId) {
    throw new Error('Keine Azure Client-ID konfiguriert.')
  }
  const homeAccountId = accountId.replace(/^ms:/, '')
  return createGraphClient(config.microsoftClientId, homeAccountId)
}

/** Graph erwartet die GUID; Prefix `firstparty_` / `customtemplate_` entfernen. */
export function normalizeGraphMeetingTemplateId(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim()
  if (!trimmed) return null
  const withoutPrefix = trimmed.replace(/^(firstparty_|customtemplate_)/i, '')
  const guid = withoutPrefix.match(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  )
  return guid ? guid[0] : trimmed
}

export interface CreateOnlineMeetingWithTemplateInput {
  subject: string
  startIso: string
  endIso: string
  /** Teams Premium meetingTemplateId (GUID oder firstparty_/customtemplate_…). */
  meetingTemplateId: string
}

export interface CreateOnlineMeetingWithTemplateResult {
  id: string
  joinUrl: string | null
  joinInformationHtml: string | null
  meetingTemplateId: string | null
}

interface GraphOnlineMeetingCreated {
  id?: string
  joinWebUrl?: string | null
  meetingTemplateId?: string | null
  joinInformation?: { content?: string | null; contentType?: string | null } | null
}

/**
 * Teams-Premium-Besprechung ueber Cloud Communications API anlegen.
 * Kalender-Events unterstuetzen meetingTemplateId nicht — daher dieser Pfad.
 */
export async function graphCreateOnlineMeetingWithTemplate(
  accountId: string,
  input: CreateOnlineMeetingWithTemplateInput
): Promise<CreateOnlineMeetingWithTemplateResult> {
  const templateId = normalizeGraphMeetingTemplateId(input.meetingTemplateId)
  if (!templateId) {
    throw new Error('Teams-Besprechungsvorlage-ID fehlt oder ist ungueltig.')
  }
  const start = input.startIso.trim()
  const end = input.endIso.trim()
  if (!start || !end) {
    throw new Error('Start- und Endzeit fuer die Teams-Besprechung fehlen.')
  }
  if (Number.parseFloat(String(Date.parse(end))) <= Number.parseFloat(String(Date.parse(start)))) {
    throw new Error('Ende muss nach dem Start liegen.')
  }

  const client = await getClientFor(accountId)
  const payload: Record<string, unknown> = {
    subject: input.subject.trim() || 'Besprechung',
    startDateTime: start,
    endDateTime: end,
    meetingTemplateId: templateId
  }

  const created = (await client.api('/me/onlineMeetings').post(payload)) as GraphOnlineMeetingCreated
  const id = created.id?.trim()
  if (!id) {
    throw new Error('Teams-Besprechung wurde angelegt, aber ohne ID zurueckgegeben.')
  }

  const joinInfoRaw = created.joinInformation?.content?.trim() || null
  const joinInfo = joinInfoRaw ? cleanTeamsMeetingJoinInformationHtml(joinInfoRaw) || joinInfoRaw : null
  const joinWebUrl = created.joinWebUrl?.trim() || null
  return {
    id,
    joinUrl: preferTeamsJoinUrl({
      joinUrl: joinWebUrl,
      joinInformationHtml: joinInfo
    }),
    joinInformationHtml: joinInfo,
    meetingTemplateId: created.meetingTemplateId?.trim() || templateId
  }
}
