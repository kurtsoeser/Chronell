import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LayoutTemplate, Plus, Trash2, Video } from 'lucide-react'
import { showAppConfirm } from '@/stores/app-dialog'
import {
  createEmptyTeamsMeetingTemplate,
  readTeamsMeetingTemplates,
  removeTeamsMeetingTemplate,
  saveTeamsMeetingTemplate,
  type TeamsMeetingTemplate
} from '@/lib/teams-meeting-templates-storage'

export function SettingsTeamsMeetingTemplatesSection(): JSX.Element {
  const { t } = useTranslation()
  const [templates, setTemplates] = useState<TeamsMeetingTemplate[]>([])
  const [draft, setDraft] = useState<TeamsMeetingTemplate | null>(null)

  const load = useCallback((): void => {
    setTemplates(readTeamsMeetingTemplates())
  }, [])

  useEffect(() => {
    load()
    window.addEventListener('mailclient:teams-meeting-templates-changed', load)
    return (): void =>
      window.removeEventListener('mailclient:teams-meeting-templates-changed', load)
  }, [load])

  function startNew(): void {
    setDraft(createEmptyTeamsMeetingTemplate())
  }

  function saveDraft(): void {
    if (!draft) return
    const name = draft.name.trim()
    const meetingTemplateId = draft.meetingTemplateId.trim()
    if (!name || !meetingTemplateId) return
    saveTeamsMeetingTemplate({ ...draft, name, meetingTemplateId })
    setDraft(null)
    load()
  }

  async function handleDelete(tpl: TeamsMeetingTemplate): Promise<void> {
    if (tpl.builtin) return
    const ok = await showAppConfirm(
      t('settings.teamsMeetingTemplates.deleteConfirm', { name: tpl.name }),
      {
        title: t('settings.teamsMeetingTemplates.deleteTitle'),
        variant: 'danger',
        confirmLabel: t('common.delete')
      }
    )
    if (!ok) return
    removeTeamsMeetingTemplate(tpl.id)
    load()
  }

  return (
    <section className="mt-8 space-y-4 border-t border-border pt-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Video className="h-3.5 w-3.5 text-blue-500" />
            {t('settings.teamsMeetingTemplates.heading')}
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {t('settings.teamsMeetingTemplates.intro')}
          </p>
        </div>
        <button
          type="button"
          disabled={draft != null}
          onClick={startNew}
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs hover:bg-muted disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" />
          {t('settings.teamsMeetingTemplates.new')}
        </button>
      </div>

      {draft ? (
        <div className="space-y-2 rounded-md border border-border bg-background/60 p-3">
          <label className="block text-xs">
            <span className="text-muted-foreground">{t('settings.teamsMeetingTemplates.nameLabel')}</span>
            <input
              value={draft.name}
              onChange={(e): void => setDraft({ ...draft, name: e.target.value })}
              className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
              placeholder={t('settings.teamsMeetingTemplates.namePlaceholder')}
            />
          </label>
          <label className="block text-xs">
            <span className="text-muted-foreground">{t('settings.teamsMeetingTemplates.idLabel')}</span>
            <input
              value={draft.meetingTemplateId}
              onChange={(e): void => setDraft({ ...draft, meetingTemplateId: e.target.value })}
              className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 font-mono text-sm"
              placeholder="firstparty_… oder GUID"
              spellCheck={false}
            />
          </label>
          <p className="text-2xs text-muted-foreground">{t('settings.teamsMeetingTemplates.idHint')}</p>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={(): void => setDraft(null)}
              className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              disabled={!draft.name.trim() || !draft.meetingTemplateId.trim()}
              onClick={saveDraft}
              className="rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50"
            >
              {t('common.save')}
            </button>
          </div>
        </div>
      ) : null}

      <ul className="space-y-1 rounded-md border border-border bg-background/40 p-1">
        {templates.length === 0 ? (
          <li className="px-2 py-4 text-center text-xs text-muted-foreground">
            {t('settings.teamsMeetingTemplates.empty')}
          </li>
        ) : (
          templates.map((tpl) => (
            <li
              key={tpl.id}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/60"
            >
              <LayoutTemplate className="h-3.5 w-3.5 shrink-0 text-blue-500" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{tpl.name}</div>
                <div className="truncate font-mono text-2xs text-muted-foreground">
                  {tpl.meetingTemplateId}
                </div>
              </div>
              {tpl.builtin ? (
                <span className="shrink-0 rounded-full bg-blue-500/10 px-1.5 py-0.5 text-2xs text-blue-600 dark:text-blue-400">
                  {t('settings.teamsMeetingTemplates.builtinBadge')}
                </span>
              ) : (
                <button
                  type="button"
                  title={t('common.delete')}
                  aria-label={t('common.delete')}
                  onClick={(): void => {
                    void handleDelete(tpl)
                  }}
                  className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))
        )}
      </ul>
    </section>
  )
}
