/** Semantic version — keep in sync with `package.json` `version`. */
export const APP_VERSION = '0.9.11' as const

/** ISO date (YYYY-MM-DD) of the current release milestone. */
export const APP_RELEASE_DATE_ISO = '2026-05-18' as const

/** Marketing / UI product name. */
export const APP_PRODUCT_NAME = 'Chronell' as const

/** electron-builder `appId`. */
export const APP_ID = 'at.kurtsoeser.mailclient' as const

export function formatAppReleaseDate(locale: string): string {
  const tag = locale.startsWith('de') ? 'de-AT' : 'en-GB'
  return new Intl.DateTimeFormat(tag, { dateStyle: 'long' }).format(
    new Date(`${APP_RELEASE_DATE_ISO}T12:00:00`)
  )
}
