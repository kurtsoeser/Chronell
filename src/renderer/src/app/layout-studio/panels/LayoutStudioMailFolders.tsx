import { Sidebar } from '@/app/layout/Sidebar'
import { requestOpenAccountSettings } from '@/lib/open-account-settings'

/** Mail-Ordnernavigation (linke Mail-Spalte) für das Layout-Labor. */
export function LayoutStudioMailFolders(): JSX.Element {
  return (
    <div className="module-nav-column flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <Sidebar onOpenAccountDialog={(): void => requestOpenAccountSettings({ tab: 'accounts' })} />
    </div>
  )
}
