# Chronell Fluent Redesign – Plan & Status

Basis: [design-grundlagen-fluent.md](./design-grundlagen-fluent.md)

## Materiallogik

| Ebene | Klasse | Verwendung |
|-------|--------|------------|
| L0 Mica | `.app-chrome-root` / `.chronell-mica-shell` | App-Hintergrund |
| L1 Shell | `.chronell-shell-bar` / `.module-nav-column` | Topbar, Sidebars |
| L2 Solid | `.chronell-surface`, `.chronell-surface-flat` | Karten, Mail-Spalten |
| L2 Dashboard | `.chronell-dashboard-panel` | Start-Kacheln |
| L4 Acrylic | `.chronell-acrylic`, `.chronell-acrylic-popover` | Menüs, Popover, Toasts |
| L5 Smoke | `.chronell-smoke` | Modale Overlays |

## Phasen

### Phase A – Fundament ✅

- [x] `chronell-tokens.css` – Global + Alias Tokens
- [x] `globals.css` importiert Chronell-Tokens
- [x] Dark/Light HSL auf Fluent-Graustufen
- [x] Noto Sans (gebündelt via @fontsource), Radius-, Motion-Skala
- [x] `tailwind.config.js` angepasst

### Phase B – Chrome ✅

- [x] Mica-Shell Hintergrund
- [x] Topbar → Solid Shell
- [x] Modale → `.chronell-smoke`
- [x] Context-Menü → `.chronell-acrylic-popover`

### Phase C – Shells ✅

- [x] `module-nav-column` über Chronell-Sidebar-Farbe
- [x] Mail: `MailList`, `ReadingPane` → `.chronell-surface-flat`
- [x] Kalender / Aufgaben / Workflow: Detail-Spalten → `.chronell-surface-flat`
- [x] Notizen: Haupt- und Vorschau-Spalte → `.chronell-surface-flat`

### Phase D – Komponenten ✅

- [x] `chronell-ui-classes.ts`
- [x] `ModuleColumnHeader` → `.chronell-column-header`
- [x] Mail-Listenzeilen → `.chronell-list-row`

### Phase E – Overlays ✅

- [x] ContextMenu, Modal (Smoke)
- [x] ThemeToggle, GlobalSearch, SnoozePicker, View-Menüs
- [x] **Bulk:** ~24 Popover/Dialoge → `chronell-acrylic-popover` / `chronell-dialog-panel`
- [x] Toasts → Acrylic
- [x] Tooltips (Gantt) → `.chronell-acrylic-tooltip`

### Phase F – Highlights ✅ (Kern)

- [x] Dashboard-Kacheln Fluent-Panel
- [x] Gantt: selektierter Balken + Now-Line
- [x] FullCalendar: Auswahl-Gradient + Fokus-Ring
- [x] AI-Einstellungen + Connections-Scan → `.chronell-prompt-card`

## Token-Migration (alt → neu)

| Alt | Neu |
|-----|-----|
| `glass-topbar` | `chronell-shell-bar` (Alias aktiv) |
| `glass-panel` | `chronell-acrylic-popover` (Alias aktiv) |
| `glass-fill` | `chronell-surface-flat` (Alias aktiv) |
| `dashboard-tile` | `chronell-dashboard-panel` (Alias aktiv) |
| `bg-popover shadow-xl` | `chronell-acrylic-popover` |

Theme-Picker (`theme.ts`) bleibt kompatibel über `--background`, `--sidebar`, `--card`, `--muted`.

## Offen / optional

- [ ] `ChronellButton` Primitive (einheitliche Hover/Focus)
- [ ] Schrittweise `border-border` → Token-Klassen in großen Dateien
- [ ] High-Contrast-Stichprobe (`prefers-reduced-transparency` ist vorbereitet)
- [ ] Preset „Graphite Pro“ mit Nutzer-Hex-Werten
- [ ] AccountSetupDialog / Composer: verbleibende `bg-background/40`-Karten

## Visuell prüfen

1. Dashboard (Kacheln + Glas-Canvas)
2. Mail (Liste + Lesebereich)
3. Kalender (Termin auswählen → Gradient)
4. Aufgaben / Notizen Popover
5. Einstellungen → KI-Verbindungen (Prompt-Karten)
