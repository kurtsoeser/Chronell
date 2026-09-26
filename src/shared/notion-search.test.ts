import { describe, expect, it } from 'vitest'
import {
  notionTitleMatchesQuery,
  parseNotionSearchQuery,
  richTextSegmentsToPlain
} from './notion-search'

describe('richTextSegmentsToPlain', () => {
  it('verbindet Text und Mention-plain_text', () => {
    expect(
      richTextSegmentsToPlain([
        { plain_text: 'TN ' },
        { plain_text: 'Webinar WRWKS „Mehr als Prompts“' }
      ])
    ).toBe('TN Webinar WRWKS „Mehr als Prompts“')
  })

  it('nimmt nicht nur das erste Segment', () => {
    expect(richTextSegmentsToPlain([{ plain_text: 'TN ' }])).toBe('TN')
  })
})

describe('parseNotionSearchQuery', () => {
  it('erkennt Phrasensuche mit Anfuehrungszeichen', () => {
    expect(parseNotionSearchQuery('"Webinar WRWKS"')).toEqual({
      apiQuery: 'Webinar WRWKS',
      phrase: 'Webinar WRWKS',
      tokens: []
    })
    expect(parseNotionSearchQuery('„TN Webinar“')).toEqual({
      apiQuery: 'TN Webinar',
      phrase: 'TN Webinar',
      tokens: []
    })
  })

  it('zerlegt sonst in Tokens', () => {
    expect(parseNotionSearchQuery('Webinar WRKS')).toEqual({
      apiQuery: 'Webinar WRKS',
      phrase: null,
      tokens: ['webinar', 'wrks']
    })
  })
})

describe('notionTitleMatchesQuery', () => {
  const title = 'TN Webinar WRWKS „Mehr als Prompts: Effektive Interaktion mit Copilot“'

  it('findet Phrase in Anfuehrungszeichen', () => {
    expect(notionTitleMatchesQuery(title, parseNotionSearchQuery('"WRWKS"'))).toBe(true)
    expect(notionTitleMatchesQuery(title, parseNotionSearchQuery('"WRKS"'))).toBe(false)
  })

  it('fordert alle Tokens', () => {
    expect(notionTitleMatchesQuery(title, parseNotionSearchQuery('Webinar WRWKS'))).toBe(true)
    expect(notionTitleMatchesQuery(title, parseNotionSearchQuery('Webinar WRKS'))).toBe(false)
    expect(notionTitleMatchesQuery(title, parseNotionSearchQuery('TN'))).toBe(true)
  })
})
