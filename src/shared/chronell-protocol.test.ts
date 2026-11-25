import { describe, expect, it } from 'vitest'
import {
  extractChronellWebinarLaunchesFromArgv,
  parseChronellWebinarArg
} from './chronell-protocol'

describe('parseChronellWebinarArg', () => {
  it('liest Einladung mit EventId', () => {
    expect(parseChronellWebinarArg('chronell://webinar?eventId=ABC-def')).toEqual({
      eventId: 'abcdef',
      action: 'invite'
    })
  })

  it('liest Erinnerung', () => {
    expect(
      parseChronellWebinarArg('chronell://webinar?eventId=man123&action=remind')
    ).toEqual({ eventId: 'man123', action: 'remind' })
  })

  it('ignoriert Commercial-Compose', () => {
    expect(
      parseChronellWebinarArg(
        'chronell://webinar?eventId=abc&action=compose&commercialId=c1'
      )
    ).toBeNull()
  })

  it('filtert Argv', () => {
    const launches = extractChronellWebinarLaunchesFromArgv([
      'Chronell.exe',
      'chronell://webinar?eventId=evt1',
      '--something',
      'chronell://webinar?eventId=evt1'
    ])
    expect(launches).toEqual([{ eventId: 'evt1', action: 'invite' }])
  })
})
