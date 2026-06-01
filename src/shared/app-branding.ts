import { APP_PRODUCT_NAME } from './app-version'

/** Offizielle Chronell-Website. */
export const APP_HOMEPAGE_URL = 'https://chronell.app/' as const

/** Datenschutzerklärung auf der Website. */
export const APP_PRIVACY_URL = 'https://chronell.app/datenschutz.html' as const

/**
 * Zentrale Branding-Pfade.
 * Quelle: `resources/branding/Chromell-icon.svg` (Master); Renderer: `src/renderer/public/` (Vite).
 */
export const APP_BRANDING = {
  productName: APP_PRODUCT_NAME,
  homepageUrl: APP_HOMEPAGE_URL,
  /** Quadratisches App-Icon (SVG), Datei unter `src/renderer/public/`. */
  iconSvgPublicFile: 'chronell-icon.svg',
  /** Favicon PNG (32 px) — für Fensterleiste/Electron zuverlässiger als SVG. */
  faviconPngPublicFile: 'favicon.png',
  /** Tab/Favicon: PNG zuerst, SVG als Fallback. */
  faviconPublicFile: 'favicon.png'
} as const
