import { describe, expect, it } from 'vitest'
import { defaultRuleDefinition, RULE_ACTION_TYPES, RULE_CONDITION_FIELDS } from './mail-rules'

describe('mail-rules', () => {
  it('defaultRuleDefinition hat gueltige Struktur', () => {
    const def = defaultRuleDefinition()
    expect(def.version).toBe(1)
    expect(def.root.type).toBe('group')
    expect(def.root.combinator).toBe('and')
    expect(def.root.children[0]?.type).toBe('condition')
    expect(def.actions[0]?.type).toBe('mark_read')
  })

  it('RULE_CONDITION_FIELDS deckt Kernfelder ab', () => {
    const ids = RULE_CONDITION_FIELDS.map((f) => f.id)
    expect(ids).toContain('from')
    expect(ids).toContain('subject')
    expect(ids).toContain('is_read')
  })

  it('RULE_ACTION_TYPES markiert nicht implementierte Aktionen', () => {
    const forward = RULE_ACTION_TYPES.find((a) => a.id === 'forward_to')
    const move = RULE_ACTION_TYPES.find((a) => a.id === 'move_to_folder')
    expect(forward?.implemented).toBe(false)
    expect(move?.implemented).toBe(true)
  })
})
