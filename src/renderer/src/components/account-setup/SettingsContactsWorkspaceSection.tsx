import { useCallback, useEffect, useState } from 'react'
import { Contact } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { PeopleListSort } from '@shared/types'
import { cn } from '@/lib/utils'
import {
  PEOPLE_SORT_CHANGED_EVENT,
  readStoredPeopleSort,
  writeStoredPeopleSort
} from '@/lib/people-sort-pref'

export function SettingsContactsWorkspaceSection({
  onOpenModule
}: {
  onOpenModule: () => void
}): JSX.Element {
  const { t } = useTranslation()
  const [sortBy, setSortBy] = useState<PeopleListSort>(() => readStoredPeopleSort())

  useEffect(() => {
    const onChanged = (): void => setSortBy(readStoredPeopleSort())
    window.addEventListener(PEOPLE_SORT_CHANGED_EVENT, onChanged)
    return (): void => window.removeEventListener(PEOPLE_SORT_CHANGED_EVENT, onChanged)
  }, [])

  const onSortChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>): void => {
    const v = e.target.value
    if (v !== 'displayName' && v !== 'givenName' && v !== 'surname') return
    writeStoredPeopleSort(v)
    setSortBy(v)
  }, [])

  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Contact className="h-3.5 w-3.5" aria-hidden />
        {t('settings.contactsWorkspaceHeading')}
      </h3>
      <p className="text-xs leading-relaxed text-muted-foreground">{t('settings.contactsWorkspaceIntro')}</p>
      <label className="block text-xs text-muted-foreground">
        <span className="mb-1 block font-medium text-foreground">{t('settings.contactsDefaultSortLabel')}</span>
        <span className="mb-1.5 block leading-relaxed">{t('settings.contactsDefaultSortHint')}</span>
        <select
          value={sortBy}
          onChange={onSortChange}
          className="w-full max-w-sm rounded-md border border-border bg-card px-2 py-1.5 text-sm text-foreground outline-none ring-primary focus:ring-1"
        >
          <option value="displayName">{t('people.shell.sortDisplayName')}</option>
          <option value="givenName">{t('people.shell.sortGivenName')}</option>
          <option value="surname">{t('people.shell.sortSurname')}</option>
        </select>
      </label>
      <button
        type="button"
        onClick={onOpenModule}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
          'bg-primary text-primary-foreground hover:bg-primary/90'
        )}
      >
        {t('settings.contactsOpenModule')}
      </button>
    </section>
  )
}
