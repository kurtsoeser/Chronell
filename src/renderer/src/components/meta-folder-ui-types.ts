export interface MetaFolderScopeFolderGroup {
  accountId: string
  accountLabel: string
  folders: Array<{ id: number; name: string }>
}

export interface MetaFolderExcRowState {
  id: string
  textQuery: string
  unread: boolean
  flagged: boolean
  attach: boolean
  from: string
  matchOp: 'and' | 'or'
}
