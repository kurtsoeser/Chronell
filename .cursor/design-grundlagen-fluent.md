 **Ziel:** Chronell soll sich wie eine moderne Windows-/Microsoft-365-App anfühlen: ruhig, hochwertig, dunkel, produktivitätsorientiert, mit subtilen Glas-/Materialeffekten – aber ohne übertriebene „Glassmorphism-Spielerei“.

---

# 1. Ausgangspunkt & Design-Richtung

Chronell soll visuell wirken wie:

> **Ein edles, dunkles Produktivitäts-Cockpit im Stil von Windows 11 + Fluent 2 – mit Mica-artiger Tiefe, Acrylic für temporäre Ebenen und einem subtilen Chronell-Orbit-Akzent.**

Fluent 2 beschreibt **Material** als Oberflächenqualität beziehungsweise Textur einer UI-Fläche. Fluent unterstützt unter anderem **Solid**, **Mica**, **Acrylic** und **Smoke** als Materialtypen.  
Quelle: Fluent 2 Material / Microsoft Learn Materials.  
https://fluent2.microsoft.design/material  
https://learn.microsoft.com/de-de/windows/apps/design/signature-experiences/materials

Für Chronell bedeutet das:

- **Solid** = normale App-Flächen, Karten, Listen, Hauptbereiche
- **Mica** = App-Hintergrund / große Grundflächen
- **Acrylic** = temporäre Overlays, Menüs, Popovers, Command-Paletten
- **Smoke** = Abdunklung hinter Dialogen / modalen Zuständen

---

# 2. Chronell Design-Prinzip

## 2.1 Leitidee

Chronell soll nicht wie eine klassische Web-App wirken, sondern wie ein eigenständiges, hochwertiges System für Zeit, Fokus und Entscheidungen.

> **Inbox war gestern. Chronell ist dein System für Zeit, Fokus und Entscheidung.**

Die UI soll folgende Eigenschaften transportieren:

- ruhig
- dunkel
- edel
- fokussiert
- Microsoft-nah
- produktivitätsorientiert
- nicht verspielt
- nicht bunt
- nicht „billiges Glas“

---

# 3. Material-Prinzipien für Chronell

## 3.1 Mica als Basis-Material

Mica ist laut Microsoft ein undurchsichtiges Material, das in Windows 11 eingeführt wurde und subtil mit der Desktop-Hintergrundfarbe getönt wird. Mica unterstützt hellen und dunklen Modus und kann aktive/inaktive Fensterzustände anzeigen.  
Quelle: Microsoft Learn – Materialien in Windows.  
https://learn.microsoft.com/de-de/windows/apps/design/signature-experiences/materials

Für Chronell:

> **Mica soll als ruhige App-Basis verstanden werden – nicht als auffälliger Glas-Effekt.**

### Einsatz in Chronell

Verwenden für:

- App-Hintergrund
- Haupt-Dashboard-Fläche
- große Shell-Flächen
- Seitenleisten-Grundfläche
- eventuell Top-Bar / Command-Bar

Nicht verwenden für:

- jede einzelne Karte
- jeden Button
- kleine interaktive Elemente
- stark verschachtelte Bereiche

### Visuelles Ziel

Mica in Chronell soll:

- dunkel
- grau
- ruhig
- leicht getönt
- hochwertig
- nicht durchsichtig im „billigen Glas“-Sinn

wirken.

---

## 3.2 Acrylic nur für temporäre UI

Acrylic ist laut Microsoft ein semitransparentes Material, das einen Milchglas-Effekt erzeugt. In Windows 11 wurde Acrylic heller und transluzenter, damit eine stärkere kontextbezogene Beziehung zu dahinterliegenden visuellen Elementen entsteht. Microsoft empfiehlt Acrylic für vorübergehende, leicht schließbare Oberflächen wie Flyouts und Kontextmenüs.  
Quelle: Microsoft Learn – Materialien in Windows.  
https://learn.microsoft.com/de-de/windows/apps/design/signature-experiences/materials

Für Chronell:

> **Acrylic nicht als Standard-Kartenhintergrund verwenden, sondern gezielt für temporäre UI-Ebenen.**

### Einsatz in Chronell

Verwenden für:

- Kontextmenüs
- Popover
- Command Palette
- Schnellauswahl
- Filter-Menüs
- Kalender-Detail-Popup
- Copilot-Prompt-Auswahl
- Dateivorschau-Mini-Popup

Nicht verwenden für:

- normale Dashboard-Karten
- Hauptnavigation
- dauerhafte Listen
- große Inhaltscontainer

### Visuelles Ziel

Acrylic soll nur dort erscheinen, wo etwas „über“ der App liegt.

Beispiele:

- Nutzer öffnet ein Menü → Acrylic
- Nutzer öffnet eine Schnellaktion → Acrylic
- Nutzer öffnet Kalenderdetails → Acrylic
- Nutzer sieht normale Dashboardkarte → kein Acrylic, sondern Solid/Mica-inspiriert

---

## 3.3 Smoke für modale Zustände

Smoke wird laut Fluent/Windows-Dokumentation verwendet, um wichtige UI-Flächen hervorzuheben, indem darunterliegende Oberflächen abgedunkelt werden. Smoke signalisiert blockierte Interaktion unter einer modalen Oberfläche wie einem Dialog. Smoke ist nicht modusabhängig und bleibt transluzent schwarz.  
Quelle: Fluent 2 Material / Microsoft Learn Materials.  
https://fluent2.microsoft.design/material  
https://learn.microsoft.com/de-de/windows/apps/design/signature-experiences/materials

Für Chronell:

> **Smoke nur bei echten Dialogen verwenden.**

### Einsatz in Chronell

Verwenden für:

- Löschbestätigung
- Kontoeinstellungen
- kritische Aktionen
- Auth-/Verbindungsdialoge
- Onboarding-Dialoge
- „Datei endgültig entfernen?“
- „Kalenderkonto trennen?“

Nicht verwenden für:

- normale Panels
- Hover-Karten
- einfache Menüs

---

# 4. Oberflächen-Hierarchie

Fluent beschreibt Elevation als wahrgenommene Distanz zwischen einem Objekt und der Fläche dahinter. Elevation nutzt Schatten und Licht, um visuelle Hinweise, bessere Scanbarkeit und Wichtigkeitsstufen zu erzeugen.  
Quelle: Fluent 2 Elevation.  
https://fluent2.microsoft.design/elevation

Für Chronell sollte es klare Ebenen geben:

| Ebene | Name | Zweck | Material |
|---|---|---|---|
| Level 0 | App Background | gesamter App-Hintergrund | Mica-inspiriert |
| Level 1 | Shell / Sidebar | Navigation, App-Struktur | dunkles Solid mit Mica-Tint |
| Level 2 | Cards / Panels | Kalender, Prompts, Dateien | Solid, leicht transparent |
| Level 3 | Raised Surfaces | Hover Cards, Detailkarten | Solid + Border + Shadow |
| Level 4 | Acrylic Overlays | Menüs, Popovers, Command Palette | Acrylic |
| Level 5 | Modal Dialogs | blockierende Dialoge | Smoke + Dialog Surface |

---

# 5. Konkretes Farbsystem für Chronell

Da Chronell dunkel, grau und edel wirken soll, sollte das Farbsystem **neutral dominiert** sein.

Fluent 2 arbeitet mit Design Tokens, die Farben, Typografie, Spacing und Elevation systematisch speichern, damit keine Pixel- oder Hexwerte hart und ungeordnet verwendet werden. Fluent unterscheidet dabei zwischen **Global Tokens** für rohe Werte und **Alias Tokens** für semantisch benannte Werte.  
Quelle: Fluent 2 Design Tokens.  
https://fluent2.microsoft.design/design-tokens

---

## 5.1 Dark Theme – empfohlen

```css
:root[data-theme="dark"] {
  --chronell-bg-app: #090A0D;
  --chronell-bg-shell: #101116;
  --chronell-bg-sidebar: #14151B;
  --chronell-bg-card: rgba(28, 29, 35, 0.86);
  --chronell-bg-card-solid: #1C1D23;
  --chronell-bg-card-hover: #232530;
  --chronell-bg-muted: #2A2D38;

  --chronell-border-subtle: rgba(255, 255, 255, 0.075);
  --chronell-border-strong: rgba(255, 255, 255, 0.14);

  --chronell-text-primary: #F5F5F7;
  --chronell-text-secondary: #C8CAD0;
  --chronell-text-muted: #8D9099;
  --chronell-text-disabled: #5F626B;

  --chronell-accent-blue: #6EA8FF;
  --chronell-accent-indigo: #667BFF;
  --chronell-accent-violet: #5A5DE6;

  --chronell-focus-ring: rgba(110, 168, 255, 0.75);
}


5.2 Light Theme – empfohlen
Css:root[data-theme="light"] {
  --chronell-bg-app: #F6F7FA;
  --chronell-bg-shell: #EEF1F5;
  --chronell-bg-sidebar: #E9ECF2;
  --chronell-bg-card: rgba(255, 255, 255, 0.88);
  --chronell-bg-card-solid: #FFFFFF;
  --chronell-bg-card-hover: #F2F5FA;
  --chronell-bg-muted: #E5E9F1;

  --chronell-border-subtle: rgba(15, 23, 42, 0.08);
  --chronell-border-strong: rgba(15, 23, 42, 0.14);

  --chronell-text-primary: #111318;
  --chronell-text-secondary: #3F4652;
  --chronell-text-muted: #6B7280;
  --chronell-text-disabled: #9AA1AE;

  --chronell-accent-blue: #3478F6;
  --chronell-accent-indigo: #4F63F1;
  --chronell-accent-violet: #5A4FE6;

  --chronell-focus-ring: rgba(52, 120, 246, 0.55);
}


6. Material-Tokens für Mica-/Acrylic-Look
6.1 Mica-inspirierter App-Hintergrund
Css.chronell-app-shell {
  background:
    radial-gradient(circle at 20% 0%, rgba(110, 168, 255, 0.10), transparent 32%),
    radial-gradient(circle at 85% 15%, rgba(90, 93, 230, 0.12), transparent 36%),
    linear-gradient(180deg, #0B0C10 0%, #090A0D 100%);
}

Designhinweis

Der Hintergrund darf subtil „leben“, aber nie den Inhalt dominieren. Die App bleibt ein Produktivitätswerkzeug, kein Visualizer.


6.2 Card Surface
Css.chronell-card {
  background: rgba(28, 29, 35, 0.86);
  border: 1px solid rgba(255, 255, 255, 0.075);
  border-radius: 28px;
  box-shadow:
    0 24px 70px rgba(0, 0, 0, 0.34),
    inset 0 1px 0 rgba(255, 255, 255, 0.045);
}

Designhinweis

Karten sollen nicht aussehen wie transparente Glasplatten, sondern wie edle, dunkle Fluent-Surfaces mit Tiefe.


6.3 Acrylic Popover
Css.chronell-acrylic-popover {
  background: rgba(30, 31, 38, 0.72);
  backdrop-filter: blur(28px) saturate(135%);
  -webkit-backdrop-filter: blur(28px) saturate(135%);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 20px;
  box-shadow:
    0 32px 80px rgba(0, 0, 0, 0.42),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

Designhinweis

Acrylic nur für temporäre Ebenen verwenden: Menüs, Popovers, Command Palette, Kalenderdetails.


6.4 Smoke Overlay
Css.chronell-smoke {
  background: rgba(0, 0, 0, 0.58);
  backdrop-filter: blur(2px);
}

Designhinweis

Smoke signalisiert: „Die App dahinter ist gerade nicht interaktiv.“


7. Typografie
Fluent 2 verwendet Segoe UI als primäre Microsoft-Schrift für Web und Windows und beschreibt Segoe als freundlich, gut lesbar und charakteristisch für Microsoft. Für native Plattformen werden systemnahe Schriften empfohlen, um eine vertraute und barrierefreie Erfahrung zu ermöglichen.
Quelle: Fluent 2 Typography.
https://fluent2.microsoft.design/typography
Empfehlung für Chronell
Css:root {
  --chronell-font-family: "Noto Sans", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

Typografie-Rampe für Chronell
Fluent 2 nennt unter anderem folgende Web-Typografiegrößen:

Caption 1: 12px / 16px
Body 1: 14px / 20px
Subtitle 2: 16px / 22px
Subtitle 1: 20px / 26px
Title 3: 24px / 32px
Title 2: 28px / 36px
Title 1: 32px / 40px

Quelle: Fluent 2 Typography.
https://fluent2.microsoft.design/typography
Für Chronell:
Css:root {
  --font-caption: 12px;
  --line-caption: 16px;

  --font-body: 14px;
  --line-body: 20px;

  --font-subtitle: 16px;
  --line-subtitle: 22px;

  --font-title-small: 20px;
  --line-title-small: 26px;

  --font-title: 24px;
  --line-title: 32px;

  --font-display-small: 32px;
  --line-display-small: 40px;
}

Textregeln
Fluent empfiehlt Sentence Case statt durchgehender Großbuchstaben, weil All Caps schwerer lesbar sind.
Quelle: Fluent 2 Typography.
https://fluent2.microsoft.design/typography
Für Chronell:

Keine ALL-CAPS-Navigation.
Keine übertrieben fetten Labels.
Titel: Semibold.
Metadaten: Regular.
Sekundärtext: gedämpft.
Kritische Texte: klar, nicht schrill.


8. Kontrast & Barrierefreiheit
Fluent 2 gibt an, dass normaler Text ein Kontrastverhältnis von mindestens 4.5:1 zum Hintergrund haben soll. Großer Text ab 18.5 px bold oder 24 px regular soll mindestens 3:1 erreichen.
Quelle: Fluent 2 Typography.
https://fluent2.microsoft.design/typography
Pflicht für Chronell
Jede Oberfläche braucht Tests für:

Dark Mode
Light Mode
Hover State
Selected State
Disabled State
Focus State
High Contrast / Kontrastmodus

Fluent Design Tokens sind laut Microsoft auf Flexibilität und Barrierefreiheit ausgelegt und unterstützen Light, Dark, High Contrast und gebrandete Elemente.
Quelle: Fluent 2 Design Tokens.
https://fluent2.microsoft.design/design-tokens

9. Elevation: Tiefe ohne „billige Schatten“
Fluent beschreibt, dass Elevation durch Zusammenspiel von Schatten und Licht erzeugt wird und eine klare Hierarchie sowie Fokus innerhalb einer Experience schafft.
Quelle: Fluent 2 Elevation.
https://fluent2.microsoft.design/elevation
Wichtig für Windows: Fluent weist darauf hin, dass Windows Strokes statt Key Shadows verwendet, um Objekte zu umreißen.
Quelle: Fluent 2 Elevation.
https://fluent2.microsoft.design/elevation
Empfehlung für Chronell

Im Dark Mode nicht zu stark mit Schatten arbeiten. Besser: Border + dezenter Schatten + innerer Highlight-Stroke.

Css.chronell-surface {
  border: 1px solid rgba(255, 255, 255, 0.075);
  box-shadow:
    0 20px 60px rgba(0, 0, 0, 0.32),
    inset 0 1px 0 rgba(255, 255, 255, 0.045);
}

Hover-Elevation
Css.chronell-card:hover {
  background: rgba(35, 37, 48, 0.92);
  border-color: rgba(110, 168, 255, 0.22);
  transform: translateY(-1px);
  box-shadow:
    0 28px 80px rgba(0, 0, 0, 0.42),
    inset 0 1px 0 rgba(255, 255, 255, 0.07);
}


10. Formen & Radien
Empfehlung
Chronell darf großzügige Radien verwenden.
Css:root {
  --radius-xs: 2px;
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --radius-xl: 10px;
  --radius-panel: 14px;
  --radius-dashboard-tile: 8px;
}

Einsatz

































ElementRadiusKleine Buttons8–10 pxInputs10–12 pxList Items12–16 pxCards20–28 pxgroße Panels28–32 pxModals24–32 px

11. Chronell-spezifischer Accent-Einsatz
Das Chronell-Logo arbeitet stark mit Blau/Violett. Diese Farben passen gut als Akzent, aber nicht als dominante UI-Farbe.
Accent-Regel

90 % Grau / Neutral, 8 % Blau, 2 % Violett-Glow.

Verwenden für

aktive Navigation
Fokus-Ringe
heutige Kalenderlinie
ausgewählte Karten
wichtige AI-/Copilot-Aktionen
Primary CTA
kleine Orbit-Highlights

Nicht verwenden für

ganze Panels
große Hintergründe
lange Textblöcke
jede Karte
jede Linie


12. Komponenten-Richtlinien
12.1 Dashboard Panels
Css.dashboard-panel {
  border-radius: 32px;
  background: rgba(25, 26, 32, 0.88);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow:
    0 30px 90px rgba(0, 0, 0, 0.36),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

Regeln

Panel-Titel links oben.
Icon klein, nicht dominant.
Maximal ein starkes Akzent-Element pro Panel.
Viel Luft lassen.
Inhalte in klaren Gruppen.


12.2 Kalenderkarte
Css.calendar-event-active {
  background: linear-gradient(
    135deg,
    rgba(75, 101, 220, 0.95),
    rgba(60, 78, 175, 0.95)
  );
  border: 1px solid rgba(130, 160, 255, 0.28);
  border-radius: 20px;
}

Regeln

Aktueller Termin darf farbig sein.
Normale Termine bleiben dunkel/grau.
Zeitachsenlinie in Accent Blue.
Der Kalender soll wie „Zeitstruktur“ wirken, nicht wie Outlook-Kalender-Kopie.


12.3 Copilot-Prompt-Karten
Css.prompt-card {
  background: rgba(20, 21, 27, 0.68);
  border: 1px solid rgba(102, 123, 255, 0.32);
  border-radius: 22px;
}

Regeln

AI-/Copilot-Bereich darf etwas stärker mit Indigo/Violett arbeiten.
Prompt-Karten sollen „intelligent“ wirken.
Nicht zu bunt.
Icons mit kleinem Gradient-Akzent.


12.4 Datei-Liste
Css.file-row {
  border-radius: 14px;
  background: transparent;
}

.file-row:hover {
  background: rgba(255, 255, 255, 0.045);
}

Regeln

Datei-Liste eher ruhig.
Icons dienen als visuelle Orientierung.
Hover nur subtil.
Keine starken Rahmen um jede Zeile.


13. Motion & Interaktion
Fluent 2 führt Motion als eigene Design-Kategorie.
Quelle: Fluent 2 Home / Design Language Navigation.
https://fluent2.microsoft.design/
Empfehlung für Chronell
Chronell soll sich nicht verspielt bewegen, sondern präzise.
Css:root {
  --motion-fast: 120ms;
  --motion-normal: 180ms;
  --motion-slow: 260ms;
  --motion-ease: cubic-bezier(0.16, 1, 0.3, 1);
}

Beispiele
Css.chronell-card {
  transition:
    background-color var(--motion-normal) var(--motion-ease),
    border-color var(--motion-normal) var(--motion-ease),
    transform var(--motion-fast) var(--motion-ease),
    box-shadow var(--motion-normal) var(--motion-ease);
}

Regeln

Hover: minimaler Lift.
Klick: kurze Pressed-Reaktion.
Menüs: weich einblenden.
Dialoge: leicht skalieren + fade.
Keine wilden Slides.
Keine übertriebenen Bounces.


14. Do / Don’t für den Designer
✅ Do

Nutze dunkle, edle Grautöne als Basis.
Nutze Mica als Hintergrundlogik.
Nutze Acrylic nur für temporäre Flächen.
Nutze Smoke nur für modale Zustände.
Arbeite mit Design Tokens statt Einzelwerten.
Chronell-App: Noto Sans (gebündelt). Fluent-Referenz für Microsoft-Oberflächen: Segoe UI Variable / Segoe UI.
Teste Kontrast in Hell/Dunkel/High Contrast.
Halte Akzentfarben sparsam.
Nutze Border + inneres Highlight für Tiefe.
Verwende großzügige Radien.

❌ Don’t

Keine Glassmorphism-Übertreibung.
Keine halbtransparenten Texte.
Keine knalligen Vollflächen.
Keine komplett blauen Panels überall.
Keine 5 verschiedenen Schattenstile.
Keine All-Caps-Labels.
Keine zu niedrigen Kontraste.
Keine Transparenz hinter langen Textlisten.
Kein Acrylic für normale Karten.
Kein visuelles Chaos durch zu viele Glow-Effekte.


15. Design Tokens – Übergabe an Designer/Developer
Fluent 2 unterscheidet zwischen Global Tokens für rohe Werte wie Hexcodes, Typografie, Radius, Stroke Width und Animation sowie Alias Tokens, die semantische Bedeutung hinzufügen.
Quelle: Fluent 2 Design Tokens.
https://fluent2.microsoft.design/design-tokens
Für Chronell sollte das Design-System daher ebenfalls so aufgebaut sein:
Css:root {
  /* Global tokens */
  --global-grey-950: #090A0D;
  --global-grey-900: #101116;
  --global-grey-850: #14151B;
  --global-grey-800: #1C1D23;
  --global-grey-700: #2A2D38;

  --global-blue-400: #6EA8FF;
  --global-indigo-500: #667BFF;
  --global-violet-600: #5A5DE6;

  /* Alias tokens */
  --color-bg-app: var(--global-grey-950);
  --color-bg-shell: var(--global-grey-900);
  --color-bg-sidebar: var(--global-grey-850);
  --color-bg-card: var(--global-grey-800);
  --color-bg-muted: var(--global-grey-700);

  --color-accent-primary: var(--global-blue-400);
  --color-accent-secondary: var(--global-indigo-500);
  --color-accent-orbit: var(--global-violet-600);
}


16. Konkreter Ziel-Look für den aktuellen Chronell-Screenshot
Der aktuelle Screenshot hat bereits:

große dunkle Panels
dezente Transparenz
Hintergrundgrafik
starke Rundungen
moderne Karten
Microsoft-365-Anmutung

Was geschärft werden sollte:
16.1 Panels etwas weniger transparent
Aktuell wirken die Panels teilweise sehr glasig. Für Fluent/Mica sollte es eher subtil durchlässig, aber primär ruhig sein.
Empfehlung:
Cssbackground: rgba(25, 26, 32, 0.90);

statt zu transparenter Fläche.

16.2 Border sichtbarer, aber nicht heller
Cssborder: 1px solid rgba(255, 255, 255, 0.085);

Bei Hover:
Cssborder-color: rgba(110, 168, 255, 0.22);


16.3 Hintergrund abstrakter und dunkler
Der Hintergrund darf sichtbar sein, aber nicht konkurrieren.
Cssbackground-blend-mode: screen;
filter: brightness(0.72) saturate(0.9);


16.4 Aktive Kalenderkarte hochwertiger
Der aktive Kalendereintrag sollte etwas weniger „blau-blockig“ und mehr „Chronell-Orbit“ wirken:
Cssbackground:
  linear-gradient(135deg, rgba(72, 92, 190, 0.96), rgba(52, 63, 145, 0.96));
box-shadow:
  0 18px 42px rgba(72, 92, 190, 0.24),
  inset 0 1px 0 rgba(255, 255, 255, 0.12);


17. Technischer Hinweis für Umsetzung
Wenn Chronell eine native Windows-App wird, soll der Entwickler prüfen, ob echtes Windows-Material wie Mica/Acrylic über den jeweiligen App-Stack verfügbar ist. Microsoft weist darauf hin, dass technische Einschränkungen geprüft werden sollen, bevor man entscheidet, welches Material für ein Erlebnis verwendet wird.
Quelle: Fluent 2 Material.
https://fluent2.microsoft.design/material
Wenn Chronell als Web-App, PWA, Electron- oder Tauri-App umgesetzt wird, kann der Look über CSS simuliert werden:
Cssbackdrop-filter: blur(28px) saturate(135%);
-webkit-backdrop-filter: blur(28px) saturate(135%);

Das ist dann kein echtes Windows-Mica, sondern ein Mica-/Acrylic-inspirierter Look.

18. Kurzfassung für Designer

Chronell soll sich an Microsoft Fluent 2 und Windows 11 orientieren. Die App verwendet eine dunkle, edle, grau dominierte Oberfläche mit Mica-inspiriertem App-Hintergrund. Normale Karten und Panels sind überwiegend solide, leicht transluzente dunkle Oberflächen mit feinem Border und subtiler Tiefe. Acrylic wird nur für temporäre UI wie Popovers, Menüs und Command Palette eingesetzt. Smoke wird nur für modale Dialoge verwendet. Akzentfarben aus dem Chronell-Logo – kühles Blau, Indigo, Violett – werden sparsam für aktive Zustände, Fokus, Auswahl und AI-/Copilot-Elemente eingesetzt. Typografie in der App: Noto Sans (Lesbarkeit, konsistent mit Website-Docs). Die UI muss Light, Dark und High Contrast sauber unterstützen. Ziel ist kein übertriebenes Glassmorphism, sondern ein hochwertiges, ruhiges Microsoft-365-/Windows-11-Produktivitätsgefühl.


19. Kurzfassung für Entwickler
Materiallogik
TxtApp Shell / Root Background  → Mica-inspiriert
Normale Cards / Panels       → Solid + leichte Transparenz + Border
Popovers / Menüs             → Acrylic
Modale Dialoge               → Smoke Overlay + Dialog Surface

Priorität

Lesbarkeit
Hierarchie
Ruhe
Materialtiefe
Markenakzent

Wichtig

Kein Acrylic für Dauerflächen.
Kein Glow-Overkill.
Keine zu transparenten Textflächen.
Design Tokens konsequent verwenden.
Light/Dark/High Contrast von Anfang an mitdenken.


20. Finale Design-Positionierung
Nicht sagen:

„Wir machen Glassmorphism.“

Sondern:

Wir machen Fluent Material Design mit Chronell-DNA.

Der Unterschied ist wichtig:

Glassmorphism ist ein Effekt.
Fluent Material ist ein System.
Chronell braucht ein System.

Chronell soll wirken wie:

Windows 11 + Outlook + Copilot + ein eigenes Zeit-Orbit-System.


Quellen

Fluent 2 Design System – Home: https://fluent2.microsoft.design/
Fluent 2 – Material: https://fluent2.microsoft.design/material
Fluent 2 – Design Tokens: https://fluent2.microsoft.design/design-tokens
Fluent 2 – Typography: https://fluent2.microsoft.design/typography
Fluent 2 – Elevation: https://fluent2.microsoft.design/elevation
Microsoft Learn – Materialien in Windows-Apps: https://learn.microsoft.com/de-de/windows/apps/design/signature-experiences/materials
'''