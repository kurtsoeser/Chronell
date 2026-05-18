# Chronell-Installer für die Homepage

Die Download-Buttons auf der Website laden **`release/latest.json`** und **`release/versions.json`**, prüfen per HEAD welche Installer-URL existiert, und verlinken dann auf die neueste verfügbare Datei — typischerweise **`release/latest/Chronell-setup.exe`** oder **`release/<version>/Chronell-<version>-setup.exe`**.

**Wichtig:** Nur der Ordner `/release` (Build-Ausgabe) ist in `.gitignore` — **`docs/release/` muss mitcommittet werden**, sonst fehlt der Installer auf GitHub Pages.

## Veröffentlichen (nach `npm run build:win`)

```powershell
npm run publish:docs-release
# oder ohne erneuten Build:
npm run publish:docs-release -- -NoBuild
```

Das Skript kopiert den Installer nach `docs/release/<version>/` und `docs/release/latest/`, aktualisiert `latest.json` und öffnet den Ordner zur Kontrolle.

Anschließend `docs/release/` mit committen und pushen (GitHub Pages aus `/docs`).

**Hinweis:** Installer sind groß (oft >100 MB). GitHub erlaubt Dateien bis 100 MB pro Blob; bei größeren Builds Git LFS oder GitHub Releases als Alternative nutzen (siehe `docs/DEPLOY.md`).
