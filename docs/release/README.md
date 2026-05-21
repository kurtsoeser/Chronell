# Chronell-Installer für die Homepage

Die Download-Buttons auf der Website laden **`release/latest.json`** und **`release/versions.json`**, prüfen per HEAD welche Installer-URL existiert, und verlinken **zuerst** auf GitHub Pages — typischerweise **`release/latest/Chronell-setup.exe`** (öffentlich, ohne GitHub-Login).

**`githubDownloadUrl`** in den Manifesten ist nur ein optionaler Fallback (GitHub Releases), nicht der primäre Homepage-Link.

**Wichtig:** Nur der Ordner `/release` (Build-Ausgabe) ist in `.gitignore` — **`docs/release/` muss mitcommittet werden**, sonst fehlt der Installer auf GitHub Pages.

## Veröffentlichen

Bei `npm run build:win` erscheint nach dem Build eine Abfrage, ob die Version auf GitHub veröffentlicht werden soll (**Ja** = dieses Skript automatisch).

Manuell:

```powershell
npm run publish:docs-release
```

Das Skript kopiert den Installer nach `docs/release/<version>/` und `docs/release/latest/`, aktualisiert `latest.json`, lädt das Asset per `gh` auf GitHub Releases hoch und öffnet den Ordner zur Kontrolle.

Anschließend `docs/release/` mit committen und pushen (GitHub Pages aus `/docs`).

**Hinweis:** GitHub erlaubt **max. 100 MB pro Datei** im Repo. Chronell baut deshalb schlanke Installer (`compression: maximum`, Locale-Trim in `scripts/after-pack-embed-icon.cjs`). Nach `npm run build:win` warnt `publish:docs-release` bei >98 MB. Details: `docs/DEPLOY.md`.
