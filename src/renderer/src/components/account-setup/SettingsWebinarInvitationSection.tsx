import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { Copy, ImagePlus, Mail, Plus, RotateCcw, Star, Trash2 } from 'lucide-react'
import {
  WebinarInvitationEditorPanel,
  type WebinarInvitationEditorView
} from '@/app/calendar/WebinarInvitationEditorPanel'
import { getDefaultWebinarInvitationLayoutTemplate } from '@/lib/build-webinar-invitation-html'
import { blobToDataUrl } from '@/lib/blob-to-base64'
import { showAppConfirm } from '@/stores/app-dialog'
import {
  readWebinarInvitationDefaults,
  resolveDefaultWebinarLayoutTheme,
  saveWebinarInvitationDefaults,
  type WebinarInvitationDefaults
} from '@/lib/webinar-invitation-defaults-storage'
import {
  createEmptyWebinarInvitationLayoutTemplate,
  duplicateWebinarInvitationLayoutTemplate,
  getWebinarInvitationLayoutTemplateById,
  readWebinarInvitationLayoutTemplates,
  removeWebinarInvitationLayoutTemplate,
  resolveWebinarLayoutTemplateHtml,
  saveWebinarInvitationLayoutTemplate,
  WEBINAR_BUILTIN_LAYOUT_TEMPLATE_ID,
  WEBINAR_LAYOUT_TEMPLATES_CHANGED_EVENT,
  type WebinarInvitationLayoutTemplate
} from '@/lib/webinar-invitation-layout-templates-storage'
import {
  buildWebinarSettingsLayoutEditorHtml,
  buildWebinarSettingsSampleContext,
  collapseWebinarLayoutEditorHtmlToTemplate,
  insertWebinarLayoutSlotIntoEditorHtml,
  insertWebinarLayoutSlotIntoTemplate,
  normalizeWebinarLayoutTemplateForStorage,
  webinarLayoutTemplateHasSlot,
  WEBINAR_LAYOUT_WYSIWYG_PROTECTED_SELECTORS
} from '@/lib/webinar-invitation-layout-wysiwyg'
import {
  WEBINAR_INVITATION_LAYOUT_TEMPLATE_VERSION,
  webinarInvitationLayoutTemplateIssues
} from '@/lib/webinar-invitation-layout-template'
import { WebinarLayoutThemeSwatches } from '@/components/WebinarLayoutThemeSwatches'
import { makeWebinarLayoutThemeId, webinarLayoutThemeParts } from '@/lib/webinar-invitation-layout-themes'

export function SettingsWebinarInvitationSection(): JSX.Element {
  const { t } = useTranslation()
  const heroPreviewLabel = t('settings.webinarInvitation.heroSlotPreviewLabel')
  const [draft, setDraft] = useState<WebinarInvitationDefaults>(() => readWebinarInvitationDefaults())
  const [templates, setTemplates] = useState<WebinarInvitationLayoutTemplate[]>(() =>
    readWebinarInvitationLayoutTemplates()
  )
  const [selectedId, setSelectedId] = useState(
    () =>
      readWebinarInvitationDefaults().defaultLayoutTemplateId ?? WEBINAR_BUILTIN_LAYOUT_TEMPLATE_ID
  )
  const selected = useMemo(
    () => getWebinarInvitationLayoutTemplateById(selectedId),
    [selectedId, templates]
  )
  const [layoutName, setLayoutName] = useState(() => selected.name)
  const [layoutEditorHtml, setLayoutEditorHtml] = useState(() =>
    buildWebinarSettingsLayoutEditorHtml(
      readWebinarInvitationDefaults(),
      heroPreviewLabel,
      resolveWebinarLayoutTemplateHtml(selected)
    )
  )
  const [saved, setSaved] = useState(false)
  const [editorView, setEditorView] = useState<WebinarInvitationEditorView>('edit')
  const heroFileRef = useRef<HTMLInputElement>(null)
  const layoutFlushRef = useRef<(() => string) | null>(null) as MutableRefObject<
    (() => string) | null
  >
  const previewTheme = resolveDefaultWebinarLayoutTheme(draft)

  const patchTheme = useCallback(
    (partial: Pick<WebinarInvitationDefaults, 'defaultLayoutColor' | 'defaultLayoutMode'>): void => {
      // Aktuelle Edit-Aenderungen in den State uebernehmen, bevor die Vorschau faerbt
      const flushed = layoutFlushRef.current?.()
      if (flushed != null) setLayoutEditorHtml(flushed)
      setDraft((prev) => ({ ...prev, ...partial }))
      setSaved(false)
      setEditorView('preview')
    },
    []
  )

  const reloadTemplates = useCallback((): void => {
    setTemplates(readWebinarInvitationLayoutTemplates())
  }, [])

  useEffect(() => {
    window.addEventListener(WEBINAR_LAYOUT_TEMPLATES_CHANGED_EVENT, reloadTemplates)
    return (): void =>
      window.removeEventListener(WEBINAR_LAYOUT_TEMPLATES_CHANGED_EVENT, reloadTemplates)
  }, [reloadTemplates])

  const loadSelectedIntoEditor = useCallback(
    (id: string, defaults: WebinarInvitationDefaults = draft): void => {
      const tpl = getWebinarInvitationLayoutTemplateById(id)
      setSelectedId(tpl.id)
      setLayoutName(tpl.name)
      setLayoutEditorHtml(
        buildWebinarSettingsLayoutEditorHtml(
          defaults,
          heroPreviewLabel,
          resolveWebinarLayoutTemplateHtml(tpl)
        )
      )
    },
    [draft, heroPreviewLabel]
  )

  const patch = useCallback((partial: Partial<WebinarInvitationDefaults>): void => {
    setDraft((prev) => ({ ...prev, ...partial }))
    setSaved(false)
  }, [])

  const handleSave = useCallback((): void => {
    const flushed = layoutFlushRef.current?.() ?? layoutEditorHtml
    const layoutHtml = normalizeWebinarLayoutTemplateForStorage(flushed, draft, heroPreviewLabel)
    const nextTpl: WebinarInvitationLayoutTemplate = {
      ...selected,
      name: layoutName.trim() || selected.name,
      layoutHtml,
      layoutTemplateVersion: WEBINAR_INVITATION_LAYOUT_TEMPLATE_VERSION
    }
    saveWebinarInvitationLayoutTemplate(nextTpl)
    const nextDefaults: WebinarInvitationDefaults = {
      ...draft,
      defaultLayoutTemplateId:
        draft.defaultLayoutTemplateId?.trim() || WEBINAR_BUILTIN_LAYOUT_TEMPLATE_ID,
      layoutTemplateVersion: WEBINAR_INVITATION_LAYOUT_TEMPLATE_VERSION
    }
    saveWebinarInvitationDefaults(nextDefaults)
    setDraft(nextDefaults)
    setLayoutEditorHtml(flushed)
    reloadTemplates()
    setSaved(true)
  }, [draft, heroPreviewLabel, layoutEditorHtml, layoutName, reloadTemplates, selected])

  const insertHeroImageSlot = useCallback((): void => {
    const flushed = layoutFlushRef.current?.() ?? layoutEditorHtml
    let template = collapseWebinarLayoutEditorHtmlToTemplate(flushed)
    template = insertWebinarLayoutSlotIntoTemplate(template, 'heroImageBlock')
    const sampleContext = buildWebinarSettingsSampleContext(draft, heroPreviewLabel)
    const nextEditor = insertWebinarLayoutSlotIntoEditorHtml(
      flushed,
      'heroImageBlock',
      sampleContext.heroImageBlock
    )
    setLayoutEditorHtml(nextEditor)
    setSaved(false)
  }, [draft, heroPreviewLabel, layoutEditorHtml])

  const storedTemplateHtml = resolveWebinarLayoutTemplateHtml({
    layoutHtml: collapseWebinarLayoutEditorHtmlToTemplate(layoutEditorHtml)
  })
  const layoutIssues = webinarInvitationLayoutTemplateIssues(storedTemplateHtml)
  const heroSlotMissing = useMemo(() => {
    const tpl = collapseWebinarLayoutEditorHtmlToTemplate(layoutEditorHtml)
    return !webinarLayoutTemplateHasSlot(tpl, 'heroImageBlock')
  }, [layoutEditorHtml])

  const inputClass =
    'w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-ring focus:ring-1 focus:ring-ring/30'
  const labelClass = 'block space-y-1 text-xs'
  const hintClass = 'text-2xs text-muted-foreground'

  return (
    <div className="mt-8 space-y-3 border-t border-border pt-6">
      <div className="flex items-center gap-2">
        <Mail className="h-4 w-4 text-muted-foreground" aria-hidden />
        <h3 className="text-sm font-semibold text-foreground">
          {t('settings.webinarInvitation.title')}
        </h3>
      </div>
      <p className="text-xs text-muted-foreground">{t('settings.webinarInvitation.intro')}</p>

      <div className="space-y-2 rounded-md border border-border/60 bg-secondary/10 px-3 py-3">
        <p className="text-xs font-medium text-foreground">
          {t('settings.webinarInvitation.defaultThemeHeading')}
        </p>
        <p className={hintClass}>{t('settings.webinarInvitation.defaultThemeHint')}</p>
        <WebinarLayoutThemeSwatches
          value={makeWebinarLayoutThemeId(
            draft.defaultLayoutColor ?? 'gold',
            draft.defaultLayoutMode ?? 'dark'
          )}
          onChange={(theme): void => {
            const { color, mode } = webinarLayoutThemeParts(theme)
            patchTheme({ defaultLayoutColor: color, defaultLayoutMode: mode })
          }}
          modeLabel={(mode): string => t(`settings.webinarInvitation.layoutMode_${mode}`)}
          colorLabel={(color): string => t(`settings.webinarInvitation.layoutColor_${color}`)}
        />
      </div>

      <div className="space-y-2 rounded-md border border-border/60 bg-secondary/10 px-3 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-medium text-foreground">
            {t('settings.webinarInvitation.layoutCatalogHeading')}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={(): void => {
                const next = createEmptyWebinarInvitationLayoutTemplate(
                  t('settings.webinarInvitation.newLayoutName')
                )
                saveWebinarInvitationLayoutTemplate(next)
                reloadTemplates()
                loadSelectedIntoEditor(next.id)
                setSaved(false)
              }}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-2xs font-medium text-foreground hover:bg-secondary"
            >
              <Plus className="h-3 w-3" aria-hidden />
              {t('settings.webinarInvitation.newLayout')}
            </button>
            <button
              type="button"
              onClick={(): void => {
                const copy = duplicateWebinarInvitationLayoutTemplate(selected)
                saveWebinarInvitationLayoutTemplate(copy)
                reloadTemplates()
                loadSelectedIntoEditor(copy.id)
                setSaved(false)
              }}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-2xs font-medium text-foreground hover:bg-secondary"
            >
              <Copy className="h-3 w-3" aria-hidden />
              {t('settings.webinarInvitation.duplicateLayout')}
            </button>
          </div>
        </div>
        <p className={hintClass}>{t('settings.webinarInvitation.layoutCatalogHint')}</p>
        <ul className="space-y-1 rounded-md border border-border bg-background/40 p-1">
          {templates.map((tpl) => {
            const isSelected = tpl.id === selectedId
            const isDefault = tpl.id === draft.defaultLayoutTemplateId
            return (
              <li key={tpl.id}>
                <button
                  type="button"
                  onClick={(): void => {
                    loadSelectedIntoEditor(tpl.id)
                    setSaved(false)
                  }}
                  className={[
                    'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors',
                    isSelected ? 'bg-primary/15 text-foreground' : 'hover:bg-muted/60 text-foreground'
                  ].join(' ')}
                >
                  <span className="min-w-0 flex-1 truncate font-medium">{tpl.name}</span>
                  {isDefault ? (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-2xs text-amber-200">
                      <Star className="h-2.5 w-2.5" aria-hidden />
                      {t('settings.webinarInvitation.defaultBadge')}
                    </span>
                  ) : null}
                  {tpl.builtin ? (
                    <span className="shrink-0 rounded-full bg-secondary px-1.5 py-0.5 text-2xs text-muted-foreground">
                      {t('settings.webinarInvitation.builtinBadge')}
                    </span>
                  ) : null}
                </button>
              </li>
            )
          })}
        </ul>
      </div>

      <div className="space-y-2 rounded-md border border-border/60 bg-secondary/10 px-3 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-medium text-foreground">
            {t('settings.webinarInvitation.layoutWysiwygHeading')}
          </p>
          <div className="flex flex-wrap gap-2">
            {heroSlotMissing ? (
              <button
                type="button"
                onClick={insertHeroImageSlot}
                className="rounded-md border border-amber-400/40 bg-amber-500/15 px-2 py-1 text-2xs font-medium text-amber-100 hover:bg-amber-500/25"
              >
                {t('settings.webinarInvitation.insertHeroSlot')}
              </button>
            ) : null}
            <button
              type="button"
              onClick={(): void => {
                setLayoutEditorHtml(
                  buildWebinarSettingsLayoutEditorHtml(
                    draft,
                    heroPreviewLabel,
                    getDefaultWebinarInvitationLayoutTemplate()
                  )
                )
                setSaved(false)
              }}
              className="rounded-md border border-border bg-background px-2 py-1 text-2xs font-medium text-foreground hover:bg-secondary"
            >
              {t('settings.webinarInvitation.loadDefaultLayout')}
            </button>
            <button
              type="button"
              onClick={(): void => {
                setLayoutEditorHtml(
                  buildWebinarSettingsLayoutEditorHtml(draft, heroPreviewLabel, null)
                )
                setSaved(false)
              }}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-2xs font-medium text-foreground hover:bg-secondary"
            >
              <RotateCcw className="h-3 w-3" aria-hidden />
              {t('settings.webinarInvitation.resetLayout')}
            </button>
            {!selected.builtin ? (
              <button
                type="button"
                onClick={(): void => {
                  void (async (): Promise<void> => {
                    const ok = await showAppConfirm(
                      t('settings.webinarInvitation.deleteLayoutConfirm', { name: selected.name }),
                      {
                        title: t('settings.webinarInvitation.deleteLayoutTitle'),
                        variant: 'danger',
                        confirmLabel: t('common.delete')
                      }
                    )
                    if (!ok) return
                    removeWebinarInvitationLayoutTemplate(selected.id)
                    const nextDefaults = {
                      ...draft,
                      defaultLayoutTemplateId:
                        draft.defaultLayoutTemplateId === selected.id
                          ? WEBINAR_BUILTIN_LAYOUT_TEMPLATE_ID
                          : draft.defaultLayoutTemplateId
                    }
                    saveWebinarInvitationDefaults(nextDefaults)
                    setDraft(nextDefaults)
                    reloadTemplates()
                    loadSelectedIntoEditor(
                      nextDefaults.defaultLayoutTemplateId ?? WEBINAR_BUILTIN_LAYOUT_TEMPLATE_ID,
                      nextDefaults
                    )
                    setSaved(false)
                  })()
                }}
                className="inline-flex items-center gap-1 rounded-md border border-destructive/40 px-2 py-1 text-2xs font-medium text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-3 w-3" aria-hidden />
                {t('common.delete')}
              </button>
            ) : null}
          </div>
        </div>
        <label className={labelClass}>
          <span className="font-medium text-foreground">
            {t('settings.webinarInvitation.layoutNameLabel')}
          </span>
          <input
            type="text"
            value={layoutName}
            onChange={(e): void => {
              setLayoutName(e.target.value)
              setSaved(false)
            }}
            className={inputClass}
          />
        </label>
        <button
          type="button"
          onClick={(): void => {
            patch({ defaultLayoutTemplateId: selectedId })
          }}
          className="rounded-md border border-border bg-background px-2 py-1 text-2xs font-medium text-foreground hover:bg-secondary"
        >
          {t('settings.webinarInvitation.setAsDefaultLayout')}
        </button>
        <p className={hintClass}>{t('settings.webinarInvitation.layoutWysiwygHint')}</p>
        {heroSlotMissing ? (
          <p className="text-2xs text-amber-200">{t('settings.webinarInvitation.heroSlotMissingHint')}</p>
        ) : null}

        <WebinarInvitationEditorPanel
          descriptionHtml={layoutEditorHtml}
          onChangeHtml={(html): void => {
            setLayoutEditorHtml(html)
            setSaved(false)
          }}
          flushRef={layoutFlushRef}
          attendeePreviewHtml={layoutEditorHtml}
          previewTheme={previewTheme}
          view={editorView}
          onViewChange={setEditorView}
          defaultView="edit"
          protectedSelectors={WEBINAR_LAYOUT_WYSIWYG_PROTECTED_SELECTORS}
        />

        {layoutIssues.includes('missingTeamsSlot') ? (
          <p className="text-2xs text-amber-300" role="alert">
            {t('settings.webinarInvitation.layoutMissingTeamsSlot')}
          </p>
        ) : null}
      </div>

      <div className="rounded-md border border-border/60 bg-secondary/10 px-3 py-3">
        <span className="text-xs font-medium text-foreground">
          {t('settings.webinarInvitation.defaultHeroImage')}
        </span>
        <p className={`mt-1 ${hintClass}`}>{t('settings.webinarInvitation.defaultHeroImageHint')}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={(): void => heroFileRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-secondary"
          >
            <ImagePlus className="h-3.5 w-3.5" />
            {draft.defaultHeroImageSrc
              ? t('settings.webinarInvitation.defaultHeroReplace')
              : t('settings.webinarInvitation.defaultHeroPick')}
          </button>
          {draft.defaultHeroImageSrc ? (
            <button
              type="button"
              onClick={(): void => {
                const next = { ...draft, defaultHeroImageSrc: null }
                setDraft(next)
                loadSelectedIntoEditor(selectedId, next)
              }}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {t('settings.webinarInvitation.defaultHeroRemove')}
            </button>
          ) : null}
          <input
            ref={heroFileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e): void => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (!file) return
              void blobToDataUrl(file).then((dataUrl) => {
                if (!dataUrl) return
                const next = { ...draft, defaultHeroImageSrc: dataUrl }
                setDraft(next)
                loadSelectedIntoEditor(selectedId, next)
                setSaved(false)
              })
            }}
          />
        </div>
        {draft.defaultHeroImageSrc ? (
          <img
            src={draft.defaultHeroImageSrc}
            alt=""
            className="mt-2 max-h-40 w-full rounded-md border border-border object-cover object-center"
          />
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className={labelClass}>
          <span className="font-medium text-foreground">
            {t('settings.webinarInvitation.defaultSurveyUrl')}
          </span>
          <input
            type="url"
            value={draft.defaultSurveyUrl}
            onChange={(e): void => patch({ defaultSurveyUrl: e.target.value })}
            className={inputClass}
            placeholder="https://forms.office.com/…"
          />
        </label>
        <label className={labelClass}>
          <span className="font-medium text-foreground">
            {t('settings.webinarInvitation.defaultWebsiteUrl')}
          </span>
          <input
            type="url"
            value={draft.defaultWebsiteUrl}
            onChange={(e): void => patch({ defaultWebsiteUrl: e.target.value })}
            className={inputClass}
            placeholder="https://…"
          />
        </label>
        <label className={labelClass}>
          <span className="font-medium text-foreground">
            {t('settings.webinarInvitation.surveyLabel')}
          </span>
          <input
            type="text"
            value={draft.surveyLabel}
            onChange={(e): void => patch({ surveyLabel: e.target.value })}
            className={inputClass}
          />
        </label>
        <label className={labelClass}>
          <span className="font-medium text-foreground">
            {t('settings.webinarInvitation.websiteLabel')}
          </span>
          <input
            type="text"
            value={draft.websiteLabel}
            onChange={(e): void => patch({ websiteLabel: e.target.value })}
            className={inputClass}
          />
        </label>
      </div>
      <p className={hintClass}>{t('settings.webinarInvitation.linkDefaultsHint')}</p>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
        >
          {t('settings.webinarInvitation.save')}
        </button>
        {saved ? (
          <span className="text-xs text-emerald-400">{t('settings.webinarInvitation.saved')}</span>
        ) : null}
      </div>
    </div>
  )
}
