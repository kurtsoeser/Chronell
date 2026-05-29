/** Geparste EWS-Nachricht aus SyncFolderItems (ohne Body — Body on-demand). */
export interface EwsSyncMessageFields {
  ewsItemId: string
  changeKey: string | null
  subject: string | null
  fromAddr: string | null
  fromName: string | null
  toAddrs: string | null
  ccAddrs: string | null
  conversationId: string | null
  preview: string | null
  sentAt: string | null
  receivedAt: string | null
  isRead: boolean
  hasAttachments: boolean
  importance: 'low' | 'normal' | 'high' | null
  followUpFlagStatus: 'notFlagged' | 'flagged' | 'complete'
}

export type EwsSyncChange =
  | { kind: 'create' | 'update'; itemXml: string }
  | { kind: 'delete'; ewsItemId: string }
  | { kind: 'read-flag'; ewsItemId: string; isRead: boolean }

export interface EwsSyncFolderItemsPage {
  syncState: string | null
  includesLastItemInRange: boolean
  changes: EwsSyncChange[]
}

function firstTagText(xml: string, tag: string): string | null {
  const re = new RegExp(`<(?:t:)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:t:)?${tag}>`, 'i')
  const m = xml.match(re)
  if (!m) return null
  const inner = m[1]!.trim()
  if (!inner.includes('<')) return inner || null
  return null
}

function attrValue(xml: string, tag: string, attr: string): string | null {
  const re = new RegExp(`<(?:t:)?${tag}[^>]*\\s${attr}="([^"]*)"`, 'i')
  return xml.match(re)?.[1]?.trim() ?? null
}

function parseMailboxBlock(xml: string, tag: string): { email: string | null; name: string | null } {
  const blockRe = new RegExp(`<(?:t:)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:t:)?${tag}>`, 'i')
  const block = xml.match(blockRe)?.[1]
  if (!block) return { email: null, name: null }
  return {
    email: firstTagText(block, 'EmailAddress'),
    name: firstTagText(block, 'Name')
  }
}

function joinMailboxes(xml: string, tag: string): string | null {
  const re = new RegExp(`<(?:t:)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:t:)?${tag}>`, 'gi')
  const parts: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) !== null) {
    const block = m[1]!
    const email = firstTagText(block, 'EmailAddress')
    const name = firstTagText(block, 'Name')
    if (name && email) parts.push(`${name} <${email}>`)
    else if (email) parts.push(email)
    else if (name) parts.push(name)
  }
  return parts.length > 0 ? parts.join(', ') : null
}

function parseImportance(raw: string | null): 'low' | 'normal' | 'high' | null {
  if (!raw) return null
  const v = raw.toLowerCase()
  if (v === 'low') return 'low'
  if (v === 'high') return 'high'
  if (v === 'normal') return 'normal'
  return null
}

function parseFollowUp(xml: string): 'notFlagged' | 'flagged' | 'complete' {
  const block = xml.match(/<(?:t:)?Flag[^>]*>([\s\S]*?)<\/(?:t:)?Flag>/i)?.[1]
  if (!block) return 'notFlagged'
  const status = firstTagText(block, 'FlagStatus')?.toLowerCase()
  if (status === 'flagged') return 'flagged'
  if (status === 'complete') return 'complete'
  return 'notFlagged'
}

export function parseEwsMessageFields(itemXml: string): EwsSyncMessageFields | null {
  const ewsItemId = attrValue(itemXml, 'ItemId', 'Id')
  if (!ewsItemId) return null
  const from = parseMailboxBlock(itemXml, 'From')
  const sender = parseMailboxBlock(itemXml, 'Sender')
  const fromAddr = from.email ?? sender.email
  const fromName = from.name ?? sender.name
  const isReadRaw = firstTagText(itemXml, 'IsRead')
  return {
    ewsItemId,
    changeKey: attrValue(itemXml, 'ItemId', 'ChangeKey'),
    subject: firstTagText(itemXml, 'Subject'),
    fromAddr,
    fromName,
    toAddrs: joinMailboxes(itemXml, 'ToRecipients'),
    ccAddrs: joinMailboxes(itemXml, 'CcRecipients'),
    conversationId: attrValue(itemXml, 'ConversationId', 'Id'),
    preview: firstTagText(itemXml, 'Preview'),
    sentAt: firstTagText(itemXml, 'DateTimeSent'),
    receivedAt: firstTagText(itemXml, 'DateTimeReceived'),
    isRead: isReadRaw?.toLowerCase() === 'true',
    hasAttachments: firstTagText(itemXml, 'HasAttachments')?.toLowerCase() === 'true',
    importance: parseImportance(firstTagText(itemXml, 'Importance')),
    followUpFlagStatus: parseFollowUp(itemXml)
  }
}

export function parseSyncFolderItemsResponse(xml: string): EwsSyncFolderItemsPage {
  const syncState =
    xml.match(/<(?:m:)?SyncState[^>]*>([\s\S]*?)<\/(?:m:)?SyncState>/i)?.[1]?.trim() ?? null
  const includesLast =
    xml.match(/<(?:m:)?IncludesLastItemInRange[^>]*>([^<]+)<\/(?:m:)?IncludesLastItemInRange>/i)?.[1]
      ?.trim()
      .toLowerCase() === 'true'

  const changes: EwsSyncChange[] = []
  const changesBlock = xml.match(/<(?:t:)?Changes[^>]*>([\s\S]*?)<\/(?:t:)?Changes>/i)?.[1] ?? ''

  const createRe =
    /<(?:t:)?Create[^>]*>([\s\S]*?)<\/(?:t:)?Create>/gi
  let m: RegExpExecArray | null
  while ((m = createRe.exec(changesBlock)) !== null) {
    changes.push({ kind: 'create', itemXml: m[1]! })
  }

  const updateRe =
    /<(?:t:)?Update[^>]*>([\s\S]*?)<\/(?:t:)?Update>/gi
  while ((m = updateRe.exec(changesBlock)) !== null) {
    changes.push({ kind: 'update', itemXml: m[1]! })
  }

  const deleteRe =
    /<(?:t:)?Delete[^>]*>([\s\S]*?)<\/(?:t:)?Delete>/gi
  while ((m = deleteRe.exec(changesBlock)) !== null) {
    const id = attrValue(m[1]!, 'ItemId', 'Id')
    if (id) changes.push({ kind: 'delete', ewsItemId: id })
  }

  const readRe =
    /<(?:t:)?ReadFlagChange[^>]*>([\s\S]*?)<\/(?:t:)?ReadFlagChange>/gi
  while ((m = readRe.exec(changesBlock)) !== null) {
    const block = m[1]!
    const id = attrValue(block, 'ItemId', 'Id')
    const isRead = firstTagText(block, 'IsRead')?.toLowerCase() === 'true'
    if (id) changes.push({ kind: 'read-flag', ewsItemId: id, isRead })
  }

  return {
    syncState,
    includesLastItemInRange: includesLast,
    changes
  }
}
