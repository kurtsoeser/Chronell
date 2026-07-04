import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  CheckSquare,
  Loader2,
  Mail,
  PanelRight,
  Shield,
  SkipForward,
  Wrench,
  FlaskConical,
  Maximize2,
  Columns2
} from 'lucide-react'
import { OnboardingFooter, OnboardingShell } from '@/components/onboarding/OnboardingShell'
import {
  OnboardingOptionCard,
  OnboardingRecommendedTag
} from '@/components/onboarding/OnboardingOptionCard'
import {
  AccentDot,
  MailLayoutIllustration,
  PaletteVariantSwatch,
  ThemeModeSwatch
} from '@/components/onboarding/OnboardingThemeSwatch'
import { useAccountsStore } from '@/stores/accounts'
import { useMailWorkspaceLayoutStore } from '@/stores/mail-workspace-layout'
import {
  accentHsl,
  ACCENT_LIST,
  useThemeStore,
  type AccentName,
  type DarkPalette,
  type LightPalette,
  type ThemeMode
} from '@/stores/theme'
import { cn } from '@/lib/utils'

type SetupPath = 'custom' | 'standard'
type AccountChoice = 'skip' | 'microsoft' | 'google' | 'demo'

type StepId =
  | 'welcome'
  | 'theme'
  | 'layout'
  | 'account'
  | 'accountMicrosoft'
  | 'accountGoogle'
  | 'finish'

interface Props {
  onOpenSettings: (tab: 'general' | 'accounts') => void
}

const LIGHT_PALETTES: LightPalette[] = ['default', 'graphite', 'midnight', 'nord']
const DARK_PALETTES: DarkPalette[] = ['graphite', 'default', 'midnight', 'nord']

const LIGHT_PALETTE_LABEL_KEYS = [
  'firstRun.paletteFluent',
  'firstRun.paletteWarm',
  'firstRun.paletteCool',
  'firstRun.paletteNord'
] as const

const DARK_PALETTE_LABEL_KEYS = [
  'firstRun.paletteGraphite',
  'firstRun.paletteDefault',
  'firstRun.paletteMidnight',
  'firstRun.paletteNord'
] as const

function buildStepOrder(path: SetupPath, accountChoice: AccountChoice): StepId[] {
  const base: StepId[] =
    path === 'standard' ? ['welcome', 'account', 'finish'] : ['welcome', 'theme', 'layout', 'account', 'finish']

  if (accountChoice === 'microsoft') {
    const idx = base.indexOf('account')
    if (idx >= 0) base.splice(idx + 1, 0, 'accountMicrosoft')
  } else if (accountChoice === 'google') {
    const idx = base.indexOf('account')
    if (idx >= 0) base.splice(idx + 1, 0, 'accountGoogle')
  }
  return base
}

export function FirstRunWizard({ onOpenSettings }: Props): JSX.Element {
  const { t } = useTranslation()
  const config = useAccountsStore((s) => s.config)
  const accounts = useAccountsStore((s) => s.accounts)
  const addMicrosoftAccount = useAccountsStore((s) => s.addMicrosoftAccount)
  const addGoogleAccount = useAccountsStore((s) => s.addGoogleAccount)
  const storeError = useAccountsStore((s) => s.error)
  const setFirstRunSetupCompleted = useAccountsStore((s) => s.setFirstRunSetupCompleted)
  const initialize = useAccountsStore((s) => s.initialize)

  const themeMode = useThemeStore((s) => s.mode)
  const effectiveTheme = useThemeStore((s) => s.effective)
  const accent = useThemeStore((s) => s.accent)
  const darkPalette = useThemeStore((s) => s.darkPalette)
  const lightPalette = useThemeStore((s) => s.lightPalette)
  const setMode = useThemeStore((s) => s.setMode)
  const setAccent = useThemeStore((s) => s.setAccent)
  const applyDarkPaletteVariant = useThemeStore((s) => s.applyDarkPaletteVariant)
  const applyLightPaletteVariant = useThemeStore((s) => s.applyLightPaletteVariant)

  const readingPlacement = useMailWorkspaceLayoutStore((s) => s.readingPlacement)
  const readingOpen = useMailWorkspaceLayoutStore((s) => s.readingOpen)
  const setReadingPlacement = useMailWorkspaceLayoutStore((s) => s.setReadingPlacement)
  const setReadingOpen = useMailWorkspaceLayoutStore((s) => s.setReadingOpen)

  const [setupPath, setSetupPath] = useState<SetupPath>('custom')
  const [accountChoice, setAccountChoice] = useState<AccountChoice>('skip')
  const [step, setStep] = useState<StepId>('welcome')
  const [localError, setLocalError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [launchOnLogin, setLaunchOnLogin] = useState(false)

  const hasMicrosoft = accounts.some((a) => a.provider === 'microsoft')
  const hasGoogle = accounts.some((a) => a.provider === 'google')
  const canMicrosoft = Boolean(config?.microsoftClientId?.trim())
  const canGoogle = Boolean(config?.googleClientId?.trim())

  const steps = useMemo(
    () => buildStepOrder(setupPath, accountChoice),
    [setupPath, accountChoice]
  )
  const stepIndex = steps.indexOf(step)

  const finishWizard = useCallback(async (): Promise<void> => {
    setBusy(true)
    setLocalError(null)
    try {
      if (launchOnLogin) {
        await window.mailClient.app.setLaunchOnLogin(true)
      }
      await setFirstRunSetupCompleted(true)
      await initialize()
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [initialize, launchOnLogin, setFirstRunSetupCompleted])

  const openUrl = useCallback(async (url: string | null | undefined): Promise<void> => {
    const u = (url ?? '').trim()
    if (!u) return
    await window.mailClient.app.openExternal(u)
  }, [])

  async function handleEnterDemo(): Promise<void> {
    setBusy(true)
    setLocalError(null)
    try {
      await window.mailClient.demo.enter()
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  function goBack(): void {
    if (stepIndex <= 0) return
    setStep(steps[stepIndex - 1]!)
  }

  function goNext(): void {
    if (step === 'account' && accountChoice === 'demo') {
      void handleEnterDemo()
      return
    }
    if (step === 'account') {
      if (accountChoice === 'microsoft' && !hasMicrosoft) {
        setStep('accountMicrosoft')
        return
      }
      if (accountChoice === 'google' && !hasGoogle) {
        setStep('accountGoogle')
        return
      }
    }
    if (stepIndex < steps.length - 1) {
      setStep(steps[stepIndex + 1]!)
    } else {
      void finishWizard()
    }
  }

  async function handleAddMicrosoft(): Promise<void> {
    if (!canMicrosoft) {
      setLocalError(t('firstRun.errMicrosoft'))
      return
    }
    setBusy(true)
    setLocalError(null)
    try {
      await addMicrosoftAccount()
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function handleAddGoogle(): Promise<void> {
    if (!canGoogle) {
      setLocalError(t('firstRun.errGoogle'))
      return
    }
    setBusy(true)
    setLocalError(null)
    try {
      await addGoogleAccount()
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const err = localError ?? storeError
  const isLastStep = step === 'finish'
  const recommendedLabel = t('firstRun.recommended')

  const stepMeta = useMemo(() => {
    const map: Record<
      StepId,
      { heading: string; description?: string; wide?: boolean }
    > = {
      welcome: {
        heading: t('firstRun.steps.welcome.heading'),
        description: t('firstRun.steps.welcome.description')
      },
      theme: {
        heading: t('firstRun.steps.theme.heading'),
        description: t('firstRun.steps.theme.description'),
        wide: true
      },
      layout: {
        heading: t('firstRun.steps.layout.heading'),
        description: t('firstRun.steps.layout.description'),
        wide: true
      },
      account: {
        heading: t('firstRun.steps.account.heading'),
        description: t('firstRun.steps.account.description'),
        wide: true
      },
      accountMicrosoft: {
        heading: t('firstRun.msHeading'),
        description: t('firstRun.msIntro')
      },
      accountGoogle: {
        heading: t('firstRun.googleHeading'),
        description: t('firstRun.googleIntro')
      },
      finish: {
        heading: t('firstRun.steps.finish.heading'),
        description: t('firstRun.steps.finish.description')
      }
    }
    return map[step]
  }, [step, t])

  const layoutChoice: 'dock' | 'float' | 'hidden' = !readingOpen
    ? 'hidden'
    : readingPlacement === 'float'
      ? 'float'
      : 'dock'

  function setLayoutChoice(choice: 'dock' | 'float' | 'hidden'): void {
    if (choice === 'hidden') {
      setReadingOpen(false)
      return
    }
    setReadingOpen(true)
    setReadingPlacement(choice === 'float' ? 'float' : 'dock')
  }

  const footer = (
    <OnboardingFooter
      onBack={goBack}
      onNext={(): void => {
        if (isLastStep) void finishWizard()
        else goNext()
      }}
      onCancel={(): void => void finishWizard()}
      backDisabled={stepIndex <= 0}
      busy={busy}
      isLastStep={isLastStep}
      nextLabel={isLastStep ? t('firstRun.toApp') : undefined}
    />
  )

  return (
    <OnboardingShell
      wizardTitle={t('firstRun.wizardTitle')}
      heading={stepMeta.heading}
      description={stepMeta.description}
      learnMoreHref={step === 'welcome' ? config?.publisherHelpUrl : null}
      footer={footer}
      onClose={(): void => void finishWizard()}
      closeDisabled={busy}
      wide={stepMeta.wide}
    >
      {step === 'welcome' && (
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-muted-foreground">{t('firstRun.welcomeP1')}</p>
          <div className="flex items-start gap-2 rounded-lg border border-border bg-background/50 p-3 text-sm">
            <Shield className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span className="text-muted-foreground">{t('firstRun.welcomeShield')}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {config?.publisherPrivacyUrl ? (
              <button
                type="button"
                className="text-sm font-medium text-primary underline-offset-2 hover:underline"
                onClick={(): void => void openUrl(config.publisherPrivacyUrl)}
              >
                {t('firstRun.privacy')}
              </button>
            ) : null}
            <button
              type="button"
              className="text-sm font-medium text-muted-foreground underline-offset-2 hover:underline"
              onClick={(): void => onOpenSettings('general')}
            >
              {t('firstRun.advancedOAuth')}
            </button>
          </div>

          <p className="pt-2 text-sm font-medium text-foreground">{t('firstRun.steps.welcome.pathHeading')}</p>
          <div className="grid gap-2">
            <OnboardingOptionCard
              selected={setupPath === 'custom'}
              onSelect={(): void => setSetupPath('custom')}
              icon={Wrench}
              title={
                <>
                  {t('firstRun.steps.welcome.pathCustom')}
                  <OnboardingRecommendedTag label={recommendedLabel} />
                </>
              }
              description={t('firstRun.steps.welcome.pathCustomDesc')}
            />
            <OnboardingOptionCard
              selected={setupPath === 'standard'}
              onSelect={(): void => setSetupPath('standard')}
              icon={CheckSquare}
              title={t('firstRun.steps.welcome.pathStandard')}
              description={t('firstRun.steps.welcome.pathStandardDesc')}
            />
          </div>
        </div>
      )}

      {step === 'theme' && (
        <div className="space-y-6">
          <div>
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t('firstRun.steps.theme.modeLabel')}
            </p>
            <div className="grid grid-cols-3 gap-3">
              {(['system', 'light', 'dark'] as ThemeMode[]).map((mode) => (
                <ThemeModeSwatch
                  key={mode}
                  mode={mode}
                  selected={themeMode === mode}
                  label={t(`firstRun.themeMode.${mode}`)}
                  onSelect={(): void => setMode(mode)}
                />
              ))}
            </div>
          </div>

          <div>
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t('firstRun.steps.theme.accentLabel')}
            </p>
            <div className="flex flex-wrap gap-2">
              {ACCENT_LIST.map((a) => (
                <AccentDot
                  key={a.id}
                  name={a.label}
                  hsl={accentHsl(a.id)}
                  selected={accent === a.id}
                  onSelect={(): void => setAccent(a.id as AccentName)}
                />
              ))}
            </div>
          </div>

          <div>
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {effectiveTheme === 'dark'
                ? t('firstRun.steps.theme.variantDark')
                : t('firstRun.steps.theme.variantLight')}
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {effectiveTheme === 'dark'
                ? DARK_PALETTES.map((id, i) => (
                    <PaletteVariantSwatch
                      key={id}
                      schema="dark"
                      paletteId={id}
                      selected={darkPalette === id}
                      label={t(DARK_PALETTE_LABEL_KEYS[i]!)}
                      onSelect={(): void => applyDarkPaletteVariant(id)}
                    />
                  ))
                : LIGHT_PALETTES.map((id, i) => (
                    <PaletteVariantSwatch
                      key={id}
                      schema="light"
                      paletteId={id}
                      selected={lightPalette === id}
                      label={t(LIGHT_PALETTE_LABEL_KEYS[i]!)}
                      onSelect={(): void => applyLightPaletteVariant(id)}
                    />
                  ))}
            </div>
          </div>
        </div>
      )}

      {step === 'layout' && (
        <div className="flex gap-6">
          <div className="min-w-0 flex-1 space-y-2">
            <OnboardingOptionCard
              selected={layoutChoice === 'dock'}
              onSelect={(): void => setLayoutChoice('dock')}
              icon={PanelRight}
              title={
                <>
                  {t('firstRun.layoutDock')}
                  <OnboardingRecommendedTag label={recommendedLabel} />
                </>
              }
              description={t('firstRun.layoutDockDesc')}
            />
            <OnboardingOptionCard
              selected={layoutChoice === 'float'}
              onSelect={(): void => setLayoutChoice('float')}
              icon={Maximize2}
              title={t('firstRun.layoutFloat')}
              description={t('firstRun.layoutFloatDesc')}
            />
            <OnboardingOptionCard
              selected={layoutChoice === 'hidden'}
              onSelect={(): void => setLayoutChoice('hidden')}
              icon={Columns2}
              title={t('firstRun.layoutHidden')}
              description={t('firstRun.layoutHiddenDesc')}
            />
          </div>
          <MailLayoutIllustration variant={layoutChoice} />
        </div>
      )}

      {step === 'account' && (
        <div className="rounded-xl border border-border bg-background/30 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <OnboardingOptionCard
              layout="column"
              selected={accountChoice === 'demo'}
              onSelect={(): void => setAccountChoice('demo')}
              iconNode={
                <div className="flex h-16 w-16 items-center justify-center rounded-full border border-amber-500/40 bg-amber-500/10">
                  <FlaskConical className="h-8 w-8 text-amber-600 dark:text-amber-400" />
                </div>
              }
              title={
                <>
                  {t('firstRun.accountDemo')}
                  <OnboardingRecommendedTag label={recommendedLabel} />
                </>
              }
              description={t('firstRun.accountDemoDesc')}
            />
            <OnboardingOptionCard
              layout="column"
              selected={accountChoice === 'skip'}
              onSelect={(): void => setAccountChoice('skip')}
              iconNode={
                <div className="flex h-16 w-16 items-center justify-center rounded-full border border-border bg-card">
                  <SkipForward className="h-8 w-8 text-muted-foreground" />
                </div>
              }
              title={t('firstRun.accountSkip')}
              description={t('firstRun.accountSkipDesc')}
            />
            <OnboardingOptionCard
              layout="column"
              selected={accountChoice === 'microsoft'}
              onSelect={(): void => setAccountChoice('microsoft')}
              disabled={!canMicrosoft && !hasMicrosoft}
              iconNode={
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#0078d4]/15 text-2xl font-bold text-[#0078d4]">
                  M
                </div>
              }
              title={t('firstRun.accountMicrosoft')}
              description={
                hasMicrosoft ? t('firstRun.msConnected') : t('firstRun.accountMicrosoftDesc')
              }
            />
            <OnboardingOptionCard
              layout="column"
              selected={accountChoice === 'google'}
              onSelect={(): void => setAccountChoice('google')}
              disabled={!canGoogle && !hasGoogle}
              iconNode={
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-card">
                  <span className="text-3xl font-bold text-[#ea4335]">G</span>
                </div>
              }
              title={t('firstRun.accountGoogle')}
              description={hasGoogle ? t('firstRun.googleConnected') : t('firstRun.accountGoogleDesc')}
            />
          </div>
        </div>
      )}

      {step === 'accountMicrosoft' && (
        <div className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-inside list-disc space-y-1 pl-0.5">
            <li>{t('firstRun.msLi1')}</li>
            <li>{t('firstRun.msLi2')}</li>
            <li>{t('firstRun.msLi3')}</li>
            <li>{t('firstRun.msLi4')}</li>
            <li>{t('firstRun.msLi5')}</li>
          </ul>
          <p className="text-xs">{t('firstRun.msDetails')}</p>
          {hasMicrosoft ? (
            <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400">
              {t('firstRun.msConnected')}
            </p>
          ) : (
            <button
              type="button"
              disabled={busy || !canMicrosoft}
              onClick={(): void => void handleAddMicrosoft()}
              className={cn(
                'inline-flex w-full items-center justify-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                busy || !canMicrosoft
                  ? 'bg-secondary text-muted-foreground'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90'
              )}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t('firstRun.msConnect')}
            </button>
          )}
          {!canMicrosoft ? (
            <p className="text-xs text-amber-600 dark:text-amber-500">{t('firstRun.msNoClient')}</p>
          ) : null}
        </div>
      )}

      {step === 'accountGoogle' && (
        <div className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-inside list-disc space-y-1 pl-0.5">
            <li>{t('firstRun.googleLi1')}</li>
            <li>{t('firstRun.googleLi2')}</li>
            <li>{t('firstRun.googleLi3')}</li>
            <li>{t('firstRun.googleLi4')}</li>
          </ul>
          <p className="text-xs">{t('firstRun.googleDetails')}</p>
          {hasGoogle ? (
            <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400">
              {t('firstRun.googleConnected')}
            </p>
          ) : (
            <button
              type="button"
              disabled={busy || !canGoogle}
              onClick={(): void => void handleAddGoogle()}
              className={cn(
                'inline-flex w-full items-center justify-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                busy || !canGoogle
                  ? 'bg-secondary text-muted-foreground'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90'
              )}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t('firstRun.googleConnect')}
            </button>
          )}
          {!canGoogle ? (
            <p className="text-xs text-amber-600 dark:text-amber-500">{t('firstRun.googleNoClient')}</p>
          ) : null}
        </div>
      )}

      {step === 'finish' && (
        <div className="space-y-5">
          <div className="flex items-start gap-3 rounded-lg border border-border bg-emerald-500/5 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <p className="font-medium text-foreground">{t('firstRun.doneHeading')}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t('firstRun.doneP1')}</p>
              {accounts.length === 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">{t('firstRun.doneNoAccount')}</p>
              ) : null}
            </div>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={launchOnLogin}
              onChange={(e): void => setLaunchOnLogin(e.target.checked)}
            />
            <span>
              <span className="block text-sm font-medium text-foreground">
                {t('firstRun.launchOnLogin')}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {t('firstRun.launchOnLoginDesc')}
              </span>
            </span>
          </label>
        </div>
      )}

      {err ? (
        <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
          {err}
        </div>
      ) : null}
    </OnboardingShell>
  )
}
