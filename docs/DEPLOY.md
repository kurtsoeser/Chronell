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

Alle Download-Buttons verweisen auf die **stabile GitHub-Pages-URL** (öffentlich, ohne Anmeldung):

`https://kurtsoeser.github.io/Chronell/release/latest/Chronell-setup.exe`

(relativ: `release/latest/Chronell-setup.exe`)

Die angezeigte Versionsnummer kommt aus `release/latest.json`. GitHub Releases (`githubDownloadUrl`) ist nur Zusatz-Spiegel, nicht der primäre Link.

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

**Hinweis:** GitHub erlaubt maximal **100 MB pro Datei** im Repository (Git Push **und** GitHub Pages). Liegt der Installer darüber, schlägt `git push` mit `GH001` fehl.

**Zuerst (empfohlen):** Installer verkleinern — `electron-builder.yml` nutzt `compression: maximum`, entfernt ungenutzte Electron-Locales und packt weniger Branding mit. Neu bauen:

```powershell
npm run build:win
npm run publish:docs-release
```

Ziel: Setup **unter ~98 MB**. Das Skript warnt sonst beim Veröffentlichen.

**Falls der Push schon mit großen EXEs fehlgeschlagen ist:**

```powershell
git rm --cached docs/release/**/*.exe
# Neu bauen (schlanker Installer), dann:
npm run publish:docs-release
git add docs/release .gitattributes
git commit -m "Installer unter 100 MB"
git push
```

**Fallback:** [Git LFS](https://git-lfs.github.com/) — `.\scripts\setup-git-lfs.ps1` (Pages-Download kann dann unzuverlässig sein; Homepage nutzt dann eher GitHub Releases).

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
