/**
 * Einmaliges Split von src/shared/types.ts → src/shared/types/*.ts
 * Aufruf: node scripts/split-shared-types.mjs
 */
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const src = path.join(root, 'src/shared/types.ts')
const outDir = path.join(root, 'src/shared/types')

const lines = fs.readFileSync(src, 'utf8').split(/\r?\n/)

/** [filename, startLine, endLine] — 1-basiert, inklusive */
const chunks = [
  [
    'account.ts',
    4,
    124,
    `import type { AccountAvatarIconId, AccountAvatarKind } from '../account-avatar'\nimport type { MailRuleDefinition, MailRuleTrigger } from '../mail-rules'\n\n`
  ],
  ['app-config.ts', 125, 306, `export type { LocationSearchLanguage, LocationSuggestion } from '../location-search'\n\n`],
  ['settings-backup.ts', 307, 596, ''],
  ['local-data.ts', 597, 654, ''],
  ['workflow.ts', 655, 672, ''],
  ['calendar.ts', 673, 1084, ''],
  [
    'tasks.ts',
    1086,
    1261,
    `import type { CalendarRecurrenceFrequency, CalendarRecurrenceRangeEndMode } from './calendar'\n\n`
  ],
  ['people.ts', 1263, 1387, `import type { Provider } from './account'\n\n`],
  ['mail.ts', 1388, 1727, `import type { Provider } from './account'\n\n`],
  ['teams.ts', 1728, 1788, `import type { MailListItem } from './mail'\n\n`],
  ['notes.ts', 1789, 2032, ''],
  ['notion.ts', 2033, 2115, `import type { CalendarEventView } from './calendar'\n\n`],
  ['compose.ts', 2133, 2388, ''],
  ['mail-misc.ts', 2390, 2445, `import type { MailListItem } from './mail'\n\n`]
]

fs.mkdirSync(outDir, { recursive: true })

for (const [name, start, end, header] of chunks) {
  const body = lines.slice(start - 1, end).join('\n')
  const content = `${header}${body}\n`
  fs.writeFileSync(path.join(outDir, name), content)
  console.log('wrote', name, end - start + 1, 'lines')
}

const index = `/** Barrel — alle Typen aus dem früheren types.ts. */
export * from './account'
export * from './app-config'
export * from './settings-backup'
export * from './local-data'
export * from './workflow'
export * from './calendar'
export * from './tasks'
export * from './people'
export * from './mail'
export * from './teams'
export * from './notes'
export * from './notion'
export * from './compose'
export * from './mail-misc'

export type {
  BookingsAppointmentRow,
  BookingsBusinessDetail,
  BookingsBusinessRow,
  BookingsGetBusinessInput,
  BookingsListAppointmentsInput,
  BookingsListBusinessesInput,
  BookingsListServicesInput,
  BookingsListStaffMembersInput,
  BookingsServiceRow,
  BookingsStaffMemberRow
} from '../bookings-types'

export { IPC } from '../ipc-channels'
`

fs.writeFileSync(path.join(outDir, 'index.ts'), index)

const barrel = `/** @deprecated Import bevorzugt aus \`@shared/types/<modul>\` — Barrel bleibt für Abwärtskompatibilität. */
export * from './types/index'
`

fs.writeFileSync(src, barrel)
console.log('replaced types.ts with barrel')
