# Notizen — Medien-Einbettungen (Embed-Roadmap)

Stand: Juli 2026. Ergänzung zur [OneNote-Roadmap](./notes-onenote-roadmap.md).

**Ziel:** In Notizen per **Link einfügen** (Paste) interaktive Inhalte einbetten — ähnlich wie in Notion oder OneNote, ohne das HTML-Seitenmodell zu verlassen.

**Nicht-Ziel:** Generischer HTML-/Script-Embed, oEmbed-Proxy-Server, freies iframe-HTML durch den Nutzer.

---

## Ist-Stand (erledigt)

| Provider | Paste → Embed | Electron-Subframe | Tests |
|----------|---------------|---------------------|-------|
| YouTube | ✅ | ✅ (+ Referer-Fix) | ✅ |
| Microsoft Forms | ✅ | ✅ | ✅ |
| GeoGebra | ✅ | ✅ | ✅ |
| Google Maps | ✅ | ✅ | ✅ |
| Typeform | ✅ | ✅ | ✅ |
| X (Twitter) | ✅ | ✅ | ✅ |
| Teams-Aufzeichnung (Basis) | ✅ | ✅ | ✅ |
| Spotify | ✅ | ✅ | ✅ |
| Vimeo | ✅ | ✅ | ✅ |
| SoundCloud | ✅ | ✅ | ✅ |
| TikTok | ✅ | ✅ | ✅ |
| Desmos | ✅ | ✅ | ✅ |
| CodePen | ✅ | ✅ | ✅ |
| GitHub Gist | ✅ | ✅ | ✅ |
| Loom | ✅ | ✅ | ✅ |
| Figma | ✅ | ✅ | ✅ |
| Miro | ✅ | ✅ | ✅ |
| OpenStreetMap | ✅ | ✅ | ✅ |
| Calendly | ✅ | ✅ | ✅ |

**Technik heute:**

- TipTap-Blöcke (atomare `div` + `iframe`) im Notizen-Editor (`enableTaskList`)
- Zentrale Registry: `src/shared/note-embed-registry.ts`
- Erkennung / Allowlist: `isEmbeddableNoteUrl()`, `isAllowedNoteEmbedIframeSrc()` aus Registry
- TipTap: `NOTE_EMBED_TIPTAP_EXTENSIONS` in `note-embed-tiptap-extensions.ts`

**Bekannte Grenzen:**

- Kurzlinks (`maps.app.goo.gl`, `youtu.be` funktioniert; goo.gl Maps nicht)
- Teams/Stream: oft **M365-Login** nötig — ohne Session leerer Player
- YouTube Fehler 153: behoben via `origin` + `Referer: https://chronell.app/`

---

## Architektur-Leitlinien

1. **Ein Dokumentmodell:** Weiter HTML in `user_notes.body`. Embeds sind `<div data-…><iframe></div>`.
2. **Sicherheit first:** Kein beliebiges iframe — nur explizit allowlistete Hosts + Pfade.
3. **Paste-first:** Primärer Workflow = Link aus Zwischenablage einfügen. Toolbar-Button optional später.
4. **Provider-Modul pro Dienst:** `parse*`, `build*EmbedUrl`, `isAllowed*EmbedSrc`, Konstanten für `data-*`-Attr.
5. **Schrittweise vereinheitlichen:** Neue Provider über die iframe-Factory; ältere (YouTube, Forms, GeoGebra) bei Gelegenheit migrieren, nicht blockierend.

### Zielarchitektur (mittelfristig)

```
src/shared/
  note-embed-registry.ts      # alle Provider registriert
  note-embed-constants.ts     # NOTE_EMBED_HTTP_ORIGIN
  note-embed-frame.ts         # Re-Export Allowlist (Main-Prozess)
  note-{provider}-embed.ts    # je Dienst

src/renderer/
  tiptap-note-iframe-embed-factory.ts
  note-embed-tiptap-extensions.ts
```

Optional später: **ein** TipTap-Node `noteMediaEmbed` mit `data-note-embed-provider` statt je ein Node pro Dienst — weniger Extensions, einheitlicheres CSS. Migration alter gespeicherter HTML-Blöcke per `parseHTML` abwärtskompatibel.

---

## Phasenplan (empfohlene Reihenfolge)

Wir gehen **strikt eine Phase nach der anderen** an. Jede Phase = implementierbar + testbar + in der App nutzbar, bevor die nächste startet.

---

### Phase E0 — Technische Basis festziehen (klein, ~0,5 Tag) ✅

**Warum zuerst:** Reduziert Copy-Paste bei allen folgenden Providern.

| Task | Beschreibung | Status |
|------|--------------|--------|
| E0.1 | `note-embed-registry.ts`: zentrale Liste aller Provider mit `id`, `parseInput`, `isAllowedSrc`, `dataAttr` | ✅ |
| E0.2 | `isEmbeddableNoteUrl` / Sanitizer / `note-embed-frame` aus Registry speisen | ✅ |
| E0.3 | Kurz-Doku in diesem Dokument pflegen nach jeder Phase | ✅ |
| E0.4 | YouTube/GeoGebra auf iframe-Factory migriert; MS Forms bleibt Sonderfall (2 Attribute) | ✅ |

**Erfolgskriterium:** Neuer Provider = 1 Shared-Datei + 1 Registry-Eintrag + CSP + CSS (+ ggf. eigene TipTap-Extension).

**Neue Dateien:** `note-embed-registry.ts`, `note-embed-constants.ts`, `note-embed-tiptap-extensions.ts`

---

### Phase E1 — Audio & Video ohne Login (niedrig, ~1–2 Tage) ✅

Hoher Alltagsnutzen, gleiches Muster wie YouTube.

| Provider | Beispiel-URL | Embed | Status |
|----------|--------------|-------|--------|
| **Spotify** | `open.spotify.com/track/…` | `open.spotify.com/embed/…` | ✅ |
| **Vimeo** | `vimeo.com/123456789` | `player.vimeo.com/video/…` | ✅ |
| **SoundCloud** | `soundcloud.com/artist/track` | `w.soundcloud.com/player/?url=…` | ✅ |
| **TikTok** | `tiktok.com/@user/video/…` | `tiktok.com/embed/v2/…` | ✅ |

**Erfolgskriterium:** Link einfügen → Player sichtbar und abspielbar (öffentliche Inhalte).

---

### Phase E2 — Microsoft Stream & SharePoint richtig (hoch, ~1–2 Wochen)

**Warum eigene Phase:** Größter Mehrwert für Chronell (Mail + M365), aber Auth- und URL-Komplexität.

| Task | Beschreibung |
|------|--------------|
| E2.1 | URL-Normalisierung: OneDrive `:v:/`, SharePoint `/:v:/g/`, Stream-UUID, `medius.microsoft.com` |
| E2.2 | Prüfen ob **Microsoft-Konto** in Chronell verbunden → Session/Cookies für Embed-Partition |
| E2.3 | Main-Prozess: Referer/Partition für `*.sharepoint.com`, `*.microsoftstream.com` |
| E2.4 | Fallback-UI: Thumbnail + „In Stream öffnen“ wenn iframe blockiert |
| E2.5 | Optional: Graph API für Metadaten (Titel, Dauer, Vorschaubild) |
| E2.6 | Teams `meetingrecap`-Links zuverlässig auf Stream-Embed auflösen |

**Erfolgskriterium:** Eigene Teams-Aufzeichnung (mit angemeldetem MS-Konto) in Notiz abspielbar.

**Risiken:** Tenant-Richtlinien, „Einbetten nicht erlaubt“, 2FA-Partition in Electron.

---

### Phase E3 — Weitere Fach- & Wissens-Embeds (mittel, je 0,5–1 Tag) ✅

| Provider | Nutzen (Zielgruppe) | Status |
|----------|---------------------|--------|
| **Desmos** | Mathe (Graphen, Rechner) | ✅ |
| **CodePen** | Code-Snippets | ✅ |
| **GitHub Gist** | Code | ✅ |
| **Loom** | Meeting-Clips, Tutorials | ✅ |
| **Figma** | Design-Reviews | ✅ |
| **Miro** | Workshops | ✅ |
| **Power BI** | Dashboards | Offen (Auth) |

GeoGebra ist bereits in Phase „Mathe“ abgedeckt; Desmos ergänzt Graphen und Rechner.

---

### Phase E4 — Karten & Termine (mittel, ~1–2 Tage) ✅

| Provider | Status | Anmerkung |
|----------|--------|-----------|
| **OpenStreetMap** | ✅ | `#map=`-Hash, `mlat`/`mlon`, Embed-URL |
| **Google Maps** | ✅ | `pb=`/`!3d!4d`-Koordinaten bevorzugt gegenüber Viewport-`@` |
| **Google Maps Kurzlinks** | ✅ | `maps.app.goo.gl` → Redirect-Auflösung im Main (IPC) |
| **Calendly** | ✅ | Inline-Embed mit `embed_domain=chronell.app` |

---

### Phase E5 — Social erweitern (mittel)

| Provider | Status | Anmerkung |
|----------|--------|-----------|
| **X / Twitter** | ✅ | Theme hell/dunkel an Editor (`composeEditorTheme`) |
| **LinkedIn** | Offen | Oft eingeschränkt |
| **Instagram** | Zurückhaltend | Meta blockiert viele Embeds |
| **Bluesky** | Später | oEmbed noch jung |

**E5.1 ✅:** Embed-Theme an `composeEditorTheme` gekoppelt (X/Twitter; erweiterbar über `usesEditorTheme` in der Registry).

---

### Phase E6 — UX & Produktreife (laufend, ~2–3 Tage gesamt)

| Feature | Beschreibung |
|---------|--------------|
| **Embed-Vorschau beim Einfügen** | Kurze Toast „YouTube-Video eingebettet“ |
| **Toolbar „Embed einfügen“** | Dialog: URL einfügen, Provider erkennen |
| **Fehlerzustand** | Grauer Block + „Öffnen im Browser“ statt leerem iframe |
| **Embed entfernen / in Link umwandeln** | Kontextmenü auf Block |
| **Druck / PDF** | Hinweis: Embeds drucken als Link-Fallback |
| **Suche / Vorschau** | `notePreviewText` ignoriert Embeds sinnvoll (bereits ok) |

---

## Checkliste pro neuem Provider (Copy-Paste)

```markdown
- [ ] `src/shared/note-{provider}-embed.ts` (parse, build, isAllowed)
- [ ] `src/shared/note-{provider}-embed.test.ts`
- [ ] Eintrag in `note-embed-registry.ts` (+ `tiptap`-Block wenn iframe-Factory reicht)
- [ ] CSP `frame-src` in `index.html`
- [ ] `globals.css` (.note-{provider}-embed)
- [ ] Manuell in Dev + packaged App testen
```

(Sanitizer, Electron-Subframe und TipTap-Extensions laufen automatisch über die Registry.)

---

## Prioritäten-Matrix (Gesamtüberblick)

```
Impact ↑
    │  E2 Stream/SharePoint ★          E3 Figma/Miro
    │  E1 Spotify/Vimeo                E4 OSM
    │  E1 SoundCloud/TikTok            E5 Social+
    │  ─────────────────────────────────────────→ Aufwand
         niedrig                          hoch
```

**Empfohlene Reihenfolge für uns:**

1. **E0** — Registry (optional, aber hilfreich)
2. **E1** — Spotify → Vimeo → SoundCloud → TikTok
3. **E6.2–E6.3** — Embed-Dialog + Fehler-UI (besseres Gefühl vor schwerem E2)
4. **E2** — Microsoft Stream mit Auth
5. **E3/E4/E5** — nach Bedarf

---

## Abhängigkeiten zu anderen Roadmap-Teilen

| Thema | Bezug |
|-------|--------|
| [Ink-Block](./notes-ink-block-spec.md) | Unabhängig; beide sind Spezialblöcke im TipTap-HTML |
| [OneNote-Roadmap](./notes-onenote-roadmap.md) Phase 5 | Embeds = „reiche Inhalte“ ohne Canvas |
| M365-Auth / Graph | Voraussetzung für **E2** Stream |
| CSP / Electron Main | Jede Embed-Phase berührt `index.ts` + `index.html` |

---

## Nächster Schritt

**Phase E6 (Teil)** — Embed-Dialog + Fehler-UI, **oder Phase E2** — Microsoft Stream mit M365-Auth.

---

## Änderungsprotokoll

| Datum | Änderung |
|-------|----------|
| 2026-07-02 | Erstversion; Ist-Stand 7 Provider dokumentiert |
| 2026-07-02 | **E0 abgeschlossen:** `note-embed-registry.ts`, Factory-Konsolidierung, Sanitizer/Electron aus Registry |
| 2026-07-02 | **E5 (Teil) abgeschlossen:** X/Twitter-Theme an `composeEditorTheme` |
