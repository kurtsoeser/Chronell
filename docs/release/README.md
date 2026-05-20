# Chronell-Installer für die Homepage

Die Download-Buttons auf der Website laden **`release/latest.json`** und **`release/versions.json`**, prüfen per HEAD welche Installer-URL existiert, und verlinken dann auf die neueste verfügbare Datei — typischerweise **`release/latest/Chronell-setup.exe`** oder **`release/<version>/Chronell-<version>-setup.exe`**.

**Wichtig:** Nur der Ordner `/release` (Build-Ausgabe) ist in `.gitignore` — **`docs/release/` muss mitcommittet werden**, sonst fehlt der Installer auf GitHub Pages.

## Veröffentlichen

Bei `npm run build:win` erscheint nach dem Build eine Abfrage, ob die Version auf GitHub veröffentlicht werden soll (**Ja** = dieses Skript automatisch).

Manuell:

```powershell
npm run publish:docs-release
```

Das Skript kopiert den Installer nach `docs/release/<version>/` und `docs/release/latest/`, aktualisiert `latest.json`, lädt das Asset per `gh` auf GitHub Releases hoch und öffnet den Ordner zur Kontrolle.

Anschließend `docs/release/` mit committen und pushen (GitHub Pages aus `/docs`).

**Hinweis:** Installer sind groß (oft >100 MB). GitHub erlaubt Dateien bis 100 MB pro Blob; bei größeren Builds Git LFS oder GitHub Releases als Alternative nutzen (siehe `docs/DEPLOY.md`).
