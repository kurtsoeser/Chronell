export type SettingsSearchTab =
  | 'general'
  | 'accounts'
  | 'mail'
  | 'calendar'
  | 'bookings'
  | 'contacts'
  | 'notes'
  | 'tasks'
  | 'info'

export type SettingsSearchEntry = {
  id: string
  tab: SettingsSearchTab
  subNav: string
  /** i18n key for the section title (usually under settings.*). */
  labelKey: string
  /** Extra searchable terms (DE/EN aliases, synonyms). */
  keywords: string[]
}

/**
 * Alle navigierbaren Einstellungs-Unterpunkte inkl. Such-Synonyme.
 * Labels kommen zur Laufzeit aus i18n; keywords erweitern die Volltextsuche.
 */
export const SETTINGS_SEARCH_CATALOG: readonly SettingsSearchEntry[] = [
  // General
  {
    id: 'general.language',
    tab: 'general',
    subNav: 'language',
    labelKey: 'settings.languageSection',
    keywords: ['sprache', 'language', 'locale', 'deutsch', 'english']
  },
  {
    id: 'general.shortcuts',
    tab: 'general',
    subNav: 'shortcuts',
    labelKey: 'settings.shortcutsHeading',
    keywords: ['tastatur', 'shortcuts', 'hotkeys', 'tasten', 'keyboard']
  },
  {
    id: 'general.appearance',
    tab: 'general',
    subNav: 'appearance',
    labelKey: 'settings.appearanceHeading',
    keywords: ['darstellung', 'appearance', 'theme', 'farbe', 'accent', 'skalierung', 'scale', 'dark', 'light']
  },
  {
    id: 'general.modules',
    tab: 'general',
    subNav: 'modules',
    labelKey: 'settings.modulesHeading',
    keywords: ['module', 'topbar', 'leiste']
  },
  {
    id: 'general.weather',
    tab: 'general',
    subNav: 'weather',
    labelKey: 'settings.weatherHeading',
    keywords: ['wetter', 'weather', 'ort', 'location']
  },
  {
    id: 'general.oauth',
    tab: 'general',
    subNav: 'oauth',
    labelKey: 'settings.oauthSummary',
    keywords: ['oauth', 'client id', 'microsoft', 'google', 'anmeldung']
  },
  {
    id: 'general.notion',
    tab: 'general',
    subNav: 'notion',
    labelKey: 'settings.notionHeading',
    keywords: ['notion', 'integration']
  },
  {
    id: 'general.aiConnections',
    tab: 'general',
    subNav: 'aiConnections',
    labelKey: 'settings.aiConnections.nav',
    keywords: ['ki', 'ai', 'gemini', 'openai', 'ollama', 'api', 'schlüssel', 'key']
  },
  {
    id: 'general.cloudSync',
    tab: 'general',
    subNav: 'cloudSync',
    labelKey: 'settings.cloudSync.heading',
    keywords: ['cloud', 'sync', 'synchronisation', 'icloud', 'onedrive']
  },
  {
    id: 'general.demo',
    tab: 'general',
    subNav: 'demo',
    labelKey: 'demo.settingsNav',
    keywords: ['demo', 'beispiel', 'sample']
  },
  {
    id: 'general.backup',
    tab: 'general',
    subNav: 'backup',
    labelKey: 'settings.backupHeading',
    keywords: ['backup', 'sicherung', 'export', 'import', 'wiederherstellen', 'restore']
  },

  // Accounts
  {
    id: 'accounts.connected',
    tab: 'accounts',
    subNav: 'connected',
    labelKey: 'settings.connectedAccounts',
    keywords: ['konten', 'accounts', 'konto', 'account', 'postfach', 'mailbox', 'anmelden', 'verbinden']
  },

  // Mail
  {
    id: 'mail.sync',
    tab: 'mail',
    subNav: 'sync',
    labelKey: 'settings.syncWindowHeading',
    keywords: ['sync', 'synchronisation', 'abruf', 'poll', 'index']
  },
  {
    id: 'mail.display',
    tab: 'mail',
    subNav: 'display',
    labelKey: 'settings.mailDisplayHeading',
    keywords: ['darstellung', 'vorschau', 'preview', 'bilder', 'images']
  },
  {
    id: 'mail.previewMeta',
    tab: 'mail',
    subNav: 'previewMeta',
    labelKey: 'settings.mailPreviewMetaHeading',
    keywords: ['metadaten', 'meta', 'felder', 'preview']
  },
  {
    id: 'mail.compose',
    tab: 'mail',
    subNav: 'compose',
    labelKey: 'settings.mailCompose.heading',
    keywords: ['verfassen', 'compose', 'schrift', 'font', 'editor']
  },
  {
    id: 'mail.listHover',
    tab: 'mail',
    subNav: 'listHover',
    labelKey: 'settings.mailListHoverHeading',
    keywords: ['hover', 'mouseover', 'aktionen', 'liste']
  },
  {
    id: 'mail.quickSteps',
    tab: 'mail',
    subNav: 'quickSteps',
    labelKey: 'settings.quickSteps.heading',
    keywords: ['quicksteps', 'quick steps', 'schnellaktionen', 'aktionen']
  },
  {
    id: 'mail.textSnippets',
    tab: 'mail',
    subNav: 'textSnippets',
    labelKey: 'settings.textSnippets.heading',
    keywords: [
      'textbausteine',
      'textbaustein',
      'vorlagen',
      'vorlage',
      'snippets',
      'snippet',
      'bausteine',
      'canned',
      'templates',
      'template'
    ]
  },
  {
    id: 'mail.sidebarFolders',
    tab: 'mail',
    subNav: 'sidebarFolders',
    labelKey: 'settings.mailSidebarFoldersHeading',
    keywords: ['ordner', 'folders', 'sidebar', 'seitenleiste']
  },
  {
    id: 'mail.triage',
    tab: 'mail',
    subNav: 'triage',
    labelKey: 'settings.triageHeading',
    keywords: ['triage', 'wip', 'workflow', 'bearbeitung']
  },
  {
    id: 'mail.categories',
    tab: 'mail',
    subNav: 'categories',
    labelKey: 'settings.categoriesHeading',
    keywords: ['kategorien', 'categories', 'kategorie', 'category', 'farben', 'tags', 'outlook']
  },
  {
    id: 'mail.signatures',
    tab: 'mail',
    subNav: 'signatures',
    labelKey: 'settings.signaturesHeading',
    keywords: ['signatur', 'signature', 'footer', 'grußformel']
  },
  {
    id: 'mail.rules',
    tab: 'mail',
    subNav: 'rules',
    labelKey: 'settings.mailRulesHeading',
    keywords: ['regeln', 'rules', 'filter', 'automatisierung']
  },

  // Calendar
  {
    id: 'calendar.workspace',
    tab: 'calendar',
    subNav: 'workspace',
    labelKey: 'settings.calendarWorkspaceHeading',
    keywords: ['kalender', 'calendar', 'workspace', 'ansicht']
  },
  {
    id: 'calendar.display',
    tab: 'calendar',
    subNav: 'display',
    labelKey: 'settings.calendarDisplayHeading',
    keywords: ['darstellung', 'display', 'farbe']
  },
  {
    id: 'calendar.layers',
    tab: 'calendar',
    subNav: 'layers',
    labelKey: 'settings.calendarLayersHeading',
    keywords: ['ebenen', 'layers']
  },
  {
    id: 'calendar.panels',
    tab: 'calendar',
    subNav: 'panels',
    labelKey: 'settings.calendarPanelsHeading',
    keywords: ['panels', 'paneele']
  },
  {
    id: 'calendar.timeline',
    tab: 'calendar',
    subNav: 'timeline',
    labelKey: 'settings.calendarTimelineHeading',
    keywords: ['timeline', 'zeitleiste']
  },
  {
    id: 'calendar.templates',
    tab: 'calendar',
    subNav: 'templates',
    labelKey: 'settings.calendarTemplates.heading',
    keywords: ['termin-templates', 'event templates', 'vorlagen', 'templates']
  },
  {
    id: 'calendar.advanced',
    tab: 'calendar',
    subNav: 'advanced',
    labelKey: 'settings.calendarAdvancedHeading',
    keywords: ['erweitert', 'advanced']
  },
  {
    id: 'calendar.timezone',
    tab: 'calendar',
    subNav: 'timezone',
    labelKey: 'settings.calendarTzHeading',
    keywords: ['zeitzone', 'timezone', 'tz']
  },
  {
    id: 'calendar.bookWithMe',
    tab: 'calendar',
    subNav: 'bookWithMe',
    labelKey: 'settings.bookWithMeHeading',
    keywords: ['book with me', 'buchung', 'terminbuchung']
  },
  {
    id: 'calendar.api',
    tab: 'calendar',
    subNav: 'api',
    labelKey: 'settings.calendarApiHeading',
    keywords: ['api', 'graph']
  },
  {
    id: 'calendar.sidebar',
    tab: 'calendar',
    subNav: 'sidebar',
    labelKey: 'settings.calendarSidebarHeading',
    keywords: ['sidebar', 'seitenleiste', 'kalenderliste']
  },

  // Bookings
  {
    id: 'bookings.overview',
    tab: 'bookings',
    subNav: 'overview',
    labelKey: 'settings.bookingsSubOverview',
    keywords: ['bookings', 'buchungen', 'übersicht']
  },
  {
    id: 'bookings.personal',
    tab: 'bookings',
    subNav: 'personal',
    labelKey: 'settings.bookingsSubPersonal',
    keywords: ['persönlich', 'personal']
  },
  {
    id: 'bookings.access',
    tab: 'bookings',
    subNav: 'access',
    labelKey: 'settings.bookingsSubAccess',
    keywords: ['zugriff', 'access', 'freigabe']
  },

  // Contacts
  {
    id: 'contacts.workspace',
    tab: 'contacts',
    subNav: 'workspace',
    labelKey: 'settings.contactsWorkspaceHeading',
    keywords: ['kontakte', 'contacts', 'personen']
  },
  {
    id: 'contacts.avatars',
    tab: 'contacts',
    subNav: 'avatars',
    labelKey: 'settings.contactsAvatarsHeading',
    keywords: ['avatars', 'bilder', 'fotos']
  },
  {
    id: 'contacts.google',
    tab: 'contacts',
    subNav: 'google',
    labelKey: 'settings.contactsGoogleHeading',
    keywords: ['google', 'gmail']
  },
  {
    id: 'contacts.microsoft',
    tab: 'contacts',
    subNav: 'microsoft',
    labelKey: 'settings.contactsMicrosoftHeading',
    keywords: ['microsoft', 'outlook', '365']
  },
  {
    id: 'contacts.accountsLink',
    tab: 'contacts',
    subNav: 'accountsLink',
    labelKey: 'settings.contactsGoAccounts',
    keywords: ['konten', 'accounts']
  },

  // Notes
  {
    id: 'notes.workspace',
    tab: 'notes',
    subNav: 'workspace',
    labelKey: 'settings.notesWorkspaceHeading',
    keywords: ['notizen', 'notes']
  },
  {
    id: 'notes.display',
    tab: 'notes',
    subNav: 'display',
    labelKey: 'settings.notesDisplayHeading',
    keywords: ['darstellung', 'display']
  },
  {
    id: 'notes.editor',
    tab: 'notes',
    subNav: 'editor',
    labelKey: 'settings.notesEditorHeading',
    keywords: ['editor', 'seitenvorlagen', 'page templates']
  },
  {
    id: 'notes.sidebar',
    tab: 'notes',
    subNav: 'sidebar',
    labelKey: 'settings.notesSidebarHeading',
    keywords: ['sidebar', 'seitenleiste']
  },
  {
    id: 'notes.pages',
    tab: 'notes',
    subNav: 'pages',
    labelKey: 'settings.notesPagesHeading',
    keywords: ['seiten', 'pages']
  },
  {
    id: 'notes.calendar',
    tab: 'notes',
    subNav: 'calendar',
    labelKey: 'settings.notesCalendarHeading',
    keywords: ['kalender', 'calendar']
  },
  {
    id: 'notes.linked',
    tab: 'notes',
    subNav: 'linked',
    labelKey: 'settings.notesLinkedHeading',
    keywords: ['verknüpfungen', 'links', 'linked']
  },
  {
    id: 'notes.workflow',
    tab: 'notes',
    subNav: 'workflow',
    labelKey: 'settings.notesWorkflowHeading',
    keywords: ['workflow', 'ablauf']
  },

  // Tasks
  {
    id: 'tasks.workspace',
    tab: 'tasks',
    subNav: 'workspace',
    labelKey: 'settings.tasksWorkspaceHeading',
    keywords: ['aufgaben', 'tasks', 'todo']
  },
  {
    id: 'tasks.display',
    tab: 'tasks',
    subNav: 'display',
    labelKey: 'settings.tasksDisplayHeading',
    keywords: ['darstellung', 'überfällig', 'overdue']
  },
  {
    id: 'tasks.list',
    tab: 'tasks',
    subNav: 'list',
    labelKey: 'settings.tasksListHeading',
    keywords: ['liste', 'list', 'sortierung']
  },
  {
    id: 'tasks.due',
    tab: 'tasks',
    subNav: 'due',
    labelKey: 'settings.tasksDueHeading',
    keywords: ['fälligkeit', 'due', 'deadline']
  },
  {
    id: 'tasks.kanban',
    tab: 'tasks',
    subNav: 'kanban',
    labelKey: 'settings.tasksKanbanHeading',
    keywords: ['kanban', 'board']
  },
  {
    id: 'tasks.mail',
    tab: 'tasks',
    subNav: 'mail',
    labelKey: 'settings.tasksMailHeading',
    keywords: ['mail', 'e-mail']
  },
  {
    id: 'tasks.detail',
    tab: 'tasks',
    subNav: 'detail',
    labelKey: 'settings.tasksDetailHeading',
    keywords: ['detail', 'details']
  },
  {
    id: 'tasks.sync',
    tab: 'tasks',
    subNav: 'sync',
    labelKey: 'settings.tasksSyncHeading',
    keywords: ['sync', 'synchronisation']
  },

  // Info
  {
    id: 'info.about',
    tab: 'info',
    subNav: 'about',
    labelKey: 'settings.infoAboutHeading',
    keywords: ['info', 'about', 'version', 'über', 'chronell']
  }
] as const

const TAB_LABEL_KEYS: Record<SettingsSearchTab, string> = {
  general: 'settings.tabGeneral',
  accounts: 'settings.tabAccounts',
  mail: 'settings.tabMail',
  calendar: 'settings.tabCalendar',
  bookings: 'settings.tabBookings',
  contacts: 'settings.tabContacts',
  notes: 'settings.tabNotes',
  tasks: 'settings.tabTasks',
  info: 'settings.tabInfo'
}

export function settingsTabLabelKey(tab: SettingsSearchTab): string {
  return TAB_LABEL_KEYS[tab]
}

function normalizeSearch(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim()
}

export type SettingsSearchHit = SettingsSearchEntry & {
  label: string
  tabLabel: string
  score: number
}

export function searchSettingsCatalog(
  query: string,
  translate: (key: string) => string
): SettingsSearchHit[] {
  const q = normalizeSearch(query)
  if (q.length < 1) return []

  const hits: SettingsSearchHit[] = []
  for (const entry of SETTINGS_SEARCH_CATALOG) {
    const label = translate(entry.labelKey)
    const tabLabel = translate(settingsTabLabelKey(entry.tab))
    const haystacks = [
      normalizeSearch(label),
      normalizeSearch(tabLabel),
      ...entry.keywords.map(normalizeSearch)
    ]
    let score = 0
    for (const hay of haystacks) {
      if (!hay) continue
      if (hay === q) score = Math.max(score, 100)
      else if (hay.startsWith(q)) score = Math.max(score, 80)
      else if (hay.includes(q)) score = Math.max(score, 60)
      else {
        const parts = q.split(/\s+/).filter(Boolean)
        if (parts.length > 1 && parts.every((p) => hay.includes(p))) {
          score = Math.max(score, 50)
        }
      }
    }
    if (score > 0) {
      hits.push({ ...entry, label, tabLabel, score })
    }
  }

  hits.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label, 'de'))
  return hits.slice(0, 24)
}
