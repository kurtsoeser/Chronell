# Chronell — Homepage auf GitHub Pages veröffentlichen

Die Marketing-Website liegt in diesem Ordner (`docs/`) als statische HTML-Seite.

## Live-URL (nach Aktivierung)

**https://kurtsoeser.github.io/Chronell/**

## Einrichtung (einmalig)

1. Repository auf GitHub öffnen: [kurtsoeser/Chronell](https://github.com/kurtsoeser/Chronell)
2. **Settings** → **Pages**
3. Unter **Build and deployment**:
   - **Source:** Deploy from a branch
   - **Branch:** `main` (oder dein Default-Branch)
   - **Folder:** `/docs`
4. **Save** klicken
5. Nach 1–3 Minuten ist die Seite erreichbar (grüner Hinweis mit URL)

## Download (CTA)

Alle Download-Buttons verweisen auf die **stabile URL**:

`release/latest/Chronell-setup.exe`

Die angezeigte Versionsnummer kommt aus `release/latest.json`.

### Installer veröffentlichen

Nach `npm run build:win`:

```powershell
npm run publish:docs-release
```

Das kopiert den Setup-Installer nach `docs/release/<version>/` und `docs/release/latest/`, aktualisiert `latest.json` und öffnet den Ordner.

Anschließend `docs/release/` (inkl. `latest/` und `latest.json`) committen und pushen.

Details: [`docs/release/README.md`](release/README.md)

**Hinweis:** Installer sind oft >100 MB. GitHub erlaubt maximal **100 MB pro Datei** im Repository. Bei größeren Builds:

- [Git LFS](https://git-lfs.github.com/) für `docs/release/**/*.exe`, oder
- [GitHub Releases](https://docs.github.com/en/repositories/releasing-projects-on-github) und in `latest.json` die Asset-URL eintragen

## Branding aktualisieren

Logos aus `resources/branding/`:

```powershell
npm run sync-branding
```

## Lokale Vorschau

```powershell
cd docs
npx --yes serve .
```

Dann im Browser `http://localhost:3000` öffnen.

## Screenshots einpflegen

Lege PNG-Dateien in `docs/assets/screenshots/` ab, z. B.:

- `mail-triage.png`
- `calendar.png`
- `work.png`
- `dashboard.png`

Passe danach `docs/index.html` an: `<img>` statt Platzhalter-Gradient in `.screenshot-body`.

## Custom Domain (optional)

Unter **Pages → Custom domain** z. B. `chronell.app` eintragen und bei deinem DNS-Provider einen **CNAME** auf `kurtsoeser.github.io` setzen.

## Social Preview

Unter **Settings → General → Social preview** ein Bild hochladen (z. B. `assets/chronell-logo.png` oder Export von `assets/og-image.svg` als PNG 1280×640).
