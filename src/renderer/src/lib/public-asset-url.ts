/**
 * Public-Assets aus `src/renderer/public/` (Vite).
 * In der gepackten App (`loadFile` + `file://`) müssen URLs relativ zu `index.html` sein —
 * absolute Pfade wie `/chronell-icon.svg` laden sonst von `file:///chronell-icon.svg`.
 */
export function publicAssetUrl(file: string): string {
  const name = file.replace(/^\//, '')
  const base = import.meta.env.BASE_URL
  return `${base}${name}`
}
