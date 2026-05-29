import { describe, expect, it } from 'vitest'
import { parseEwsMessageFields, parseSyncFolderItemsResponse } from './ews-sync-parse'

describe('ews-sync-parse', () => {
  it('parses SyncFolderItems response with create and delete', () => {
    const xml = `
      <m:SyncFolderItemsResponseMessage>
        <m:SyncState>STATE123</m:SyncState>
        <m:IncludesLastItemInRange>true</m:IncludesLastItemInRange>
        <t:Changes>
          <t:Create>
            <t:Message>
              <t:ItemId Id="EWS1" ChangeKey="CK1"/>
              <t:Subject>Hello</t:Subject>
              <t:DateTimeReceived>2026-05-28T10:00:00Z</t:DateTimeReceived>
              <t:IsRead>false</t:IsRead>
              <t:From><t:Mailbox><t:Name>A</t:Name><t:EmailAddress>a@b.com</t:EmailAddress></t:Mailbox></t:From>
            </t:Message>
          </t:Create>
          <t:Delete>
            <t:ItemId Id="EWS_OLD"/>
          </t:Delete>
        </t:Changes>
      </m:SyncFolderItemsResponseMessage>
    `
    const page = parseSyncFolderItemsResponse(xml)
    expect(page.syncState).toBe('STATE123')
    expect(page.includesLastItemInRange).toBe(true)
    expect(page.changes).toHaveLength(2)
    expect(page.changes[0]?.kind).toBe('create')
    const fields = parseEwsMessageFields(
      (page.changes[0] as { kind: 'create'; itemXml: string }).itemXml
    )
    expect(fields?.ewsItemId).toBe('EWS1')
    expect(fields?.subject).toBe('Hello')
    expect(fields?.fromAddr).toBe('a@b.com')
  })
})
