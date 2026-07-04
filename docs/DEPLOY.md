# Chronell — Homepage auf GitHub Pages veröffentlichen

Die Marketing-Website liegt in diesem Ordner (`docs/`) als statische HTML-Seite.

## Offizielle Web-Adresse

**https://chronell.app/**

Die Custom Domain ist in GitHub Pages hinterlegt und in [`CNAME`](CNAME) im Repo festgehalten. DNS: **CNAME** `chronell.app` → `kurtsoeser.github.io` (oder A/AAAA laut GitHub-Dokumentation).

Technischer GitHub-Pages-Pfad (leitet nach Domain-Einrichtung auf `chronell.app` um):

**https://kurtsoeser.github.io/Chronell/**

## Einrichtung (einmalig)

1. Repository auf GitHub öffnen: [kurtsoeser/Chronell](https://github.com/kurtsoeser/Chronell)
2. **Settings** → **Pages**
3. Unter **Build and deployment**:
   - **Source:** Deploy from a branch
   - **Branch:** `main` (oder dein Default-Branch)
   - **Folder:** `/docs`
4. **Save** klicken
5. Unter **Custom domain:** `chronell.app` eintragen, **Enforce HTTPS** aktivieren
6. Nach 1–3 Minuten ist die Seite unter `chronell.app` erreichbar (grüner Hinweis mit URL)

## Download (CTA)

Alle Download-Buttons verweisen auf **GitHub Releases** (`githubDownloadUrl` in `release/latest.json`), z. B.:

`https://github.com/kurtsoeser/Chronell/releases/download/v0.9.23/Chronell-0.9.23-setup.exe`

Die Seite lädt `docs/js/site.js`, das `latest.json` auswertet und den Link setzt. GitHub Pages (`release/latest/Chronell-setup.exe`) ist nur Fallback — mit **Git LFS** im Repo liefert Pages keinen echten Installer.

Die angezeigte Versionsnummer kommt aus `release/latest.json`.

### Installer veröffentlichen

```powershell
npm run build:win
```

Nach dem Build läuft **automatisch** (`postbuild-win.ps1` → `publish-docs-release.ps1`):

- Installer nach `docs/release/` (Git LFS)
- Manifeste `latest.json` / `versions.json`
- Upload auf GitHub Releases
- `git commit` + `git push` (Homepage auf GitHub Pages / chronell.app)

**Nur lokal bauen:** `npm run build:win:local`

**Manuell** (ohne Build): `npm run publish:docs-release:full`

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

Demo-Seite: `http://localhost:3000/demo/`

## Online-Demo & Portable ZIP

| Asset | Pfad |
|-------|------|
| Demo-Seite | `docs/demo/index.html` → `chronell.app/demo/` |
| Web-Snapshot | `docs/demo/data/demo-snapshot.json` (`npm run demo:build-snapshot`) |
| Portable ZIP | `release/<version>/Chronell-*-Demo-Portable.zip` (`npm run demo:package-portable`) |

## Screenshots

Die Homepage bindet PNGs aus `docs/assets/screenshots/` ein (siehe [`assets/screenshots/README.md`](assets/screenshots/README.md)).

Neu erzeugen (Marketing-Mockups im Chronell-Look):

```powershell
node scripts/generate-homepage-screenshots.mjs
```

Echte App-Screenshots: gleiche Dateinamen überschreiben, dann committen und pushen.

## Social Preview

Unter **Settings → General → Social preview** ein Bild hochladen (z. B. `assets/chronell-logo.png` oder Export von `assets/og-image.svg` als PNG 1280×640). Open-Graph-Metadaten in `index.html` verweisen auf `https://chronell.app/`.
