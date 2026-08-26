import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ChevronDown,
  ChevronUp,
  Copy,
  LayoutTemplate,
  Pencil,
  Plus,
  Trash2,
  Video
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { showAppConfirm } from '@/stores/app-dialog'
import {
  createEmptyTemplate,
  deleteCalendarEventTemplate,
  readCalendarEventTemplates,
  saveCalendarEventTemplate,
  type CalendarEventTemplate
} from '@/lib/calendar-event-templates-storage'
import {
  formatOutlookReminderMinutes,
  OUTLOOK_REMINDER_MINUTES_OPTIONS
} from '@/lib/calendar-event-reminder-options'
import { TipTapBody } from '@/components/TipTapBody'

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120, 180, 240]

const EMOJI_PRESETS = [
  '📅', '🗓️', '🎥', '🖥️', '📢', '🤝', '🎓', '💡', '⚡', '🏆',
  '🌐', '📊', '🔔', '🚀', '🧑‍💻', '💬', '📋', '✅', '🎯', '🌟'
]

function TemplateEditor({
  template,
  onSave,
  onCancel
}: {
  template: CalendarEventTemplate
  onSave: (t: CalendarEventTemplate) => void
  onCancel: () => void
}): JSX.Element {
  const { t } = useTranslation()
  const [draft, setDraft] = useState<CalendarEventTemplate>(template)
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false)

  const patch = (partial: Partial<CalendarEventTemplate>): void =>
    setDraft((prev) => ({ ...prev, ...partial }))

  const inputClass =
    'w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-ring focus:ring-1 focus:ring-ring/30'
  const labelClass = 'block space-y-1 text-xs'
  const labelTextClass = 'font-medium text-foreground'

  return (
    <div className="space-y-4 rounded-md border border-border bg-background/70 p-4">
      {/* Name + Emoji */}
      <div className="flex items-start gap-3">
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={(): void => setEmojiPickerOpen((p) => !p)}
            className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-background text-xl hover:bg-secondary"
            title={t('settings.calendarTemplates.emojiHint')}
          >
            {draft.emoji || '📅'}
          </button>
          {emojiPickerOpen && (
            <div className="absolute left-0 top-12 z-20 grid grid-cols-5 gap-1 rounded-md border border-border bg-popover p-2 shadow-lg">
              {EMOJI_PRESETS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={(): void => {
                    patch({ emoji: e })
                    setEmojiPickerOpen(false)
                  }}
                  className="rounded p-1 text-lg hover:bg-secondary"
                >
                  {e}
                </button>
              ))}
            </div>
          )}
        </div>
        <label className={cn(labelClass, 'flex-1')}>
          <span className={labelTextClass}>{t('settings.calendarTemplates.nameLabel')}</span>
          <input
            type="text"
            value={draft.name}
            onChange={(e): void => patch({ name: e.target.value })}
            placeholder={t('settings.calendarTemplates.namePlaceholder')}
            maxLength={60}
            className={inputClass}
            autoFocus
          />
        </label>
      </div>

      {/* Titel + Ort */}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={labelClass}>
          <span className={labelTextClass}>{t('settings.calendarTemplates.subjectLabel')}</span>
          <span className="block text-2xs text-muted-foreground">
            {t('settings.calendarTemplates.subjectHint')}
          </span>
          <input
            type="text"
            value={draft.defaultSubject}
            onChange={(e): void => patch({ defaultSubject: e.target.value })}
            placeholder={t('settings.calendarTemplates.subjectPlaceholder')}
            maxLength={100}
            className={inputClass}
          />
        </label>
        <label className={labelClass}>
          <span className={labelTextClass}>{t('settings.calendarTemplates.locationLabel')}</span>
          <input
            type="text"
            value={draft.defaultLocation}
            onChange={(e): void => patch({ defaultLocation: e.target.value })}
            placeholder={t('settings.calendarTemplates.locationPlaceholder')}
            maxLength={120}
            className={inputClass}
          />
        </label>
      </div>

      {/* Dauer + Erinnerung */}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={labelClass}>
          <span className={labelTextClass}>{t('settings.calendarTemplates.durationLabel')}</span>
          <select
            value={draft.durationMinutes}
            onChange={(e): void => patch({ durationMinutes: Number(e.target.value) })}
            className={inputClass}
          >
            <option value={0}>{t('settings.calendarTemplates.durationKeep')}</option>
            {DURATION_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m < 60
                  ? t('settings.calendarTemplates.durationMin', { count: m })
                  : t('settings.calendarTemplates.durationH', { count: m / 60 })}
              </option>
            ))}
            <option value={300}>{t('settings.calendarTemplates.durationH', { count: 5 })}</option>
          </select>
        </label>
        <label className={labelClass}>
          <span className={labelTextClass}>{t('settings.calendarTemplates.reminderLabel')}</span>
          <select
            value={draft.reminderMinutes}
            onChange={(e): void => patch({ reminderMinutes: Number(e.target.value) })}
            className={inputClass}
          >
            <option value={-1}>{t('settings.calendarTemplates.reminderKeep')}</option>
            {OUTLOOK_REMINDER_MINUTES_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {formatOutlookReminderMinutes(m, t)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Teams-Toggle */}
      <label className="flex cursor-pointer items-center gap-2.5 text-xs">
        <input
          type="checkbox"
          checked={draft.teamsMeeting}
          onChange={(e): void => patch({ teamsMeeting: e.target.checked })}
          className="h-4 w-4 rounded border-border accent-blue-500"
        />
        <Video className={cn('h-3.5 w-3.5 shrink-0', draft.teamsMeeting ? 'text-blue-500' : 'text-muted-foreground')} />
        <span className="font-medium">{t('settings.calendarTemplates.teamsMeetingLabel')}</span>
      </label>

      {/* Beschreibung */}
      <div className={labelClass}>
        <span className={labelTextClass}>{t('settings.calendarTemplates.descriptionLabel')}</span>
        <span className="block text-2xs text-muted-foreground">
          {t('settings.calendarTemplates.descriptionHint')}
        </span>
        <div className="mt-1 min-h-[120px] rounded-md border border-border bg-background">
          <TipTapBody
            valueHtml={draft.descriptionHtml}
            onChangeHtml={(html: string): void => patch({ descriptionHtml: html })}
            placeholder={t('settings.calendarTemplates.descriptionPlaceholder')}
          />
        </div>
      </div>

      {/* Aktionen */}
      <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          {t('common.cancel')}
        </button>
        <button
          type="button"
          disabled={!draft.name.trim()}
          onClick={(): void => onSave(draft)}
          className={cn(
            'rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90',
            !draft.name.trim() && 'cursor-not-allowed opacity-50'
          )}
        >
          {t('common.save')}
        </button>
      </div>
    </div>
  )
}

export function SettingsCalendarTemplatesSection(): JSX.Element {
  const { t } = useTranslation()
  const [templates, setTemplates] = useState<CalendarEventTemplate[]>([])
  const [editing, setEditing] = useState<CalendarEventTemplate | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const load = useCallback((): void => {
    setTemplates(readCalendarEventTemplates())
  }, [])

  useEffect(() => {
    load()
    window.addEventListener('mailclient:calendar-templates-changed', load)
    return (): void => window.removeEventListener('mailclient:calendar-templates-changed', load)
  }, [load])

  function handleSave(tpl: CalendarEventTemplate): void {
    saveCalendarEventTemplate(tpl)
    setEditing(null)
    load()
  }

  async function handleDelete(tpl: CalendarEventTemplate): Promise<void> {
    const ok = await showAppConfirm(
      t('settings.calendarTemplates.deleteConfirm', { name: tpl.name }),
      {
        title: t('settings.calendarTemplates.deleteTitle'),
        variant: 'danger',
        confirmLabel: t('common.delete')
      }
    )
    if (!ok) return
    deleteCalendarEventTemplate(tpl.id)
    load()
  }

  function handleDuplicate(tpl: CalendarEventTemplate): void {
    const copy: CalendarEventTemplate = {
      ...tpl,
      id: `tpl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: `${tpl.name} (${t('common.copy')})`,
      updatedAt: new Date().toISOString()
    }
    saveCalendarEventTemplate(copy)
    setEditing(copy)
    load()
  }

  const isCreatingNew = editing !== null && !templates.some((t) => t.id === editing.id)

  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <LayoutTemplate className="h-3.5 w-3.5" />
            {t('settings.calendarTemplates.heading')}
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {t('settings.calendarTemplates.intro')}
          </p>
        </div>
        <button
          type="button"
          disabled={isCreatingNew}
          onClick={(): void => {
            const tpl = createEmptyTemplate()
            setEditing(tpl)
            setExpandedId(null)
          }}
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs hover:bg-muted disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" />
          {t('settings.calendarTemplates.new')}
        </button>
      </div>

      {/* Neues Template-Formular */}
      {isCreatingNew && editing && (
        <TemplateEditor
          template={editing}
          onSave={handleSave}
          onCancel={(): void => setEditing(null)}
        />
      )}

      {/* Template-Liste */}
      <ul className="space-y-1 rounded-md border border-border bg-background/40 p-1">
        {templates.length === 0 && !isCreatingNew ? (
          <li className="px-2 py-4 text-center text-xs text-muted-foreground">
            {t('settings.calendarTemplates.empty')}
          </li>
        ) : (
          templates.map((tpl) => {
            const isExpanded = expandedId === tpl.id
            const isEditingThis = editing?.id === tpl.id

            return (
              <li key={tpl.id} className="rounded-md">
                {/* Zeile */}
                <div className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/60">
                  <span className="shrink-0 text-base leading-none" aria-hidden>
                    {tpl.emoji || '📅'}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{tpl.name}</span>
                  {tpl.teamsMeeting && (
                    <span title={t('settings.calendarTemplates.teamsHint')}>
                      <Video className="h-3.5 w-3.5 shrink-0 text-blue-500" aria-hidden />
                    </span>
                  )}
                  {tpl.durationMinutes > 0 && (
                    <span className="shrink-0 text-2xs text-muted-foreground">
                      {tpl.durationMinutes < 60
                        ? t('settings.calendarTemplates.durationMin', { count: tpl.durationMinutes })
                        : t('settings.calendarTemplates.durationH', { count: tpl.durationMinutes / 60 })}
                    </span>
                  )}
                  <button
                    type="button"
                    className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                    title={t('common.edit')}
                    onClick={(): void => {
                      setEditing(isEditingThis ? null : { ...tpl })
                      setExpandedId(null)
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                    title={t('common.duplicate')}
                    onClick={(): void => handleDuplicate(tpl)}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    className="rounded p-1 text-destructive hover:bg-destructive/10"
                    title={t('common.delete')}
                    onClick={(): void => void handleDelete(tpl)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                    title={isExpanded ? t('common.collapse') : t('common.expand')}
                    onClick={(): void => {
                      setExpandedId(isExpanded ? null : tpl.id)
                      setEditing(null)
                    }}
                  >
                    {isExpanded
                      ? <ChevronUp className="h-3.5 w-3.5" />
                      : <ChevronDown className="h-3.5 w-3.5" />}
                  </button>
                </div>

                {/* Expand: Vorschau */}
                {isExpanded && !isEditingThis && (
                  <div className="mx-2 mb-2 rounded-md border border-border/60 bg-secondary/20 px-3 py-2 text-2xs text-muted-foreground space-y-1">
                    {tpl.defaultSubject && (
                      <p><span className="font-medium text-foreground">{t('settings.calendarTemplates.subjectLabel')}:</span> {tpl.defaultSubject}</p>
                    )}
                    {tpl.defaultLocation && (
                      <p><span className="font-medium text-foreground">{t('calendar.eventDialog.locationRowLabel')}:</span> {tpl.defaultLocation}</p>
                    )}
                    {tpl.descriptionHtml && (
                      <p className="line-clamp-2" dangerouslySetInnerHTML={{ __html: tpl.descriptionHtml }} />
                    )}
                  </div>
                )}

                {/* Inline-Editor */}
                {isEditingThis && editing && (
                  <div className="mx-1 mb-1">
                    <TemplateEditor
                      template={editing}
                      onSave={handleSave}
                      onCancel={(): void => setEditing(null)}
                    />
                  </div>
                )}
              </li>
            )
          })
        )}
      </ul>
    </section>
  )
}
