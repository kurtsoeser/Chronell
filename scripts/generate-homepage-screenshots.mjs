/**
 * Erzeugt Homepage-Screenshots (1280×800 PNG) aus SVG-Mockups im Chronell Fluent-Look.
 * Ausführen: node scripts/generate-homepage-screenshots.mjs
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(__dirname, '..', 'docs', 'assets', 'screenshots')

const W = 1280
const H = 800

const colors = {
  bg: '#0b0c10',
  shell: '#14161c',
  sidebar: '#1a1d26',
  card: '#1e212b',
  muted: '#2a2f3d',
  line: 'rgba(255,255,255,0.08)',
  text: '#f0f1f4',
  sub: '#9aa0ad',
  accent: '#3478f6',
  violet: '#7c6fe1',
  green: '#3ecf8e'
}

function shell(title, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="glow" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#78b8fd" stop-opacity="0.15"/>
      <stop offset="55%" stop-color="#424cd0" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="#7c6fe1" stop-opacity="0.1"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="${colors.bg}"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <!-- title bar -->
  <rect x="0" y="0" width="${W}" height="44" fill="${colors.shell}"/>
  <circle cx="24" cy="22" r="9" fill="${colors.accent}"/>
  <text x="42" y="27" fill="${colors.text}" font-family="Segoe UI, sans-serif" font-size="13" font-weight="600">Chronell</text>
  <text x="1180" y="27" fill="${colors.sub}" font-family="Segoe UI, sans-serif" font-size="11">${title}</text>
  <!-- sidebar -->
  <rect x="0" y="44" width="200" height="${H - 44}" fill="${colors.sidebar}"/>
  <rect x="200" y="44" width="1" height="${H - 44}" fill="${colors.line}"/>
  ${body}
</svg>`
}

function sidebarItem(y, label, active = false) {
  const fill = active ? 'rgba(52,120,246,0.22)' : 'transparent'
  const tx = active ? colors.text : colors.sub
  return `
  <rect x="12" y="${y}" width="176" height="34" rx="8" fill="${fill}"/>
  <rect x="24" y="${y + 12}" width="14" height="10" rx="2" fill="${active ? colors.accent : colors.muted}"/>
  <text x="48" y="${y + 22}" fill="${tx}" font-family="Segoe UI, sans-serif" font-size="12">${label}</text>`
}

const mockups = {
  'mail-triage': shell(
    'Mail · Posteingang',
    `
  ${sidebarItem(60, 'Posteingang', true)}
  ${sidebarItem(100, 'Heute')}
  ${sidebarItem(140, 'In Bearbeitung')}
  ${sidebarItem(180, 'Warte auf')}
  ${sidebarItem(220, 'Kalender')}
  <rect x="220" y="60" width="520" height="${H - 80}" fill="${colors.card}" rx="12"/>
  <text x="240" y="92" fill="${colors.text}" font-size="14" font-weight="600">Posteingang</text>
  <rect x="240" y="108" width="480" height="52" rx="8" fill="rgba(52,120,246,0.12)" stroke="${colors.accent}" stroke-width="1"/>
  <rect x="256" y="124" width="220" height="8" rx="4" fill="${colors.text}" opacity="0.9"/>
  <rect x="256" y="140" width="160" height="6" rx="3" fill="${colors.sub}"/>
  <text x="660" y="138" fill="${colors.accent}" font-size="10">→ Heute 14:00</text>
  <rect x="240" y="172" width="480" height="48" rx="8" fill="${colors.muted}"/>
  <rect x="256" y="188" width="200" height="7" rx="3" fill="${colors.sub}"/>
  <rect x="240" y="228" width="480" height="48" rx="8" fill="${colors.muted}"/>
  <rect x="256" y="244" width="180" height="7" rx="3" fill="${colors.sub}"/>
  <rect x="760" y="60" width="500" height="${H - 80}" fill="${colors.card}" rx="12"/>
  <text x="780" y="92" fill="${colors.text}" font-size="14" font-weight="600">Lesefenster</text>
  <rect x="780" y="110" width="420" height="10" rx="4" fill="${colors.text}"/>
  <rect x="780" y="132" width="360" height="8" rx="4" fill="${colors.sub}"/>
  <rect x="780" y="160" width="460" height="120" rx="8" fill="${colors.muted}"/>
  <rect x="780" y="300" width="120" height="28" rx="14" fill="${colors.accent}"/>
  <text x="808" y="318" fill="#fff" font-size="11">ToDo anlegen</text>
  `
  ),

  calendar: shell(
    'Kalender · Zeitliste',
    `
  ${sidebarItem(60, 'Mail')}
  ${sidebarItem(100, 'Kalender', true)}
  <rect x="220" y="60" width="700" height="${H - 80}" fill="${colors.card}" rx="12"/>
  <text x="240" y="92" fill="${colors.text}" font-size="14" font-weight="600">Mai 2026</text>
  <rect x="240" y="110" width="660" height="320" rx="8" fill="${colors.muted}"/>
  <rect x="260" y="140" width="80" height="60" rx="6" fill="rgba(52,120,246,0.35)"/>
  <rect x="360" y="160" width="120" height="40" rx="6" fill="rgba(124,111,225,0.4)"/>
  <rect x="500" y="130" width="100" height="70" rx="6" fill="rgba(62,207,142,0.35)"/>
  <rect x="760" y="60" width="500" height="${H - 80}" fill="${colors.card}" rx="12"/>
  <text x="780" y="92" fill="${colors.text}" font-size="14" font-weight="600">Termin-Vorschau</text>
  <rect x="780" y="110" width="440" height="140" rx="8" fill="${colors.muted}"/>
  <rect x="800" y="130" width="200" height="10" rx="4" fill="${colors.text}"/>
  <rect x="800" y="150" width="160" height="8" rx="4" fill="${colors.sub}"/>
  <text x="780" y="280" fill="${colors.sub}" font-size="11">Cloud-Task · Zeitliste</text>
  <rect x="780" y="296" width="460" height="72" rx="8" fill="rgba(52,120,246,0.1)" stroke="${colors.accent}" stroke-width="1"/>
  `
  ),

  design: shell(
    'Fluent Design · Midnight',
    `
  ${sidebarItem(60, 'Home')}
  ${sidebarItem(100, 'Mail', true)}
  <rect x="220" y="60" width="1040" height="${H - 80}" fill="${colors.card}" rx="12"/>
  <text x="240" y="92" fill="${colors.text}" font-size="14" font-weight="600">Oberfläche · Fluent 2</text>
  <rect x="240" y="120" width="320" height="200" rx="10" fill="${colors.muted}"/>
  <text x="260" y="148" fill="${colors.sub}" font-size="11">Mica · L0</text>
  <rect x="260" y="160" width="280" height="140" rx="8" fill="${colors.bg}"/>
  <rect x="580" y="120" width="320" height="200" rx="10" fill="rgba(255,255,255,0.06)" stroke="${colors.line}"/>
  <text x="600" y="148" fill="${colors.sub}" font-size="11">Acrylic · Popover</text>
  <rect x="600" y="170" width="280" height="100" rx="8" fill="rgba(30,31,38,0.85)"/>
  <rect x="920" y="120" width="320" height="200" rx="10" fill="${colors.muted}"/>
  <text x="940" y="148" fill="${colors.sub}" font-size="11">Presets</text>
  <rect x="940" y="168" width="90" height="36" rx="8" fill="${colors.accent}"/>
  <text x="958" y="191" fill="#fff" font-size="10">Fluent</text>
  <rect x="1040" y="168" width="90" height="36" rx="8" fill="#1a2030" stroke="${colors.violet}" stroke-width="1"/>
  <text x="1055" y="191" fill="${colors.text}" font-size="10">Midnight</text>
  <rect x="240" y="340" width="1000" height="380" rx="10" fill="${colors.bg}"/>
  <rect x="260" y="360" width="960" height="40" rx="6" fill="${colors.shell}"/>
  <rect x="260" y="420" width="200" height="280" rx="6" fill="${colors.sidebar}"/>
  <rect x="480" y="420" width="520" height="280" rx="6" fill="${colors.card}"/>
  <rect x="1020" y="420" width="200" height="280" rx="6" fill="rgba(52,120,246,0.15)"/>
  `
  ),

  connections: shell(
    'Verbindungen · Graph',
    `
  ${sidebarItem(60, 'Mail')}
  ${sidebarItem(100, 'Verbindungen', true)}
  <rect x="220" y="60" width="720" height="${H - 80}" fill="${colors.card}" rx="12"/>
  <circle cx="420" cy="280" r="36" fill="${colors.accent}"/>
  <circle cx="580" cy="220" r="28" fill="${colors.violet}"/>
  <circle cx="520" cy="380" r="32" fill="${colors.green}"/>
  <circle cx="700" cy="320" r="24" fill="${colors.muted}" stroke="${colors.sub}"/>
  <line x1="420" y1="280" x2="580" y2="220" stroke="${colors.accent}" stroke-width="2" opacity="0.7"/>
  <line x1="420" y1="280" x2="520" y2="380" stroke="${colors.violet}" stroke-width="2" opacity="0.7"/>
  <line x1="580" y1="220" x2="700" y2="320" stroke="${colors.sub}" stroke-width="1.5" opacity="0.5"/>
  <rect x="960" y="60" width="300" height="${H - 80}" fill="${colors.card}" rx="12"/>
  <text x="980" y="92" fill="${colors.text}" font-size="13" font-weight="600">Notiz-Vorschau</text>
  <rect x="980" y="110" width="260" height="180" rx="8" fill="${colors.muted}"/>
  <rect x="996" y="128" width="180" height="8" rx="4" fill="${colors.text}"/>
  <rect x="996" y="148" width="220" height="6" rx="3" fill="${colors.sub}"/>
  <text x="980" y="320" fill="${colors.sub}" font-size="10">Mini-Graph · Kontext</text>
  <rect x="980" y="336" width="260" height="100" rx="8" fill="rgba(124,111,225,0.15)"/>
  `
  ),

  work: shell(
    'Alle Arbeit · Kanban',
    `
  ${sidebarItem(60, 'Mail')}
  ${sidebarItem(100, 'Alle Arbeit', true)}
  <rect x="220" y="60" width="1040" height="${H - 80}" fill="${colors.card}" rx="12"/>
  <text x="240" y="92" fill="${colors.text}" font-size="14" font-weight="600">Workflow</text>
  <rect x="240" y="110" width="320" height="520" rx="10" fill="${colors.muted}"/>
  <text x="260" y="138" fill="${colors.sub}" font-size="11">In Bearbeitung</text>
  <rect x="260" y="156" width="280" height="72" rx="8" fill="${colors.card}" stroke="${colors.accent}" stroke-width="1"/>
  <rect x="276" y="176" width="160" height="8" rx="4" fill="${colors.text}"/>
  <rect x="580" y="110" width="320" height="520" rx="10" fill="${colors.muted}"/>
  <text x="600" y="138" fill="${colors.sub}" font-size="11">Heute</text>
  <rect x="600" y="156" width="280" height="72" rx="8" fill="${colors.card}"/>
  <rect x="920" y="110" width="320" height="520" rx="10" fill="${colors.muted}"/>
  <text x="940" y="138" fill="${colors.sub}" font-size="11">Erledigt</text>
  `
  ),

  dashboard: shell(
    'Home · Dashboard',
    `
  ${sidebarItem(60, 'Home', true)}
  ${sidebarItem(100, 'Mail')}
  <rect x="220" y="60" width="500" height="240" fill="${colors.card}" rx="12"/>
  <text x="240" y="92" fill="${colors.text}" font-size="13" font-weight="600">Posteingang</text>
  <rect x="240" y="110" width="460" height="160" rx="8" fill="${colors.muted}"/>
  <rect x="740" y="60" width="500" height="240" fill="${colors.card}" rx="12"/>
  <text x="760" y="92" fill="${colors.text}" font-size="13" font-weight="600">Heute</text>
  <rect x="760" y="110" width="460" height="160" rx="8" fill="${colors.muted}"/>
  <rect x="220" y="320" width="500" height="360" fill="${colors.card}" rx="12"/>
  <text x="240" y="352" fill="${colors.text}" font-size="13" font-weight="600">Kalender</text>
  <rect x="740" y="320" width="500" height="360" fill="${colors.card}" rx="12"/>
  <text x="760" y="352" fill="${colors.text}" font-size="13" font-weight="600">Alle Arbeit</text>
  `
  )
}

await fs.mkdir(outDir, { recursive: true })

for (const [name, svg] of Object.entries(mockups)) {
  const outPath = path.join(outDir, `${name}.png`)
  await sharp(Buffer.from(svg)).resize(W, H).png({ compressionLevel: 9 }).toFile(outPath)
  const stat = await fs.stat(outPath)
  console.log(`  ${name}.png  (${Math.round(stat.size / 1024)} KB)`)
}

console.log(`\nFertig: ${outDir}`)
