/**
 * Erzeugt docs/IPC-REFERENCE.md aus ipc-channels.ts und register-*-ipc.ts.
 * Aufruf: node scripts/generate-ipc-reference.mjs
 */
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const channelsFile = path.join(root, 'src/shared/ipc-channels.ts')
const ipcDir = path.join(root, 'src/main/ipc')
const outFile = path.join(root, 'docs/IPC-REFERENCE.md')

function extractInvokeChannels(ts) {
  const channels = new Set()
  for (const m of ts.matchAll(/'([a-z][a-z0-9-]*:[a-z0-9-]+)'/g)) {
    channels.add(m[1])
  }
  return [...channels].sort()
}

function extractHandlerMap(dir) {
  const map = new Map()
  for (const name of fs.readdirSync(dir)) {
    if (!name.startsWith('register-') || !name.endsWith('-ipc.ts')) continue
    const file = path.join(dir, name)
    const content = fs.readFileSync(file, 'utf8')
    const count = (content.match(/ipcMain\.handle\(/g) ?? []).length
    map.set(`src/main/ipc/${name}`, count)
  }
  return map
}

const channelsTs = fs.readFileSync(channelsFile, 'utf8')
const channels = extractInvokeChannels(channelsTs)
const handlers = extractHandlerMap(ipcDir)
const handlerTotal = [...handlers.values()].reduce((a, b) => a + b, 0)

const byPrefix = new Map()
for (const ch of channels) {
  const prefix = ch.split(':')[0]
  if (!byPrefix.has(prefix)) byPrefix.set(prefix, [])
  byPrefix.get(prefix).push(ch)
}

const eventChannels = [
  'accounts:changed',
  'app:connectivity',
  'app:window-maximized-changed',
  'calendar:changed',
  'calendar:ics-file-open',
  'calendar:sync-status',
  'entity-embeddings:index-progress',
  'entity-links:ai-scan-progress',
  'entity-links:changed',
  'mail-body-index:progress',
  'mail:bulk-unflag-progress',
  'mail:changed',
  'mail:sync-meta-changed',
  'mail-reading-popout:closed',
  'mail-reading-popout:dock',
  'notes:changed',
  'panel-popout:closed',
  'panel-popout:dock',
  'profile-sync:applied',
  'profile-sync:status',
  'sync:status',
  'tasks:changed',
  'teams-chat-popout:closed'
]

let md = `# IPC-Referenz (generiert)

> Automatisch erzeugt durch \`npm run docs:ipc-reference\`. Nicht manuell bearbeiten.

Stand: ${new Date().toISOString().slice(0, 10)}

## Übersicht

| Metrik | Wert |
|--------|------|
| Invoke-Kanäle (\`ipcMain.handle\`) | ${channels.length} in \`ipc-channels.ts\` |
| Registrierte Handler (Summe) | ${handlerTotal} in \`src/main/ipc/register-*-ipc.ts\` |
| Push-Events (Main → Renderer) | ${eventChannels.length} (siehe unten) |

Quelle der Kanalnamen: [\`src/shared/ipc-channels.ts\`](../src/shared/ipc-channels.ts)

## Handler-Registrierung nach Datei

| Datei | \`ipcMain.handle\`-Aufrufe |
|-------|---------------------------|
`

for (const [file, count] of [...handlers.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  md += `| \`${file}\` | ${count} |\n`
}

md += `
## Invoke-Kanäle nach Namespace

Renderer ruft Kanäle über \`window.mailClient.*\` → \`ipcRenderer.invoke\` im Preload auf.
Main registriert Handler in \`src/main/ipc/register-*-ipc.ts\`.

`

for (const [prefix, list] of [...byPrefix.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  md += `### \`${prefix}:\`\n\n`
  for (const ch of list) {
    md += `- \`${ch}\`\n`
  }
  md += '\n'
}

md += `## Push-Events (ohne invoke)

Main sendet mit \`webContents.send\`; Preload abonniert via \`ipcRenderer.on\` und stellt Listener unter \`window.mailClient.events\` bereit.

| Kanal | Typische Nutzung |
|-------|------------------|
`

const eventHints = {
  'mail:changed': 'Mail-Liste / Ordner-Zähler neu laden',
  'calendar:changed': 'Kalender-Events neu laden',
  'tasks:changed': 'Cloud-Tasks neu laden',
  'notes:changed': 'Notizen-Listen aktualisieren',
  'entity-links:changed': 'Verbindungs-Graph invalidieren',
  'sync:status': 'Sync-Fortschritt in UI',
  'accounts:changed': 'Kontenliste im Renderer',
  'app:connectivity': 'Online/Offline-Badge',
  'profile-sync:status': 'Cloud-Sync-Status',
  'profile-sync:applied': 'Profil-Daten nach Pull anwenden'
}

for (const ch of eventChannels) {
  md += `| \`${ch}\` | ${eventHints[ch] ?? '—'} |\n`
}

md += `
## Neue Kanäle hinzufügen

1. Konstante in \`src/shared/ipc-channels.ts\`
2. Input/Output-Typen in \`src/shared/types.ts\` (oder domänennahes Modul)
3. \`ipcMain.handle\` in passender \`register-*-ipc.ts\`
4. Methode in \`src/preload/index.ts\` → \`window.mailClient\`
5. Typ in \`src/renderer/src/global.d.ts\` (MailClientApi)
6. Dieses Dokument neu generieren: \`npm run docs:ipc-reference\`
`

fs.writeFileSync(outFile, md)
console.log(`[ipc-reference] ${channels.length} invoke channels → ${path.relative(root, outFile)}`)
