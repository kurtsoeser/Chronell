/**
 * Gebündelte Composer-Schriften (@fontsource, OFL) — lazy pro Familie.
 * Wird beim ersten Gebrauch im TipTap-Toolbar geladen (nicht über Google Fonts CDN).
 */
const loaded = new Set<string>()

const FONT_CSS_LOADERS: Record<string, () => Promise<unknown>> = {
  'noto-serif': () => import('@fontsource/noto-serif/400.css'),
  raleway: () => import('@fontsource/raleway/400.css'),
  roboto: () => import('@fontsource/roboto/400.css'),
  'open-sans': () => import('@fontsource/open-sans/400.css'),
  lato: () => import('@fontsource/lato/400.css'),
  inter: () => import('@fontsource/inter/400.css'),
  'source-sans-3': () => import('@fontsource/source-sans-3/400.css'),
  nunito: () => import('@fontsource/nunito/400.css'),
  'pt-sans': () => import('@fontsource/pt-sans/400.css'),
  oswald: () => import('@fontsource/oswald/400.css'),
  merriweather: () => import('@fontsource/merriweather/400.css'),
  /** UI-Noto Sans wird in main.tsx geladen — hier nur als No-Op für Composer-Dropdown. */
  'noto-sans': async () => undefined
}

/** Lädt eine gebündelte Composer-Schrift einmalig (idempotent). */
export async function ensureComposeBundledFontLoaded(fontsource: string | undefined): Promise<void> {
  if (!fontsource || loaded.has(fontsource)) return
  const loader = FONT_CSS_LOADERS[fontsource]
  if (!loader) return
  loaded.add(fontsource)
  await loader()
}

/** Lädt alle gebündelten Composer-Schriften (Legacy-Fallback — vermeiden). */
export async function ensureAllComposeBundledFontsLoaded(): Promise<void> {
  await Promise.all(
    Object.keys(FONT_CSS_LOADERS)
      .filter((k) => k !== 'noto-sans')
      .map((k) => ensureComposeBundledFontLoaded(k))
  )
}
