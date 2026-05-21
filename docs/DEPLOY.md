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

Alle Download-Buttons verweisen auf **GitHub Releases** (`githubDownloadUrl` in `release/latest.json`), z. B.:

`https://github.com/kurtsoeser/Chronell/releases/download/v0.9.20/Chronell-0.9.20-setup.exe`

Die Seite lädt `docs/js/site.js`, das `latest.json` auswertet und den Link setzt. GitHub Pages (`release/latest/Chronell-setup.exe`) ist nur Fallback — mit **Git LFS** im Repo liefert Pages keinen echten Installer.

Die angezeigte Versionsnummer kommt aus `release/latest.json`.

### Installer veröffentlichen

Bei `npm run build:win` erscheint **nach dem Build** die Abfrage, ob die Version auf GitHub veröffentlicht werden soll. Bei **Ja** werden Installer, Manifeste und GitHub Release automatisch erledigt (`scripts/postbuild-win.ps1` → `publish-docs-release.ps1`).

Manuell (ohne erneuten Build):

```powershell
npm run publish:docs-release
```

Das kopiert den Setup-Installer nach `docs/release/<version>/` und `docs/release/latest/`, aktualisiert `latest.json`, lädt per `gh` auf GitHub Releases hoch und öffnet den Ordner.

Anschließend `docs/release/` (inkl. `latest/` und `latest.json`) committen und pushen.

Ohne interaktive Veröffentlichungsabfrage: `CHRONELL_NO_PUBLISH_PROMPT=1` oder nur `npm run build:win:inner` nach `prebuild:win`.

Details: [`docs/release/README.md`](release/README.md)

**Hinweis:** Ohne Git LFS erlaubt GitHub maximal **100 MB pro Datei** im Repository (`GH001` beim Push). Ab ~100 MB Installer:

1. **Git LFS:** `.\scripts\setup-git-lfs.ps1` (einmalig)
2. EXEs neu zum Index hinzufügen: `git rm --cached docs/release/**/*.exe` → `git add docs/release .gitattributes`
3. **`npm run publish:docs-release`** — lädt den Installer auf **GitHub Releases** hoch (öffentlicher Download)
4. `git push` — LFS-Objekte werden mit übertragen

Homepage-Download = **GitHub Releases**, nicht GitHub Pages. Optional kann der Installer weiter verkleinert werden (`electron-builder.yml`: `compression: maximum`, Locale-Trim).

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

## Screenshots

Die Homepage bindet PNGs aus `docs/assets/screenshots/` ein (siehe [`assets/screenshots/README.md`](assets/screenshots/README.md)).

Neu erzeugen (Marketing-Mockups im Chronell-Look):

```powershell
node scripts/generate-homepage-screenshots.mjs
```

Echte App-Screenshots: gleiche Dateinamen überschreiben, dann committen und pushen.

## Custom Domain (optional)

Unter **Pages → Custom domain** z. B. `chronell.app` eintragen und bei deinem DNS-Provider einen **CNAME** auf `kurtsoeser.github.io` setzen.

## Social Preview

Unter **Settings → General → Social preview** ein Bild hochladen (z. B. `assets/chronell-logo.png` oder Export von `assets/og-image.svg` als PNG 1280×640).
