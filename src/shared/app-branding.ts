import { APP_PRODUCT_NAME } from './app-version'

/**
 * Zentrale Branding-Pfade.
 * Quelle: `resources/branding/Chromell-icon.svg` (Master); Renderer: `src/renderer/public/` (Vite).
 */
export const APP_BRANDING = {
  productName: APP_PRODUCT_NAME,
  /** Quadratisches App-Icon (SVG), Vite public root. */
  iconSvgPublicPath: '/chronell-icon.svg',
  /** Tab/Favicon — identisch zum App-Icon. */
  faviconPublicPath: '/chronell-icon.svg'
} as const
