import { memo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ClipboardList, ImagePlus, Link2, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { blobToDataUrl } from '@/lib/blob-to-base64'
import { MsFormsPickerDialog } from '@/components/MsFormsPickerDialog'

export type WebinarContentFormValues = {
  title: string
  heroImageSrc: string | null
  surveyUrl: string
  surveyLabel: string
  websiteUrl: string
  websiteLabel: string
}

export const CalendarEventDialogWebinarContentForm = memo(
  function CalendarEventDialogWebinarContentForm({
    values,
    onChange,
    disabled,
    msAccountId
  }: {
    values: WebinarContentFormValues
    onChange: (next: WebinarContentFormValues) => void
    disabled?: boolean
    /** Microsoft-Konto fuer Forms-Picker (eigene Forms). */
    msAccountId?: string | null
  }): JSX.Element {
    const { t } = useTranslation()
    const fileRef = useRef<HTMLInputElement>(null)
    const [formsPickerOpen, setFormsPickerOpen] = useState(false)

    const patch = (partial: Partial<WebinarContentFormValues>): void => {
      onChange({ ...values, ...partial })
    }

    const canPickForms = Boolean(msAccountId?.trim()) && !disabled

    return (
      <div className="space-y-3 rounded-md border border-border bg-muted/15 px-3 py-3">
        <p className="text-xs text-muted-foreground">{t('calendar.eventDialog.webinarFormIntro')}</p>

        <label className="block text-xs font-medium">
          {t('calendar.eventDialog.webinarFieldTitle')}
          <input
            type="text"
            value={values.title}
            disabled={disabled}
            onChange={(e): void => patch({ title: e.target.value })}
            placeholder={t('calendar.eventDialog.webinarFieldTitlePlaceholder')}
            className="mt-1 w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
          />
        </label>

        <div>
          <span className="text-xs font-medium">{t('calendar.eventDialog.webinarFieldHero')}</span>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={disabled}
              onClick={(): void => fileRef.current?.click()}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-secondary',
                disabled && 'opacity-50'
              )}
            >
              <ImagePlus className="h-3.5 w-3.5" />
              {values.heroImageSrc
                ? t('calendar.eventDialog.webinarHeroReplace')
                : t('calendar.eventDialog.webinarHeroPick')}
            </button>
            {values.heroImageSrc ? (
              <button
                type="button"
                disabled={disabled}
                onClick={(): void => patch({ heroImageSrc: null })}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {t('calendar.eventDialog.webinarHeroRemove')}
              </button>
            ) : null}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e): void => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (!file) return
                void blobToDataUrl(file).then((dataUrl) => {
                  if (dataUrl) patch({ heroImageSrc: dataUrl })
                })
              }}
            />
          </div>
          {values.heroImageSrc ? (
            <img
              src={values.heroImageSrc}
              alt=""
              className="mt-2 max-h-40 w-full rounded-md border border-border object-cover object-center"
            />
          ) : null}
        </div>

        <div>
          <span className="text-xs font-medium">{t('calendar.eventDialog.webinarFieldSurveyUrl')}</span>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <input
              type="url"
              value={values.surveyUrl}
              disabled={disabled}
              onChange={(e): void => patch({ surveyUrl: e.target.value })}
              placeholder="https://forms.office.com/…"
              className="min-w-0 flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
            />
            {canPickForms ? (
              <button
                type="button"
                onClick={(): void => setFormsPickerOpen(true)}
                className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-background px-2 py-1.5 text-2xs font-medium text-foreground hover:bg-secondary"
                title={t('calendar.eventDialog.webinarPickForms')}
              >
                <ClipboardList className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t('calendar.eventDialog.webinarPickForms')}</span>
              </button>
            ) : null}
          </div>
        </div>
        <label className="block text-xs font-medium">
          {t('calendar.eventDialog.webinarFieldSurveyLabel')}
          <input
            type="text"
            value={values.surveyLabel}
            disabled={disabled}
            onChange={(e): void => patch({ surveyLabel: e.target.value })}
            placeholder={t('calendar.eventDialog.webinarFieldSurveyLabelPlaceholder')}
            className="mt-1 w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
          />
        </label>

        <label className="block text-xs font-medium">
          {t('calendar.eventDialog.webinarFieldWebsiteUrl')}
          <span className="mt-1 flex items-center gap-1.5">
            <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <input
              type="url"
              value={values.websiteUrl}
              disabled={disabled}
              onChange={(e): void => patch({ websiteUrl: e.target.value })}
              placeholder="https://…"
              className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
            />
          </span>
        </label>
        <label className="block text-xs font-medium">
          {t('calendar.eventDialog.webinarFieldWebsiteLabel')}
          <input
            type="text"
            value={values.websiteLabel}
            disabled={disabled}
            onChange={(e): void => patch({ websiteLabel: e.target.value })}
            placeholder={t('calendar.eventDialog.webinarFieldWebsiteLabelPlaceholder')}
            className="mt-1 w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
          />
        </label>

        {msAccountId?.trim() ? (
          <MsFormsPickerDialog
            open={formsPickerOpen}
            accountId={msAccountId}
            onClose={(): void => setFormsPickerOpen(false)}
            onPick={(form): void => {
              patch({
                surveyUrl: form.responseUrl,
                surveyLabel:
                  values.surveyLabel.trim() ||
                  t('calendar.eventDialog.webinarFieldSurveyLabelPlaceholder')
              })
            }}
          />
        ) : null}
      </div>
    )
  }
)
