import { acquireEwsAccessToken } from '../auth/microsoft-ews'
import { listAccounts } from '../accounts'
import {
  distinguishedFolderIdXml,
  escapeXmlText,
  EwsRequestError,
  itemIdXml,
  postEwsSoap
} from './ews-soap'
import { translateRestIdToEwsId, translateRestIdsToEwsIds } from './translate-exchange-ids'

async function anchorMailboxFor(accountId: string): Promise<string> {
  const accounts = await listAccounts()
  const acc = accounts.find((a) => a.id === accountId)
  const email = acc?.email?.trim()
  if (!email) throw new Error('Konto-E-Mail fuer EWS nicht gefunden.')
  return email
}

async function ewsContext(accountId: string): Promise<{ token: string; anchor: string }> {
  const config = await import('../config').then((m) => m.loadConfig())
  if (!config.microsoftClientId) {
    throw new Error('Keine Azure Client-ID konfiguriert.')
  }
  const homeAccountId = accountId.replace(/^ms:/, '')
  const token = await acquireEwsAccessToken(config.microsoftClientId, homeAccountId)
  const anchor = await anchorMailboxFor(accountId)
  return { token, anchor }
}

type WellKnownFolder =
  | 'inbox'
  | 'sentitems'
  | 'drafts'
  | 'deleteditems'
  | 'archive'
  | 'junkemail'
  | 'outbox'

export async function ewsSetMessageRead(
  accountId: string,
  restMessageId: string,
  isRead: boolean
): Promise<void> {
  const ewsItemId = await translateRestIdToEwsId(accountId, restMessageId)
  const { token, anchor } = await ewsContext(accountId)
  await postEwsSoap({
    accessToken: token,
    anchorMailbox: anchor,
    bodyXml: `<m:UpdateItem MessageDisposition="SaveOnly" ConflictResolution="AlwaysOverwrite">
  <m:ItemChanges>
    <t:ItemChange>
      ${itemIdXml(ewsItemId)}
      <t:Updates>
        <t:SetItemField>
          <t:FieldURI FieldURI="message:IsRead"/>
          <t:Message>
            <t:IsRead>${isRead ? 'true' : 'false'}</t:IsRead>
          </t:Message>
        </t:SetItemField>
      </t:Updates>
    </t:ItemChange>
  </m:ItemChanges>
</m:UpdateItem>`
  })
}

export async function ewsMoveMessageToDistinguishedFolder(
  accountId: string,
  restMessageId: string,
  destination: WellKnownFolder
): Promise<void> {
  const ewsItemId = await translateRestIdToEwsId(accountId, restMessageId)
  const { token, anchor } = await ewsContext(accountId)
  await postEwsSoap({
    accessToken: token,
    anchorMailbox: anchor,
    bodyXml: `<m:MoveItem>
  <m:ToFolderId>
    ${distinguishedFolderIdXml(destination)}
  </m:ToFolderId>
  <m:ItemIds>
    ${itemIdXml(ewsItemId)}
  </m:ItemIds>
</m:MoveItem>`
  })
}

export async function ewsMoveMessageToFolder(
  accountId: string,
  restMessageId: string,
  destinationRestFolderId: string
): Promise<void> {
  const idMap = await translateRestIdsToEwsIds(accountId, [restMessageId, destinationRestFolderId])
  const ewsItemId = idMap.get(restMessageId.trim())
  const ewsFolderId = idMap.get(destinationRestFolderId.trim())
  if (!ewsItemId || !ewsFolderId) {
    throw new Error('EWS-ID fuer Mail oder Zielordner fehlt.')
  }
  const { token, anchor } = await ewsContext(accountId)
  await postEwsSoap({
    accessToken: token,
    anchorMailbox: anchor,
    bodyXml: `<m:MoveItem>
  <m:ToFolderId>
    <t:FolderId Id="${escapeXmlText(ewsFolderId)}"/>
  </m:ToFolderId>
  <m:ItemIds>
    ${itemIdXml(ewsItemId)}
  </m:ItemIds>
</m:MoveItem>`
  })
}

/** Papierkorb oder endgueltiges Loeschen (HardDelete). */
export async function ewsDeleteMessage(
  accountId: string,
  restMessageId: string,
  opts?: { permanent?: boolean }
): Promise<void> {
  const ewsItemId = await translateRestIdToEwsId(accountId, restMessageId)
  const { token, anchor } = await ewsContext(accountId)
  const deleteType = opts?.permanent ? 'HardDelete' : 'MoveToDeletedItems'
  try {
    await postEwsSoap({
      accessToken: token,
      anchorMailbox: anchor,
      bodyXml: `<m:DeleteItem DeleteType="${deleteType}">
  <m:ItemIds>
    ${itemIdXml(ewsItemId)}
  </m:ItemIds>
</m:DeleteItem>`
    })
  } catch (e) {
    if (e instanceof EwsRequestError && e.responseCode === 'ErrorItemNotFound') {
      return
    }
    throw e
  }
}
