import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { OnboardingFooter, OnboardingShell } from '@/components/onboarding/OnboardingShell'
import { findZoneLeaf, walkZoneLeaves } from '@/app/layout-studio/layout-zone-model'
import { LayoutStudioPanelSelect } from '@/app/layout-studio/LayoutStudioPanelSelect'
import { LayoutZoneTemplatePicker } from '@/app/layout-studio/LayoutZoneTemplatePicker'
import {
  buildZoneTemplate,
  type LayoutZoneTemplateId
} from '@/app/layout-studio/layout-zone-templates'
import { layoutStudioPanelTitleKey } from '@/app/layout-studio/layout-studio-panel-ids'
import { CalendarEventIconPicker } from '@/components/CalendarEventIconPicker'
import { CUSTOM_VIEW_DEFAULT_ICON_ID } from '@/lib/custom-view-tab-icon'
import { useCustomViewsStore } from '@/stores/custom-views'

export function CreateCustomViewWizard(): JSX.Element | null {
  const { t } = useTranslation()
  const wizardOpen = useCustomViewsStore((s) => s.wizardOpen)
  const wizardDraft = useCustomViewsStore((s) => s.wizardDraft)
  const viewsCount = useCustomViewsStore((s) => s.views.length)
  const closeWizard = useCustomViewsStore((s) => s.closeWizard)
  const setWizardStep = useCustomViewsStore((s) => s.setWizardStep)
  const setWizardZoneRoot = useCustomViewsStore((s) => s.setWizardZoneRoot)
  const setWizardName = useCustomViewsStore((s) => s.setWizardName)
  const setWizardIconId = useCustomViewsStore((s) => s.setWizardIconId)
  const setWizardLeafPanel = useCustomViewsStore((s) => s.setWizardLeafPanel)
  const finishWizard = useCustomViewsStore((s) => s.finishWizard)

  const [pickedTemplate, setPickedTemplate] = useState<LayoutZoneTemplateId | 'custom' | null>(null)

  useEffect(() => {
    if (!wizardOpen) setPickedTemplate(null)
  }, [wizardOpen])

  const step = wizardDraft?.step ?? 1
  const zoneRoot = wizardDraft?.zoneRoot
  const name = wizardDraft?.name ?? ''
  const iconId = wizardDraft?.iconId ?? CUSTOM_VIEW_DEFAULT_ICON_ID

  const zoneRows = useMemo(() => {
    if (!zoneRoot) return []
    const rows: Array<{ leafId: string; zoneNumber: number }> = []
    let n = 1
    walkZoneLeaves(zoneRoot, (leaf) => {
      rows.push({ leafId: leaf.id, zoneNumber: n })
      n += 1
    })
    return rows
  }, [zoneRoot])

  useEffect(() => {
    if (step !== 3 || !wizardDraft) return
    if (wizardDraft.editingViewId) return
    if (wizardDraft.name.trim()) return
    setWizardName(
      t('customView.defaultName', {
        n: Math.max(1, viewsCount + 1)
      })
    )
  }, [step, wizardDraft, viewsCount, setWizardName, t])

  const goStep1 = useCallback((): void => setWizardStep(1), [setWizardStep])
  const goStep2 = useCallback((): void => setWizardStep(2), [setWizardStep])

  const applyTemplateAndContinue = useCallback(
    (template: LayoutZoneTemplateId | 'custom'): void => {
      setPickedTemplate(template)
      const root =
        template === 'custom' ? buildZoneTemplate('single') : buildZoneTemplate(template)
      setWizardZoneRoot(root)
      setWizardStep(2)
    },
    [setWizardStep, setWizardZoneRoot]
  )

  const onNext = useCallback((): void => {
    if (step === 1) {
      if (pickedTemplate) applyTemplateAndContinue(pickedTemplate)
      return
    }
    if (step === 2) {
      setWizardStep(3)
      return
    }
    finishWizard()
  }, [step, pickedTemplate, applyTemplateAndContinue, setWizardStep, finishWizard])

  const onBack = useCallback((): void => {
    if (step === 2) goStep1()
    else if (step === 3) goStep2()
  }, [step, goStep1, goStep2])

  if (!wizardOpen || !wizardDraft) return null

  const isEdit = wizardDraft.editingViewId != null
  const stepTitle = t(
    isEdit ? `customView.wizard.editStep${step}Title` : `customView.wizard.step${step}Title`
  )
  const stepDesc = t(
    isEdit ? `customView.wizard.editStep${step}Description` : `customView.wizard.step${step}Description`
  )
  const wizardTitle = isEdit
    ? t('customView.wizard.editProgress', { current: step, total: 3 })
    : t('customView.wizard.progress', { current: step, total: 3 })

  const nextDisabled =
    step === 1 ? pickedTemplate == null : step === 3 ? name.trim().length === 0 : false

  return (
    <OnboardingShell
      wide={step === 1 || step === 2}
      wizardTitle={wizardTitle}
      heading={stepTitle}
      description={stepDesc}
      onClose={closeWizard}
      footer={
        <OnboardingFooter
          onBack={onBack}
          onCancel={closeWizard}
          onNext={onNext}
          backDisabled={step === 1}
          nextDisabled={nextDisabled}
          isLastStep={step === 3}
          nextLabel={
            step === 3 ? (isEdit ? t('customView.wizard.save') : t('customView.wizard.create')) : undefined
          }
        />
      }
    >
      {step === 1 ? (
        <section aria-label={t('layoutStudio.templatesAria')}>
          <LayoutZoneTemplatePicker
            selected={pickedTemplate}
            onSelect={setPickedTemplate}
            onConfirm={applyTemplateAndContinue}
          />
          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            {t('customView.wizard.step1Hint')}
          </p>
        </section>
      ) : null}

      {step === 2 && zoneRoot ? (
        <ul className="flex flex-col gap-2">
          {zoneRows.map(({ leafId, zoneNumber }) => {
            const leaf = findZoneLeaf(zoneRoot, leafId)
            if (!leaf) return null
            return (
              <li
                key={leafId}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card/50 px-3 py-2"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-primary/15 text-[11px] font-semibold text-primary">
                  {zoneNumber}
                </span>
                <span className="min-w-0 flex-1 text-xs text-muted-foreground">
                  {t(layoutStudioPanelTitleKey(leaf.panel))}
                </span>
                <LayoutStudioPanelSelect
                  value={leaf.panel}
                  aria-label={t('layoutStudio.zonePanelAria', { zone: zoneNumber })}
                  onChange={(panel): void => setWizardLeafPanel(leafId, panel)}
                  className="w-full max-w-[14rem] rounded-md border border-border bg-background px-2 py-1 text-xs"
                />
              </li>
            )
          })}
        </ul>
      ) : null}

      {step === 3 ? (
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-foreground">{t('customView.wizard.nameLabel')}</span>
            <input
              type="text"
              value={name}
              onChange={(e): void => setWizardName(e.target.value)}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
              placeholder={t('customView.wizard.namePlaceholder')}
              autoFocus
              aria-label={t('customView.wizard.nameAria')}
            />
          </label>
          <div className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-foreground">{t('customView.wizard.iconLabel')}</span>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {t('customView.wizard.iconHint')}
            </p>
            <div className="rounded-lg border border-border bg-card/50 p-2">
              <CalendarEventIconPicker
                layout="preview"
                defaultPickerOpen
                title={name.trim() || t('customView.wizard.iconPreviewFallback')}
                iconId={iconId}
                onIconChange={setWizardIconId}
              />
            </div>
          </div>
        </div>
      ) : null}
    </OnboardingShell>
  )
}
