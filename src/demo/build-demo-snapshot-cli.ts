import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { writeDemoWebSnapshot } from './export-demo-snapshot'

const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url))
const outPath = join(REPO_ROOT, 'docs', 'demo', 'data', 'demo-snapshot.json')

const snapshot = writeDemoWebSnapshot(outPath)
console.log(
  `[demo:build-snapshot] ${outPath} — ${snapshot.messages.length} mails, ${snapshot.calendarEvents.length} events, ${snapshot.cloudTasks.length} tasks, ${snapshot.graphNodes.length} graph nodes`
)
