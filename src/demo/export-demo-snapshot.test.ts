import { describe, expect, it } from 'vitest'
import { buildDemoWebSnapshot } from './export-demo-snapshot'
import { isInMemorySqliteAvailable } from '../test-fixtures/db'

const sqliteOk = isInMemorySqliteAvailable()

describe.skipIf(!sqliteOk)('buildDemoWebSnapshot', () => {
  it(
    'exports inbox messages, calendar, tasks and graph for web sandbox',
    { timeout: 60_000 },
    () => {
    const snap = buildDemoWebSnapshot()
    expect(snap.version).toBeGreaterThanOrEqual(4)
    expect(snap.messages.length).toBeGreaterThanOrEqual(28)
    expect(snap.calendarEvents.length).toBeGreaterThanOrEqual(20)
    expect(snap.cloudTasks.length).toBeGreaterThanOrEqual(28)
    expect(snap.graphNodes.length).toBeGreaterThanOrEqual(40)
    expect(snap.graphEdges.length).toBeGreaterThanOrEqual(35)
    expect(snap.accounts).toHaveLength(2)
    for (const m of snap.messages) {
      expect(m.subject).toBeTruthy()
      expect(m.fromName).toBeTruthy()
    }
    }
  )
})
