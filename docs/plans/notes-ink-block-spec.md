# Notizen — Freihandzeichnung (Variante A: Ink als Block)

Stand: Juli 2026. Umsetzungs-Spezifikation für Phase 5A der [OneNote-Roadmap](./notes-onenote-roadmap.md).

**Ziel:** Handschriftliche Notizen und Skizzen in Chronell-Notizen — im Stil eines eingebetteten Zeichenblocks, **ohne** das HTML-Seitenmodell zu ersetzen.

**Nicht-Ziel:** Freier Canvas über die ganze Seite, freies Positionieren von Textboxen, Handschrift-OCR.

---

## Produktverhalten (MVP)

1. Nutzer klickt in der Notizen-Aktionszeile **„Freihand zeichnen“** (Icon: Stift).
2. Ein **Vollbild-Dialog** öffnet sich mit einer weißen Zeichenfläche.
3. Werkzeuge: **Stift**, **Radierer**, **Rückgängig**, **Wiederholen**, **Alles löschen**, Farbe, Strichstärke.
4. **„Einfügen“** schließt den Dialog und:
   - fügt ein **Vorschaubild (PNG)** inline in den TipTap-Editor ein (wie Screenshot/Bild),
   - legt **zwei Anhänge** an der Notiz ab (siehe Speicherformat).
5. **„Abbrechen“** verwirft ungespeicherte Striche.

Optional in MVP (wenn Aufwand < 1 Tag): Doppelklick auf ein eingefügtes Ink-Bild → Dialog mit gespeicherten Strichen öffnen (Re-Edit). Architektur von Anfang an vorbereiten (`data-chronell-ink-source`).

---

## Architekturentscheidungen

| Entscheidung | Wahl | Begründung |
|--------------|------|------------|
| Dokumentmodell | **Unverändert** (`user_notes.body` = HTML) | Passt zu FTS, PDF, Wiki-Links, Mail-Stack |
| DB / IPC | **Keine Änderung** | Bestehendes `notes.attachments.addLocal` |
| Zeichen-Engine | **`perfect-freehand`** + SVG-Rendering | ~3 KB gzip, gute Strichqualität, Stift-Druck über `pressure` |
| Nicht Excalidraw/tldraw | — | Zu schwer (+1–2 MB), Diagramm-Fokus, Overkill für Ink-only |
| Inline-Darstellung | **PNG Base64** in `<img>` | Gleiches Muster wie Screen Clip + `ComposeImage` (Resize) |
| Quelldaten | **JSON-Anhang** (`*.ink.json`) | Bearbeitbar, versionierbar, klein; SVG nur als Export-Option später |
| Raster-Anhang | **PNG** (`*.png`) | Backup, Cloud-Sync, Anhänge-Panel |
| Erkennbarkeit im HTML | `data-chronell-ink-source="{attachmentId}"` | Verknüpfung Bild ↔ JSON ohne Schema-Migration |

---

## Speicherformat

### JSON-Quelldatei (`application/vnd.chronell.note-ink+json`)

Pfad: `userData/note-attachments/{noteId}/{attachmentId}.ink.json`  
Dateiname in UI: `Freihand yyyy-MM-dd HH-mm.ink.json`

```typescript
/** @shared — src/shared/note-ink-document.ts */
export const NOTE_INK_DOCUMENT_VERSION = 1 as const

export type NoteInkTool = 'pen' | 'eraser'

export interface NoteInkPoint {
  x: number
  y: number
  /** 0..1, default 0.5 wenn nicht unterstützt */
  pressure: number
}

export interface NoteInkStroke {
  id: string
  tool: NoteInkTool
  color: string // '#rrggbb'
  size: number // logische Pixel auf Canvas (z. B. 2–24)
  points: NoteInkPoint[]
}

export interface NoteInkDocument {
  version: typeof NOTE_INK_DOCUMENT_VERSION
  /** Logische Canvas-Größe beim Zeichnen (devicePixelRatio-normalisiert) */
  canvasWidth: number
  canvasHeight: number
  strokes: NoteInkStroke[]
  createdAt: string // ISO
}
```

### HTML nach Einfügen

```html
<p>
  <img
    src="data:image/png;base64,..."
    alt="Freihandzeichnung"
    class="mail-compose-image note-ink-snapshot"
    data-chronell-ink-source="42"
  />
</p>
```

- `data-chronell-ink-source` = **Attachment-ID des `.ink.json`**-Anhangs.
- `class="note-ink-snapshot"` für spätere Selektoren (Re-Edit, Styling).
- PNG-Anhang separat (ohne data-Attribut nötig); optional gleicher Zeitstempel im Dateinamen.

### Anhang-Reihenfolge beim Einfügen

1. `Freihand 2026-07-02 14-30.ink.json` — Quelldaten  
2. `Freihand 2026-07-02 14-30.png` — Raster für Archiv/Panel  

Inline-Bild nutzt **dieselbe PNG** als Base64 (nicht zweites Encoding generieren — ein `canvas.toBlob` / Export-Pipeline).

---

## Rendering-Pipeline

```
PointerEvents auf Canvas
        ↓
NoteInkStroke[] (React state + Undo-Stack)
        ↓
perfect-freehand getStroke() pro Strich
        ↓
SVG <path> (Live-Vorschau im Dialog)
        ↓
Bei „Einfügen“:
  ├─ JSON serialisieren → attachments.addLocal (.ink.json)
  ├─ SVG/Canvas → PNG blob → attachments.addLocal (.png)
  └─ PNG data URL → buildNoteInkInsertHtml() → insertHtmlRef
```

**Export-Helfer** (rein, testbar): `src/renderer/src/lib/note-ink-export.ts`

- `strokesToSvgPaths(strokes): string` — SVG path `d`-Attribute  
- `strokesToPngDataUrl(strokes, width, height): Promise<string>` — OffscreenCanvas oder temporäres `<canvas>`  
- `buildNoteInkInsertHtml(pngDataUrl, inkJsonAttachmentId): string`  
- `parseNoteInkDocument(json: string): NoteInkDocument` — Validierung + Version-Check  

**Shared-Typen:** `src/shared/note-ink-document.ts` (für Tests + ggf. spätere Main-Validierung).

---

## UI-Komponenten

### Neue Dateien

| Datei | Verantwortung |
|-------|----------------|
| `src/shared/note-ink-document.ts` | Typen + Version-Konstante |
| `src/renderer/src/lib/note-ink-export.ts` | Serialisierung, PNG/SVG-Export, HTML-Builder |
| `src/renderer/src/lib/note-ink-insert.ts` | Orchestrierung: Anhänge speichern + HTML einfügen (Analog `note-screen-clip.ts`) |
| `src/renderer/src/app/notes/NoteInkDrawDialog.tsx` | Vollbild-Modal, Toolbar, Canvas |
| `src/renderer/src/app/notes/use-note-ink-canvas.ts` | Pointer-Handling, Strokes, Undo/Redo, Radierer-Logik |
| `src/renderer/src/app/notes/note-ink-canvas.css` | Cursor, Touch-Action, Papier-Hintergrund |

### `NoteInkDrawDialog`

- Basiert auf `ModalRoot` / `ModalPanel` (wie `NoteMeetingInsertDialog`).
- Layout:
  - **Header:** Titel + Schließen (X)
  - **Toolbar:** Werkzeuge, Farbpalette (6 Farben), Strichstärke-Slider, Undo/Redo/Clear
  - **Canvas-Bereich:** flex-1, Papier-Hintergrund (`bg-white` / im Dark-Mode leichtes Grau `#f8f9fa` — Zeichenfläche bewusst hell)
  - **Footer:** Abbrechen | Einfügen (primary, disabled wenn keine Striche)

**Pointer-Verhalten:**

- `touch-action: none` auf Canvas (kein Scroll-Wackeln).
- `setPointerCapture` während Strich.
- Druck: `event.pressure` (Fallback `0.5`).
- Radierer: Striche entfernen, deren Bounding-Box den Pointer berührt (stroke-level, kein Pixel-Radierer in MVP).

**Undo-Stack:** Kopie des `strokes`-Arrays; max. 50 Einträge.

### Integration in Editor

**Phase-1-Scope (Hauptnotizen):**

| Datei | Änderung |
|-------|----------|
| `NotesShellEditorPane.tsx` | Button „Freihand zeichnen“ in `actionBarStart` |
| `NotesShell.tsx` | State `inkDrawOpen`, Handler `handleOpenInkDraw` / `handleInkInsert` |
| `NotesShell.tsx` | `<NoteInkDrawDialog>` rendern wenn `editing && inkDrawOpen` |

**Phase-1b (gleiche Session oder direkt danach):**

| Datei | Änderung |
|-------|----------|
| `ObjectNoteEditor.tsx` | Optional: kompakten Ink-Button in Aktionszeile (Kontext-Notizen) |
| `QuickCapturePopoutShell.tsx` | Ink-Button nur wenn `insertHtmlRef` / Anhänge-Pattern ergänzt wird |

Empfehlung: **zuerst nur `NotesShell`** — gleiches Muster wie Meeting-Insert + Screen-Clip.

---

## Ablauf „Einfügen“ (Orchestrierung)

`appendInkDrawingToNote(noteId, document, pngBlob, insertHtml)` in `note-ink-insert.ts`:

```typescript
// Pseudocode — 1:1 analog appendScreenClipToNote
const stamp = format(new Date(), 'yyyy-MM-dd HH-mm')
const baseName = t('notes.ink.defaultName') + ` ${stamp}`

const inkJson = JSON.stringify(document)
const inkAttachment = await notes.attachments.addLocal({
  noteId,
  name: `${baseName}.ink.json`,
  contentType: 'application/vnd.chronell.note-ink+json',
  dataBase64: utf8ToBase64(inkJson),
  size: byteLength(inkJson)
})

await notes.attachments.addLocal({
  noteId,
  name: `${baseName}.png`,
  contentType: 'image/png',
  dataBase64: await blobToBase64(pngBlob),
  size: pngBlob.size
})

const dataUrl = await blobToDataUrl(pngBlob)
insertHtml(buildNoteInkInsertHtml(dataUrl, inkAttachment.id))
```

Kein neuer IPC-Channel nötig.

---

## Re-Edit (v1.1 — Architektur vorbereiten)

1. Doppelklick auf `img[data-chronell-ink-source]` im TipTap-Editor (Event in `TipTapBody` oder `ComposeImage`-Erweiterung).
2. `notes.attachments.readLocal` / bestehenden Download-Pfad für lokalen Anhang nutzen.
3. JSON parsen → `NoteInkDrawDialog` mit `initialDocument` öffnen.
4. Bei erneutem Einfügen: **bestehendes** Ink-JSON + PNG ersetzen (gleiche Attachment-IDs per `update` — falls nicht vorhanden: alte Anhänge löschen + neue anlegen + img im HTML aktualisieren).

Falls `attachments.update` nicht existiert: MVP löst Re-Edit durch **neues Einfügen** + manuelles Löschen alter Blöcke — dokumentieren, Update-API optional nachziehen.

---

## i18n

Neuer Block `notes.ink` in `de.json` / `en.json`:

| Key | DE | EN |
|-----|----|----|
| `button` | Freihand zeichnen | Draw ink |
| `title` | Freihandzeichnung | Ink drawing |
| `insert` | Einfügen | Insert |
| `cancel` | Abbrechen | Cancel |
| `clear` | Alles löschen | Clear all |
| `undo` | Rückgängig | Undo |
| `redo` | Wiederholen | Redo |
| `tool.pen` | Stift | Pen |
| `tool.eraser` | Radierer | Eraser |
| `strokeSize` | Strichstärke | Stroke size |
| `defaultName` | Freihand | Ink |
| `emptyInsert` | Noch nichts gezeichnet. | Nothing drawn yet. |
| `insertedToast` | Freihandzeichnung eingefügt. | Ink drawing inserted. |

Kein Tastenkürzel in MVP (optional später: Strg+Shift+Alt+D).

---

## Abhängigkeit

```bash
npm install perfect-freehand
```

Keine weiteren Zeichen-Bibliotheken. Bundle-Impact: gering.

---

## Auswirkungen auf bestehende Systeme

| Bereich | Auswirkung |
|---------|------------|
| Volltextsuche | Ink-Inhalt **nicht** durchsuchbar (wie Bilder) — akzeptabel |
| PDF-Export / Druck | Funktioniert via inline PNG (`article img` in Print-CSS) |
| Supabase-Backup | Anhänge syncen wie andere Dateien |
| Sanitisierung | Nur `<img>` mit bekannten Attributen — DOMPurify-Konfiguration prüfen, ob `data-chronell-ink-source` erlaubt ist |
| `ComposeImage` | Resize weiter nutzbar; data-Attribut beim Resize erhalten |
| Mobile / Touch | Pointer-Events; auf Windows-Surface testen |

**Sanitisierung:** In `sanitize-compose-html` / `sanitizeMailHtml` das Attribut `data-chronell-ink-source` auf `img` whitelisten.

---

## Tests

| Datei | Inhalt |
|-------|--------|
| `src/renderer/src/lib/note-ink-export.test.ts` | `buildNoteInkInsertHtml`, `parseNoteInkDocument`, SVG-Path-Generierung, leeres Dokument |
| `src/shared/note-ink-document.test.ts` | Version-Konstante, Typ-Guards |

Kein E2E in MVP — manueller Testplan:

1. Striche zeichnen, einfügen, Seite speichern, neu laden → Bild sichtbar.  
2. PDF-Export → Zeichnung enthalten.  
3. Anhänge-Panel → `.ink.json` + `.png` vorhanden.  
4. Undo/Redo/Radierer im Dialog.  
5. Dark-Mode Editor + helle Zeichenfläche.  
6. Stift mit Maus + optional Surface-Stift (Druck).

---

## Implementierungsreihenfolge

Geschätzter Gesamtaufwand: **~2–3 Wochen** (1 Entwickler, inkl. Tests + i18n).

### Sprint 1 — Kern (ca. 1 Woche)

- [x] **5A.1** `perfect-freehand` installieren  
- [x] **5A.2** `src/shared/note-ink-document.ts`  
- [x] **5A.3** `note-ink-export.ts` + Unit-Tests  
- [x] **5A.4** `use-note-ink-canvas.ts` (Pointer, Strokes, Undo)  
- [x] **5A.5** `NoteInkDrawDialog.tsx` (UI ohne Einfügen in Notiz)  

### Sprint 2 — Integration (ca. 1 Woche)

- [x] **5A.6** `note-ink-insert.ts` (Anhänge + HTML)  
- [x] **5A.7** `NotesShellEditorPane` + `NotesShell` verdrahten  
- [x] **5A.8** i18n DE/EN  
- [x] **5A.9** Sanitisierung: `data-chronell-ink-source` erlauben (+ TipTap `ComposeImage`)  
- [ ] **5A.10** Manueller QA-Lauf  

### Sprint 3 — Nachziehen (optional, ca. 3–5 Tage)

- [x] **5A.11** Re-Edit per Doppelklick  
- [x] **5A.12** `ObjectNoteEditor` + Quick Capture  
- [x] **5A.13** Highlighter-Werkzeug (`tool: 'highlighter'`, halbtransparent)  

---

## Bewusst nicht in MVP

- Voll-Canvas-Seite (`body_format: 'canvas'`)  
- Handschrift → Text (OCR)  
- Freies Verschieben des Blocks auf der Seite (TipTap-Flow reicht)  
- Sync mit OneNote  
- Pixel-Radierer, Mehrfinger-Gesten, unendlicher Canvas / Pan  
- Eigener IPC-Endpoint  

---

## Referenzen im Code (Bestehende Muster)

| Muster | Datei |
|--------|-------|
| Bild inline + Anhang | `src/renderer/src/lib/note-screen-clip.ts` |
| HTML einfügen | `insertHtmlRef` in `TipTapBody.tsx` |
| Aktionszeile-Button | `NotesShellEditorPane.tsx` (Meeting, Screenshot) |
| Modal-Dialog | `NoteMeetingInsertDialog.tsx` |
| Anhang speichern | `window.mailClient.notes.attachments.addLocal` |
| Bild im Editor | `ComposeImage` in `tiptap-compose-image.ts` |

---

## Roadmap-Update

Nach Umsetzung von 5A.6+ in [notes-onenote-roadmap.md](./notes-onenote-roadmap.md):

- Phase 5A als **in Arbeit / erledigt** markieren  
- Phase 5B (Canvas-Seite) weiter als **zurückgestellt** belassen  
