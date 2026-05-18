import { APP_PRODUCT_NAME } from './app-version'

/** Öffentliche Produktseite (GitHub Pages). */
export const APP_HOMEPAGE_URL = 'https://kurtsoeser.github.io/Chronell/' as const

/**
 * Zentrale Branding-Pfade.
 * Quelle: `resources/branding/Chromell-icon.svg` (Master); Renderer: `src/renderer/public/` (Vite).
 */
export const APP_BRANDING = {
  productName: APP_PRODUCT_NAME,
  homepageUrl: APP_HOMEPAGE_URL,
  /** Quadratisches App-Icon (SVG), Vite public root. */
  iconSvgPublicPath: '/chronell-icon.svg',
  /** Favicon PNG (32 px) — für Fensterleiste/Electron zuverlässiger als SVG. */
  faviconPngPublicPath: '/favicon.png',
  /** Tab/Favicon: PNG zuerst, SVG als Fallback. */
  faviconPublicPath: '/favicon.png'
} as const
