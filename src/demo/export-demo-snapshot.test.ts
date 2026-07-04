import { describe, expect, it } from 'vitest'
import { buildDemoWebSnapshot } from './export-demo-snapshot'
import { isInMemorySqliteAvailable } from '../test-fixtures/db'

const sqliteOk = isInMemorySqliteAvailable()

describe.skipIf(!sqliteOk)('buildDemoWebSnapshot', () => {
  it('exports inbox messages, calendar, tasks and graph for web sandbox', () => {
    const snap = buildDemoWebSnapshot()
    expect(snap.version).toBeGreaterThanOrEqual(3)
    expect(snap.messages.length).toBeGreaterThanOrEqual(10)
    expect(snap.calendarEvents.length).toBeGreaterThanOrEqual(10)
    expect(snap.cloudTasks.length).toBeGreaterThanOrEqual(15)
    expect(snap.graphNodes.length).toBeGreaterThanOrEqual(10)
    expect(snap.graphEdges.length).toBeGreaterThanOrEqual(10)
    expect(snap.accounts).toHaveLength(2)
    for (const m of snap.messages) {
      expect(m.subject).toBeTruthy()
      expect(m.fromName).toBeTruthy()
    }
  })
})
