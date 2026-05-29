import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pencil, Plus, Trash2, Zap } from 'lucide-react'
import { QuickStepEditorDialog } from '@/components/quicksteps/QuickStepEditorDialog'
import { resolveQuickStepHoverIcon } from '@/lib/mail-quickstep-hover-icon'
import { dispatchQuickStepsChanged } from '@/lib/quicksteps-changed'
import { showAppConfirm } from '@/stores/app-dialog'
import type { MailQuickStep } from '@shared/types'
import type { MailQuickStepDetail } from '@shared/quicksteps'

export default function SettingsQuickStepsSection(): JSX.Element {
  const { t } = useTranslation()
  const [steps, setSteps] = useState<MailQuickStep[]>([])
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<MailQuickStepDetail | null>(null)

  const load = useCallback(async (): Promise<void> => {
    try {
      const list = await window.mailClient.mail.listQuickStepsAll()
      setSteps(list)
    } catch {
      setSteps([])
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function openEdit(step: MailQuickStep): Promise<void> {
    const detail = await window.mailClient.mail.getQuickStep(step.id)
    setEditing(detail)
    setEditorOpen(true)
  }

  function openNew(): void {
    setEditing(null)
    setEditorOpen(true)
  }

  async function handleDelete(step: MailQuickStep): Promise<void> {
    const ok = await showAppConfirm(t('settings.quickSteps.deleteConfirm', { name: step.name }), {
      title: t('settings.quickSteps.deleteTitle'),
      variant: 'danger',
      confirmLabel: t('common.delete')
    })
    if (!ok) return
    await window.mailClient.mail.deleteQuickStep(step.id)
    dispatchQuickStepsChanged()
    void load()
  }

  function handleSaved(): void {
    dispatchQuickStepsChanged()
    void load()
  }

  return (
    <section className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Zap className="h-3.5 w-3.5 text-amber-500" />
            {t('settings.quickSteps.heading')}
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {t('settings.quickSteps.intro')}
          </p>
        </div>
        <button
          type="button"
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs hover:bg-muted"
          onClick={openNew}
        >
          <Plus className="h-3.5 w-3.5" />
          {t('settings.quickSteps.new')}
        </button>
      </div>

      <ul className="space-y-1 rounded-md border border-border bg-background/40 p-1">
        {steps.length === 0 ? (
          <li className="px-2 py-3 text-center text-xs text-muted-foreground">
            {t('settings.quickSteps.empty')}
          </li>
        ) : (
          steps.map((step) => {
            const Icon = resolveQuickStepHoverIcon(step)
            return (
              <li
                key={step.id}
                className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-muted/60"
              >
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate text-sm">{step.name}</span>
                <button
                  type="button"
                  className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                  title={t('common.edit')}
                  onClick={(): void => void openEdit(step)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  className="rounded p-1 text-destructive hover:bg-destructive/10"
                  title={t('common.delete')}
                  onClick={(): void => void handleDelete(step)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            )
          })
        )}
      </ul>

      <QuickStepEditorDialog
        open={editorOpen}
        initial={editing}
        onClose={(): void => setEditorOpen(false)}
        onSaved={handleSaved}
      />
    </section>
  )
}
