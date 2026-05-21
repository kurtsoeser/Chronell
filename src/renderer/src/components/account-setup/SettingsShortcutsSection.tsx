import { useTranslation } from 'react-i18next'

interface ShortcutRow {
  keys: string
  description: string
}

interface ShortcutGroup {
  title: string
  rows: ShortcutRow[]
}

function ShortcutTable({ groups }: { groups: ShortcutGroup[] }): JSX.Element {
  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group.title}>
          <h4 className="mb-1.5 text-[11px] font-semibold text-foreground">{group.title}</h4>
          <table className="w-full border-collapse text-xs">
            <tbody>
              {group.rows.map((row) => (
                <tr key={`${group.title}-${row.keys}`} className="border-t border-white/[0.04] dark:border-white/[0.04] first:border-t-0">
                  <td className="w-[38%] max-w-[12rem] py-1.5 pr-3 align-top">
                    <kbd className="inline-block rounded border border-white/[0.06] dark:border-white/[0.06] bg-background px-1.5 py-0.5 font-mono text-[10px] leading-snug text-foreground shadow-sm">
                      {row.keys}
                    </kbd>
                  </td>
                  <td className="py-1.5 align-top leading-relaxed text-muted-foreground">{row.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}

export function SettingsShortcutsSection(): JSX.Element {
  const { t } = useTranslation()
  const mod = t('settings.shortcuts.modKey')

  const groups: ShortcutGroup[] = [
    {
      title: t('settings.shortcuts.sectionZoom'),
      rows: [
        {
          keys: t('settings.shortcuts.keys.previewZoomIn', { mod }),
          description: t('settings.shortcuts.desc.previewZoomIn')
        },
        {
          keys: t('settings.shortcuts.keys.previewZoomOut', { mod }),
          description: t('settings.shortcuts.desc.previewZoomOut')
        },
        {
          keys: t('settings.shortcuts.keys.previewZoomReset', { mod }),
          description: t('settings.shortcuts.desc.previewZoomReset')
        },
        {
          keys: t('settings.shortcuts.keys.previewWheel', { mod }),
          description: t('settings.shortcuts.desc.previewWheel')
        },
        {
          keys: t('settings.shortcuts.keys.previewPinch'),
          description: t('settings.shortcuts.desc.previewPinch')
        },
        {
          keys: t('settings.shortcuts.keys.uiZoomIn', { mod }),
          description: t('settings.shortcuts.desc.uiZoomIn')
        },
        {
          keys: t('settings.shortcuts.keys.uiZoomOut', { mod }),
          description: t('settings.shortcuts.desc.uiZoomOut')
        },
        {
          keys: t('settings.shortcuts.keys.uiZoomReset', { mod }),
          description: t('settings.shortcuts.desc.uiZoomReset')
        }
      ]
    },
    {
      title: t('settings.shortcuts.sectionGlobal'),
      rows: [
        {
          keys: t('settings.shortcuts.keys.search', { mod }),
          description: t('settings.shortcuts.desc.search')
        },
        {
          keys: t('settings.shortcuts.keys.undo', { mod }),
          description: t('settings.shortcuts.desc.undo')
        }
      ]
    },
    {
      title: t('settings.shortcuts.sectionMail'),
      rows: [
        { keys: 'J / ↓', description: t('settings.shortcuts.desc.mailNext') },
        { keys: 'K / ↑', description: t('settings.shortcuts.desc.mailPrev') },
        { keys: 'R', description: t('settings.shortcuts.desc.mailReply') },
        { keys: t('settings.shortcuts.keys.shiftR'), description: t('settings.shortcuts.desc.mailReplyAll') },
        { keys: 'L', description: t('settings.shortcuts.desc.mailForward') },
        { keys: 'U', description: t('settings.shortcuts.desc.mailReadToggle') },
        { keys: 'F', description: t('settings.shortcuts.desc.mailFlag') },
        { keys: 'A / E', description: t('settings.shortcuts.desc.mailArchive') },
        { keys: t('settings.shortcuts.keys.del'), description: t('settings.shortcuts.desc.mailDelete') },
        { keys: 'S', description: t('settings.shortcuts.desc.mailSnooze') },
        { keys: 'T', description: t('settings.shortcuts.desc.mailTodoToday') },
        { keys: 'M', description: t('settings.shortcuts.desc.mailTodoTomorrow') },
        { keys: 'G', description: t('settings.shortcuts.desc.mailTodoWeek') },
        { keys: 'P', description: t('settings.shortcuts.desc.mailTodoLater') },
        { keys: 'W', description: t('settings.shortcuts.desc.mailWaiting') }
      ]
    },
    {
      title: t('settings.shortcuts.sectionCalendar'),
      rows: [
        { keys: 'T', description: t('settings.shortcuts.desc.calToday') },
        { keys: 'Alt+T', description: t('settings.shortcuts.desc.calTodayScroll') },
        { keys: 'J', description: t('settings.shortcuts.desc.calNext') },
        { keys: 'K', description: t('settings.shortcuts.desc.calPrev') },
        { keys: '.', description: t('settings.shortcuts.desc.calGotoDate') },
        { keys: '/', description: t('settings.shortcuts.desc.calSearch') },
        {
          keys: t('settings.shortcuts.keys.calSearchMod', { mod }),
          description: t('settings.shortcuts.desc.calSearch')
        },
        { keys: 'D / 1', description: t('settings.shortcuts.desc.calDay') },
        { keys: 'W / 0', description: t('settings.shortcuts.desc.calWeek') },
        { keys: 'M', description: t('settings.shortcuts.desc.calMonth') },
        { keys: 'Y', description: t('settings.shortcuts.desc.calYear') },
        { keys: 'L', description: t('settings.shortcuts.desc.calList') },
        { keys: '2–9', description: t('settings.shortcuts.desc.calMultiDay') },
        {
          keys: t('settings.shortcuts.keys.calGridFiner', { mod }),
          description: t('settings.shortcuts.desc.calGridFiner')
        },
        {
          keys: t('settings.shortcuts.keys.calGridCoarser', { mod }),
          description: t('settings.shortcuts.desc.calGridCoarser')
        },
        {
          keys: t('settings.shortcuts.keys.calViewWheel', { mod }),
          description: t('settings.shortcuts.desc.calViewWheel')
        },
        {
          keys: t('settings.shortcuts.keys.calViewPinch'),
          description: t('settings.shortcuts.desc.calViewPinch')
        }
      ]
    },
    {
      title: t('settings.shortcuts.sectionConnections'),
      rows: [
        { keys: t('settings.shortcuts.keys.graphWheel'), description: t('settings.shortcuts.desc.graphWheel') },
        {
          keys: t('settings.shortcuts.keys.graphModClick', { mod }),
          description: t('settings.shortcuts.desc.graphModClick')
        }
      ]
    },
    {
      title: t('settings.shortcuts.sectionGeneralKeys'),
      rows: [{ keys: 'Esc', description: t('settings.shortcuts.desc.esc') }]
    }
  ]

  return (
    <section className="space-y-2 rounded-md bg-background/60 p-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {t('settings.shortcutsHeading')}
      </h3>
      <p className="text-xs leading-relaxed text-muted-foreground">{t('settings.shortcutsIntro')}</p>
      <ShortcutTable groups={groups} />
      <p className="text-[10px] leading-relaxed text-muted-foreground">{t('settings.shortcutsFootnote')}</p>
    </section>
  )
}
