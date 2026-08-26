import { describe, expect, it } from 'vitest'
import { rowFromGraph } from './people-graph'

describe('rowFromGraph phones', () => {
  it('maps Microsoft Graph phone fields into phonesJson', () => {
    const row = rowFromGraph('acc-1', {
      id: 'contact-1',
      displayName: 'Elias Söser',
      mobilePhone: '+43 660 5112467',
      businessPhones: ['+43 1 234567'],
      homePhones: []
    })
    expect(row?.phonesJson).toContain('+43 660 5112467')
    expect(row?.phonesJson).toContain('mobile')
    expect(row?.phonesJson).toContain('+43 1 234567')
  })
})
