/** Eigene Microsoft Forms (Ausfuell-Link fuer Webinar-Umfrage). */

export interface MsFormListItem {
  id: string
  title: string
  createdDate: string | null
  modifiedDate: string | null
  /** Klassischer ResponsePage-Ausfuell-Link. */
  responseUrl: string
}

export interface MsFormsListMineInput {
  accountId: string
}
