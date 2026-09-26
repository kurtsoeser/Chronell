# Plan: Teilnehmer aus Notion „Anwesenheiten“ → Webinar

**Status:** Entwurf zur Abstimmung (Stand 2026-09-26)  
**Kontext:** Webinar aus `#kurtrocks Events` ist bereits angebunden (Titel, Datum, Cover, public URL, Forms-/Teams-Writeback). Offen: **Teilnehmer-E-Mails** aus einer zugehörigen Anwesenheiten-Seite/-DB übernehmen.

---

## 1. Zielbild

Beim Flow **„Webinar aus Notion“** (oder danach im Dialog) sollen Teilnehmer-Adressen aus Notion geladen und ins Feld **Erforderliche Teilnehmer** / Einladen-Schritt übernommen werden — ohne manuelles Abtippen.

**Nicht-Ziele (MVP):**
- Anwesenheits-Status (gekommen / abgesagt) synchron halten  
- Bidirektionaler Sync Notion ↔ Graph-Attendees nach dem Speichern  
- HTML-Mail-Body der Anwesenheiten-Seite ersetzen

---

## 2. Ist-Situation (laut bisherigem Stand)

| Baustein | Heute |
|----------|--------|
| Event | Zeile in DB **`#kurtrocks Events`** |
| Anwesenheiten | Manuell: Seite in DB **`Anwesenheiten`**, Teilnehmer oft als **einfache Tabelle** (Notion-Table-Block / „HTML-ähnlich“) |
| Verknüpfung Event ↔ Anwesenheiten | **Noch zu klären** (Relation? Kindseite? Namenskonvention?) |
| Chronell | Kann Event lesen; **kein** Block-/Relation-Read für Anwesenheiten |

---

## 3. Entscheidungsfrage: Tabelle vs. Datenbank

### Option A — Tabelle auf einer Notion-Seite (aktueller Workflow)

**So würde Chronell arbeiten:**
1. Zugehörige Anwesenheiten-Seite finden  
2. Blocks lesen (`table` / `table_row` oder Text)  
3. E-Mails per Heuristik/Regex extrahieren  

| Pro | Contra |
|-----|--------|
| Wenig Umbau in Notion | Fragil (Spalten, Format, Tippfehler) |
| Bleibt „eine Seite“ | Notion speichert kein echtes HTML — Blocks |
| | Keine Validierung „ist E-Mail“ |

**Machbarkeit:** ja, als **Übergang**, wenn Format sehr einheitlich ist.

### Option B — Notion-Datenbank mit Teilnehmer-Properties (**empfohlen**)

Pro Teilnehmer eine Zeile, z. B.:

| Property | Typ | Pflicht |
|----------|-----|---------|
| Name | Title oder Text | neat |
| **E-Mail** | **Email** (oder Text) | **ja** |
| Event | **Relation** → `#kurtrocks Events` | **ja** |
| optional Status | Select | neat |

| Pro | Contra |
|-----|--------|
| Stabil, querybar | Einmaliges Umstellen der bestehenden Seiten |
| Saubere Relation Event → TN | Kurze Notion-Pflege |
| Passt zu Writeback später | |

**Empfehlung für Chronell-MVP: Option B.**  
Option A nur als Fallback / Phase 0, falls die Migration der DB zu teuer wirkt.

---

## 4. Offene Punkte für die Abstimmung morgen

Bitte vor Implementierung klären:

1. **Verknüpfung:** Wie hängt Event und Anwesenheiten zusammen?
   - [ ] Relation-Property am Event (Name: …)
   - [ ] Relation am Anwesenheiten-Eintrag → Event
   - [ ] Unterseite des Events
   - [ ] Nur Namensgleichheit / Konvention  
2. **Datenmodell Anwesenheiten:** Bleibt Tabelle auf Seite oder Umstieg auf DB-Zeilen mit E-Mail-Property?  
3. **Property-Namen** (wenn DB): exakter Name der E-Mail-Spalte, Relation, DB-Titel (`Anwesenheiten`?)  
4. **Welche Adressen:** nur Pflicht-TN, oder Pflicht + Optional?  
5. **Wann laden:** beim Notion-Import-Picker, oder Button „Teilnehmer aus Notion“ im Dialog?  
6. **Duplikate / ungültige Mails:** still überspringen oder Toast?  
7. **Bestehende Events:** einmalig migrieren oder nur neue ab Datum X?

---

## 5. Vorgeschlagenes Ziel-Modell (nach Option B)

```
#kurtrocks Events (1)
        │
        │ Relation „Anwesenheiten“ (1:n)  — oder Reverse von Anwesenheiten
        ▼
Anwesenheiten-DB (n Zeilen)
        • Title / Name
        • E-Mail (Email)
        • optional: Rolle, Status
```

**Import-Mapping → Chronell**

| Notion | Webinar-Dialog |
|--------|----------------|
| E-Mail-Zeilen der verknüpften Anwesenheiten | `attendeeInput` (Erforderlich) |
| (später) | Optional getrennt, wenn Property „Optional“ existiert |

---

## 6. Technische Phasen (Chronell)

### Phase 0 — Klärung (morgen)
- Screenshot/Schema der Anwesenheiten-DB bzw. Seitenstruktur  
- Entscheidung A vs. B  
- Property-/Relationsnamen festhalten  

### Phase 1 — Notion Read (Main)
Nur bei Option B:
- Relation vom Event-Page auflösen **oder** `databases/Anwesenheiten/query` mit Filter `Event = pageId`
- E-Mail-Properties lesen → normalisierte Adressliste  

Bei Option A:
- `blocks.children` der Anwesenheiten-Seite, Table-Rows parsen  

IPC z. B. `notion:listKurtrocksEventAttendees(pageId)` → `{ emails: string[] }`

### Phase 2 — UI
- Im Notion-Webinar-Import oder im Dialog: Teilnehmer übernehmen  
- Prefill `attendeeInput` (bestehende Token-Field-Logik)  
- Toast: „N Teilnehmer aus Notion geladen“  

### Phase 3 — (optional) Writeback
- Nach Graph-Einladung: Status/Anwesenheit nach Notion — **bewusst später**  

### Phase 4 — (optional) Migrationshilfe
- Einmal-Skript oder Doku: alte Tabellen-Seiten → DB-Zeilen  

---

## 7. Abhängigkeiten / Risiken

| Risiko | Mitigation |
|--------|------------|
| Keine Relation → Seite nicht findbar | Phase 0 erzwingen |
| Tabelle ohne klare E-Mail-Spalte | Option B oder feste Spaltenkonvention |
| Notion Integration sieht DB nicht | Freigabe wie bei Events |
| Viele TN (> Graph-Limits) | Bestehende Caps (Graph 500 / Google 200) beachten |
| PII in Logs | Keine E-Mails in Main-Logs |

Bereits vorhanden und wiederverwendbar:
- Notion Auth + Client  
- Kurtrocks-Events-Import + `pageId` im Prefill  
- Attendee-Token-Field im `CalendarEventDialog`  

---

## 8. Erfolgs-Kriterien (MVP)

- [ ] Aus einem Event mit verknüpften Anwesenheiten kommen ≥ 1 gültige E-Mails ins Dialog-Feld  
- [ ] Ungültige Zeilen werden übersprungen, ohne den Import abzubrechen  
- [ ] Ohne Verknüpfung: klare Fehlermeldung, kein Crash  
- [ ] Dokumentierte Property-/DB-Namen in diesem Plan (nach Abstimmung)  

---

## 9. Agenda für morgen (kurz)

1. Entscheidung **Tabelle vs. Anwesenheiten-DB**  
2. **Wie ist die Verknüpfung** heute wirklich? (1× Beispiel-Event zeigen)  
3. Property-Namen festnageln  
4. MVP-Scope: nur Lesen → Prefill, kein Writeback  
5. Danach: Ticket/Implementierung Phase 1–2  

---

## 10. Bezug zu bereits gebauten Features

| Feature | Relevanz |
|---------|----------|
| Webinar aus `#kurtrocks Events` | Einstieg + `notionPageId` |
| Forms-Picker + Writeback `Umfrage-Link` | Parallel-Pattern für Notion-Write |
| Teams-Join → `Meeting Link` | Parallel-Pattern |
| public URL → Veranstaltungsseite | Fertig |

Teilnehmer-Import ist der **nächste logische Read-Schritt** derselben Notion-Kette.
