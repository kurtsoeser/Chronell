# Notizen — Roadmap in Richtung OneNote

Stand: Juli 2026. Ausgangslage nach Umstellung auf **TipTap (WYSIWYG)** und **Editor Hell/Dunkel** (wie Mail-Verfassen).

Ziel dieses Dokuments: realistisch einordnen, was von OneNote für Chronell sinnvoll ist, was bereits da ist, und in welcher Reihenfolge man es angehen sollte — **ohne** Chronell in eine reine Notiz-App umzubauen.

---

## Was Chronell heute schon „notebook-artig“ hat

| OneNote-Konzept | Chronell heute | Reife |
|-----------------|----------------|-------|
| Notizbuch | *(implizit: eine lokale Sammlung)* | Basis |
| Abschnitt | `note_sections` (Baum mit `parent_id`, Icon, Farbe) | **Gut** |
| Seite | `user_notes` (frei, an Mail/Kalender/Kontakt) | **Gut** |
| Seitenliste | `NotesPagesPane`, Sortierung, DnD, Umbenennen | **Gut** |
| Rich Text | TipTap (Formatierung, Listen, Überschriften, Tabellen, Bilder, Links) | **Neu / gut** |
| Anhänge | Lokal + OneDrive/SharePoint | **Gut** |
| Verknüpfungen | Entity-Links (Mail, Termin, Task, Kontakt, andere Notiz) + Modul Verbindungen | **Stark** (Differenzierung) |
| Kalender-Bezug | `scheduledStart/End` + Kalenderansicht der Notizen | **Gut** |
| Suche | Volltext in Notizen-Shell | **Gut** |
| Kontext-Notizen | `ObjectNoteEditor` an Mail, Termin, Kontakt | **Gut** |

**Fazit:** Die **Organisations-Schale** (Abschnitte, Seiten, Links, Anhänge) ist schon näher an OneNote als der reine Editor jemals war. Der größte Hebel liegt jetzt bei **Feinschliff im Editor**, **Metadaten (Tags)** und **Erfassungs-Workflows** — nicht sofort bei einem freien Canvas.

---

## OneNote-Features — Einordnung

### A) Gut auf bestehendem Stack aufbaubar (TipTap + SQLite + IPC)

| Feature | Nutzen | Aufwand | Anmerkung |
|---------|--------|---------|-----------|
| **Checklisten / To-dos in der Seite** | Hoch (Meeting-Notizen, Aufgabenlisten) | **Niedrig** | TipTap `@tiptap/extension-task-list` + `-task-item`; Toolbar-Button |
| **Vorlagen für neue Seiten** | Hoch | **Niedrig–mittel** | `note_templates` oder JSON in Settings; „Neue Seite aus Vorlage“ |
| **Tags / Labels** | Sehr hoch (Filtern, Überblick) | **Mittel** | Neue Tabelle `note_tags` / `note_tag_assignments`; Filter in Sidebar |
| **Unterseiten (Seiten-Hierarchie)** | Hoch (Projektstruktur) | **Mittel** | `parent_note_id` analog zu `note_sections.parent_id`; Baum in PagesPane |
| **Eingeklappte Überschriften / Outline** | Mittel | **Mittel** | TipTap-Extension oder Post-Processing von `h1–h3` |
| **„In Notiz senden“ aus Mail/Kalender** | Sehr hoch (Workflow) | **Mittel** | Auswahl → neue Seite oder an bestehende anhängen; nutzt Links + HTML-Snippet |
| **Screenshots / Clippings** | Hoch | **Mittel** | Electron `desktopCapturer` oder Zwischenablage → Bild in TipTap (Daten-URL oder Anhang) |
| **Audio-Notiz** | Mittel | **Mittel** | Aufnahme im Main → Anhang `audio/webm`; optional Transkript später (KI) |
| **Favoriten / angeheftete Seiten** | Mittel | **Niedrig** | `pinned` Flag oder Dashboard-Kachel erweitern |
| **Interne Wiki-Links `[[Seite]]`** | Mittel | **Mittel** | TipTap-Link-Extension + Autocomplete über `notes.search` |
| **Druck / PDF-Export einer Seite** | Mittel | **Mittel** | `printToPDF` oder HTML → PDF im Main |

### B) Machbar, aber deutlich schwerer oder UX-riskant

| Feature | Nutzen | Aufwand | Risiko |
|---------|--------|---------|--------|
| **Freihand / Zeichnen (Ink)** | Tablet-Stift-Nutzer | **Hoch** | Excalidraw/tldraw einbetten **oder** Canvas-Layer; Sync, Export, Mobile |
| **Freies Positionieren (Canvas)** | „Echte“ OneNote-Feeling | **Sehr hoch** | Anderer Dokumenttyp; kollidiert mit durchsuchbarem HTML-Flow |
| **Handschrift → Text** | Nische | **Sehr hoch** | OS-API oder Cloud-OCR |
| **Mehrere Spalten auf einer Seite** | Layout | **Mittel–hoch** | CSS Columns in TipTap oder blockbasiert |

### C) Bewusst zurückstellen oder nur teilweise nachbauen

| Feature | Empfehlung |
|---------|------------|
| **Vollständiger unendlicher Canvas** | Nicht als Ersatz für Seiten-Body; höchstens optionaler „Whiteboard“-Modus pro Seite |
| **OneNote-Sync mit Microsoft** | Außerhalb Scope (eigene lokale Notizen + Cloud-Backup reichen) |
| **Versionsverlauf pro Seite** | Später; Backup/Cloud-Sync deckt Teile ab |
| **Gemeinsames Bearbeiten** | Nicht prioritär |

---

## Strategische Leitlinie

1. **Workflow-first:** Chronell ist Mail/Kalender/Tasks-Client — Notizen sollen **Kontext** halten und **Verbindungen** sichtbar machen, nicht OneNote ersetzen.
2. **Ein Dokumentmodell pro Seite:** Weiter **HTML in `user_notes.body`** (durchsuchbar, exportierbar, gleicher Stack wie Mail). Kein zweites Format parallel, außer für explizite Spezialblöcke (z. B. Zeichnung als SVG/PNG-Anhang).
3. **Metadaten statt Canvas:** Tags, Hierarchie, Planung im Kalender und Entity-Links geben 80 % des Nutzens von „Ordnung“ ohne freies Layout.
4. **Ink/Canvas nur als Zusatzblock:** Wenn überhaupt, dann **eingebetteter Zeichenblock** (Bild/SVG) auf der Seite, nicht die ganze Seite als Canvas.

---

## Phasenplan (empfohlene Reihenfolge)

### Phase 0 — Abschluss Basis (erledigt / kurz nachziehen)

- [x] WYSIWYG (TipTap) im Notizen-Modul und Kontext-Editoren
- [x] Editor Hell/Dunkel (geteilt mit Mail)
- [x] **Aufräumen:** Markdown-Editor entfernen, veraltete Notizen-Einstellungen (`defaultEditorPreviewMode`) streichen
- [x] **Doku:** `FUNKTIONSPROTOKOLL.md` / README auf TipTap aktualisieren

### Phase 1 — Editor-Comfort (erledigt)

| # | Feature | Status |
|---|---------|--------|
| 1.1 | **Checklisten** | ✅ TipTap TaskList in Notizen-Editor |
| 1.2 | **Schnellvorlagen** | ✅ Meeting, Projekt, Wochenplan, Checkliste, Leer |
| 1.3 | **Bild aus Zwischenablage** | (bereits TipTap — manuell testen) |
| 1.4 | **Interne Links** | ✅ `[[` Autocomplete + Klick-Navigation |

---

### Phase 2 — Organisation & Wiederfinden (erledigt)

Ziel: Notizbuch-Struktur vertiefen.

| # | Feature | Status |
|---|---------|--------|
| 2.1 | **Tags** | ✅ Outlook-Masterkategorien (`user_note_category_tags`) |
| 2.2 | **Unterseiten** | ✅ `parent_note_id`, Baum, Breadcrumb |
| 2.3 | **Angepinnte / zuletzt** | ✅ `is_pinned`, Sidebar „Angepinnt“ |
| 2.4 | **Verbesserte Suche** | ✅ FTS + `categoriesAny`-Filter |

**Dauer:** ~2–3 Wochen  
**Abhängigkeit:** Tags und Unterseiten können parallel entwickelt werden

---

### Phase 3 — Erfassung aus dem Workflow (Chronell-Stärke)

Ziel: Notizen dort entstehen lassen, wo man ohnehin arbeitet.

| # | Feature | Status | Umsetzung |
|---|---------|--------|-----------|
| 3.1 | **Aus Mail in Notiz** | ✅ | Kontextmenü: Auswahl oder ganze Mail → neue Seite / an Seite anhängen; Entity-Link automatisch |
| 3.2a | **Besprechungsdetails** | ✅ | Dialog: Konto → Tag → Termin → HTML-Block (Betreff, Zeit, Ort, Teilnehmer, Teams-Link, Agenda/Notizen-Platzhalter) in Editor; optional Entity-Link + geplante Zeit |
| 3.2b | **Einfacher Termin-Link** | Teilweise | Entity-Link-Picker (`calendar_event`) — ergänzt durch 3.2a |
| 3.3 | **Screen Clip** | ✅ | Button im Editor + Strg+Shift+Alt+S: Bild aus Zwischenablage → aktive Seite oder neue Seite |
| 3.4 | **Quick Capture** | ✅ | Topbar „Schnellnotiz“ + Strg+Shift+Alt+N: kleines Fenster → standalone note |

**Technik 3.2a:** `NoteMeetingInsertDialog` · `buildNoteMeetingInsertHtml` (shared) · `insertHtmlRef` in `TipTapBody` · `notes.links.add` für `calendar_event`.

**Dauer:** ~2–4 Wochen (3.2a erledigt; Rest offen)  
**Hinweis:** Hoher perceived value, mittlerer Electron-Aufwand

---

### Phase 4 — Rich Media ✅

| # | Feature | Umsetzung |
|---|---------|-----------|
| 4.1 ✅ | **Audio-Aufnahme** | `NoteAudioRecorder` → `notes.attachments.addLocal`; `NoteAttachmentAudioPlayer` in `NotesAttachmentsPanel` |
| 4.2 ✅ | **Datei-Drop-Zone** | `NoteEditorDropZone` + `use-note-file-drop` am Editor; Bilder inline per `insertHtmlRef` |
| 4.3 ✅ | **PDF-Export / Druck** | `buildNotePagePrintHtml` + `notes.exportPdf` / `notes.printPage` (Electron `printToPDF`) |

**Dauer:** ~2 Wochen

---

### Phase 5 — Zeichnen / Whiteboard (optional, nur bei Bedarf)

Zwei Wege — **nicht** beide gleichzeitig starten:

**Variante A — „Ink als Block“ (empfohlen)**  
- Kleiner Zeichenmodus: Excalidraw/tldraw in Dialog oder eingeklappter Block  
- Ergebnis: PNG/SVG als Anhang + optional Vorschaubild im Body  
- Aufwand: ~2–3 Wochen  
- Passt zum bestehenden Seitenmodell  

**Variante B — „Canvas-Seite“**  
- Neuer `body_format: 'canvas'` + JSON-Layout (x, y, w, h pro Block)  
- Eigener Editor, eigene Suche, eigene Mobile-Story  
- Aufwand: **Monate**  
- Nur sinnvoll, wenn Canvas zur Kernanforderung wird  

**Empfehlung:** Variante A oder ganz zurückstellen.

---

## Technische Stützpunkte (bereits vorhanden)

```
NotesShell / ObjectNoteEditor / TipTapNoteEditor
        ↓
   TipTapBody (inEditorSurface, Toolbar, HTML)
        ↓
   user_notes.body (HTML)  +  note_sections  +  user_note_entity_links
        ↓
   register-notes-ipc.ts / user-notes-repo.ts
        ↓
   Supabase-Backup (Notizen + Anhänge-Bucket)
```

Neue Features sollten möglichst **im Repo + IPC + preload** andocken — gleiches Muster wie Tags oder `parent_note_id`.

---

## Prioritäten-Matrix (Kurzfassung)

| Prio | Was | Warum |
|------|-----|-------|
| **P0** | Phase 0 abschließen | Saubere Basis |
| **P1** | Checklisten + Vorlagen | OneNote-Feeling, wenig Risiko |
| **P1** | Tags | Wiederfinden ohne Ordner-Chaos |
| **P2** | Unterseiten | Struktur wie „Seiten unter Seiten“ |
| **P2** | Mail/Termin → Notiz | Chronell-Differenzierung |
| **P3** | Screen Clip + Audio | Nice-to-have, klar abgrenzbar |
| **P4** | Ink / Canvas | Nur bei explizitem Wunsch & Use Case |

---

## Nächster konkreter Schritt

**Phase 3 — Erfassung aus dem Workflow** (3.2a Besprechungsdetails ✅; als Nächstes: Mail → Notiz, Screen Clip, Quick Capture).

Produktentscheidungen (Juli 2026):
- **Ein Notizbuch** — Sektionen/Untersektionen reichen; kein separates `notebooks`-Modell.
- **Tags = Outlook-Kategorien** — global, gleiche Masterliste wie Mail/Kalender/Tasks.
- **Canvas** — später (optional Ink-Block).
- **Export** — später; Ziel: möglichst OneNote-kompatibles Format.

---

## Phase 2 — Organisation & Wiederfinden (erledigt)

| # | Feature | Status |
|---|---------|--------|
| 2.1 | **Tags (Outlook-Kategorien)** | ✅ `user_note_category_tags`, Picker, Sidebar-Filter |
| 2.2 | **Unterseiten** | ✅ `parent_note_id`, Baum in Seitenliste, Breadcrumb |
| 2.3 | **Angepinnt** | ✅ `is_pinned`, Nav „Angepinnt“, Sortierung |
| 2.4 | **Verbesserte Suche** | ✅ Kategorie-Filter in `notes.search` |

---

## Offene Produktfragen (vor Phase 5 klären)

1. **Ein Notizbuch oder viele?** Heute implizit eins — reicht das, oder braucht es `notebooks` oberhalb von Sections?
2. **Tags global oder pro Abschnitt?** Empfehlung: global mit Farben.
3. **Canvas:** wirklich nötig, oder reichen Bilder + Anhänge + Checklisten?
4. **Sync:** Nur Chronell-Cloud-Backup oder später Export nach OneNote/HTML?

Diese Antworten können die Roadmap nach Phase 2 schärfen.
