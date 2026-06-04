import { ChevronDown, MoreHorizontal } from 'lucide-react'
import { useTranslation } from 'react-i18next'

/** Unsichtbare Breitenmessung für den Overflow-Button (ResizeObserver). */
export function TopbarTabsOverflowMeasureButton({
  measureRef
}: {
  measureRef: React.Ref<HTMLButtonElement>
}): JSX.Element {
  const { t } = useTranslation()
  return (
    <button
      ref={measureRef}
      type="button"
      tabIndex={-1}
      aria-hidden
      className="pointer-events-none invisible absolute h-0 overflow-hidden whitespace-nowrap"
    >
      <span className="inline-flex h-12 items-center gap-1 px-2.5 text-xs font-medium sm:px-3">
        <MoreHorizontal className="h-4 w-4 shrink-0 sm:hidden" />
        <span className="hidden sm:inline">{t('topbar.tabsOverflow')}</span>
        <ChevronDown className="hidden h-3.5 w-3.5 shrink-0 sm:block" />
      </span>
    </button>
  )
}
