import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { chronellPromptCardClass } from '@/lib/chronell-ui-classes'

interface OnboardingShellProps {
  wizardTitle: string
  heading: string
  description?: string
  learnMoreHref?: string | null
  onLearnMore?: () => void
  children: React.ReactNode
  footer: React.ReactNode
  onClose: () => void
  closeDisabled?: boolean
  wide?: boolean
}

export function OnboardingShell({
  wizardTitle,
  heading,
  description,
  learnMoreHref,
  onLearnMore,
  children,
  footer,
  onClose,
  closeDisabled,
  wide
}: OnboardingShellProps): JSX.Element {
  const { t } = useTranslation()

  return (
    <div className="fixed inset-0 z-[350] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div
        className={cn(
          chronellPromptCardClass,
          'flex max-h-[min(720px,92vh)] flex-col overflow-hidden shadow-2xl',
          wide ? 'w-[min(780px,96vw)]' : 'w-[min(640px,96vw)]'
        )}
        role="dialog"
        aria-labelledby="onboarding-heading"
        aria-modal="true"
      >
        <div className="relative shrink-0 border-b border-border px-6 pb-3 pt-5">
          <p className="text-center text-xs font-medium text-muted-foreground">{wizardTitle}</p>
          <button
            type="button"
            disabled={closeDisabled}
            onClick={onClose}
            className="absolute right-4 top-4 rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-40"
            title={t('firstRun.skipTitle')}
            aria-label={t('firstRun.skipAria')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <h2 id="onboarding-heading" className="text-lg font-semibold tracking-tight text-foreground">
            {heading}
          </h2>
          {description ? (
            <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">{description}</p>
          ) : null}
          {learnMoreHref || onLearnMore ? (
            <button
              type="button"
              className="mt-2 text-sm font-medium text-primary underline-offset-2 hover:underline"
              onClick={(): void => {
                if (onLearnMore) onLearnMore()
                else if (learnMoreHref) void window.mailClient.app.openExternal(learnMoreHref)
              }}
            >
              {t('firstRun.learnMore')}
            </button>
          ) : null}
          <div className="mt-5">{children}</div>
        </div>

        <div className="shrink-0 border-t border-border bg-background/40 px-6 py-4">{footer}</div>
      </div>
    </div>
  )
}

interface OnboardingFooterProps {
  onBack: () => void
  onNext: () => void
  onCancel: () => void
  backDisabled?: boolean
  nextDisabled?: boolean
  busy?: boolean
  nextLabel?: string
  isLastStep?: boolean
}

export function OnboardingFooter({
  onBack,
  onNext,
  onCancel,
  backDisabled,
  nextDisabled,
  busy,
  nextLabel,
  isLastStep
}: OnboardingFooterProps): JSX.Element {
  const { t } = useTranslation()

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <button
        type="button"
        disabled={busy || backDisabled}
        onClick={onBack}
        className={cn(
          'rounded-md border border-border px-4 py-2 text-sm font-medium transition-colors',
          busy || backDisabled
            ? 'cursor-not-allowed text-muted-foreground opacity-40'
            : 'text-foreground hover:bg-secondary'
        )}
      >
        {t('firstRun.back')}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={onNext}
        className={cn(
          'rounded-md px-4 py-2 text-sm font-semibold transition-colors',
          busy || nextDisabled
            ? 'cursor-not-allowed bg-primary/40 text-primary-foreground/80'
            : 'bg-primary text-primary-foreground hover:bg-primary/90'
        )}
      >
        {nextLabel ?? (isLastStep ? t('firstRun.finish') : t('firstRun.next'))}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={onCancel}
        className="rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-40"
      >
        {t('firstRun.cancel')}
      </button>
    </div>
  )
}
