import { describe, expect, it, vi, beforeEach } from 'vitest'
import { resolvePeopleContactForPreview } from '@/app/notes/resolve-people-contact-for-preview'
import type { PeopleContactView } from '@shared/types'

const dave: PeopleContactView = {
  id: 99,
  accountId: 'acc-1',
  provider: 'microsoft',
  remoteId: 'c-dave',
  changeKey: null,
  displayName: 'Dave Grohl',
  givenName: 'Dave',
  surname: 'Grohl',
  company: 'Foo Fighters',
  jobTitle: null,
  department: null,
  officeLocation: null,
  birthdayIso: null,
  webPage: null,
  primaryEmail: 'dave@example.com',
  emailsJson: null,
  phonesJson: null,
  addressesJson: null,
  categoriesJson: null,
  notes: null,
  photoLocalPath: null,
  rawJson: null,
  isFavorite: false,
  updatedLocal: '',
  updatedRemote: null
}

describe('resolvePeopleContactForPreview', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      mailClient: {
        people: {
          getById: vi.fn(async () => null),
          findByEmail: vi.fn(async () => null),
          list: vi.fn(async () => [dave])
        }
      }
    })
  })

  it('finds contact by label when stored id is stale', async () => {
    const resolved = await resolvePeopleContactForPreview(42, {
      label: 'Dave Grohl',
      untitledLabel: 'Kontakt'
    })
    expect(resolved?.id).toBe(99)
    expect(resolved?.displayName).toBe('Dave Grohl')
  })
})
