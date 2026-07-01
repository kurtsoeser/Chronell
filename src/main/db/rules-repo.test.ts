import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type Database from 'better-sqlite3'
import { createInMemoryTestDb, getLatestSchemaVersion, isInMemorySqliteAvailable } from '../../test-fixtures/db'
import { defaultRuleDefinition } from '@shared/mail-rules'

const { testDbRef } = vi.hoisted(() => ({
  testDbRef: { current: null as Database.Database | null }
}))

vi.mock('./index', () => ({
  getDb: () => {
    if (!testDbRef.current) throw new Error('test db not initialized')
    return testDbRef.current
  }
}))

import {
  deleteMailRule,
  getMailRule,
  hasRuleExecuted,
  insertMailRule,
  listEnabledRulesByTrigger,
  listMailRules,
  markRuleExecuted,
  updateMailRule
} from './rules-repo'

describe.skipIf(!isInMemorySqliteAvailable())('rules-repo', () => {
  beforeEach(() => {
    testDbRef.current = createInMemoryTestDb()
  })

  afterEach(() => {
    testDbRef.current?.close()
    testDbRef.current = null
  })

  it('startet mit aktuellem Schema', () => {
    const version = testDbRef.current!.pragma('user_version', { simple: true }) as number
    expect(version).toBe(getLatestSchemaVersion())
  })

  it('insertMailRule und listMailRules sortieren nach sort_order', () => {
    const def = defaultRuleDefinition()
    insertMailRule({
      name: 'Zweite',
      enabled: true,
      trigger: 'manual',
      sortOrder: 2,
      definition: def
    })
    const id1 = insertMailRule({
      name: 'Erste',
      enabled: true,
      trigger: 'on_receive',
      sortOrder: 1,
      definition: def
    })

    const rules = listMailRules()
    expect(rules).toHaveLength(2)
    expect(rules[0]!.id).toBe(id1)
    expect(rules[0]!.name).toBe('Erste')
    expect(rules[0]!.trigger).toBe('on_receive')
    expect(rules[1]!.name).toBe('Zweite')
  })

  it('updateMailRule aendert definition und Felder', () => {
    const id = insertMailRule({
      name: 'Alt',
      enabled: false,
      trigger: 'manual',
      sortOrder: 0,
      definition: defaultRuleDefinition()
    })
    const nextDef = defaultRuleDefinition()
    nextDef.actions = [{ type: 'move_to_folder', folderId: 42 }]

    updateMailRule(id, {
      name: 'Neu',
      enabled: true,
      trigger: 'on_receive',
      definition: nextDef
    })

    const rule = getMailRule(id)
    expect(rule?.name).toBe('Neu')
    expect(rule?.enabled).toBe(true)
    expect(rule?.trigger).toBe('on_receive')
    expect(rule?.definition.actions[0]?.type).toBe('move_to_folder')
  })

  it('kaputtes definition_json faellt auf leere Root-Gruppe zurueck', () => {
    testDbRef.current!
      .prepare(
        `INSERT INTO mail_rules (name, enabled, trigger, sort_order, definition_json, created_at, updated_at)
         VALUES ('kaputt', 1, 'manual', 0, 'not-json', datetime('now'), datetime('now'))`
      )
      .run()

    const rules = listMailRules()
    expect(rules[0]!.definition.version).toBe(1)
    expect(rules[0]!.definition.root.type).toBe('group')
    expect(rules[0]!.definition.actions).toEqual([])
  })

  it('markRuleExecuted und hasRuleExecuted sind idempotent', () => {
    const id = insertMailRule({
      name: 'Exec',
      enabled: true,
      trigger: 'on_receive',
      sortOrder: 0,
      definition: defaultRuleDefinition()
    })

    expect(hasRuleExecuted(id, 100)).toBe(false)
    markRuleExecuted(id, 100)
    expect(hasRuleExecuted(id, 100)).toBe(true)
    markRuleExecuted(id, 100)
    expect(hasRuleExecuted(id, 100)).toBe(true)

    const count = testDbRef.current!
      .prepare('SELECT COUNT(*) as c FROM mail_rule_executions WHERE rule_id = ? AND message_id = ?')
      .get(id, 100) as { c: number }
    expect(count.c).toBe(1)
  })

  it('deleteMailRule entfernt Ausfuehrungen per CASCADE', () => {
    const id = insertMailRule({
      name: 'Weg',
      enabled: true,
      trigger: 'manual',
      sortOrder: 0,
      definition: defaultRuleDefinition()
    })
    markRuleExecuted(id, 1)
    deleteMailRule(id)

    expect(getMailRule(id)).toBeNull()
    expect(hasRuleExecuted(id, 1)).toBe(false)
  })

  it('listEnabledRulesByTrigger filtert disabled und Trigger', () => {
    const def = defaultRuleDefinition()
    insertMailRule({
      name: 'Manual off',
      enabled: false,
      trigger: 'manual',
      sortOrder: 0,
      definition: def
    })
    insertMailRule({
      name: 'Receive on',
      enabled: true,
      trigger: 'on_receive',
      sortOrder: 1,
      definition: def
    })
    insertMailRule({
      name: 'Manual on',
      enabled: true,
      trigger: 'manual',
      sortOrder: 2,
      definition: def
    })

    const receive = listEnabledRulesByTrigger('on_receive')
    expect(receive).toHaveLength(1)
    expect(receive[0]!.name).toBe('Receive on')

    const manual = listEnabledRulesByTrigger('manual')
    expect(manual).toHaveLength(1)
    expect(manual[0]!.name).toBe('Manual on')
  })
})
