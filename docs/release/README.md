# Chronell-Installer für die Homepage

Die Download-Buttons laden **`release/latest.json`** und **`release/versions.json`**, setzen den Link auf **`githubDownloadUrl`** (GitHub Releases) und nutzen GitHub Pages (`stableUrl`) nur als Fallback.

**Installer im Repo:** `docs/release/**/*.exe` per **Git LFS** (auch >100 MB). GitHub Pages liefert LFS-Dateien nicht als echten Installer — der öffentliche Download läuft über **GitHub Releases**.

## Veröffentlichen

Bei `npm run build:win` erscheint nach dem Build eine Abfrage, ob die Version veröffentlicht werden soll (**Ja** = Skript automatisch).

Manuell:

```powershell
npm run publish:docs-release
```

Das Skript kopiert den Installer nach `docs/release/<version>/` und `docs/release/latest/`, aktualisiert die Manifeste, lädt per `gh` auf **GitHub Releases** hoch und öffnet den Ordner zur Kontrolle.

Anschließend committen und pushen (inkl. `git lfs push` — passiert bei normalem `git push` meist automatisch):

```powershell
git add docs/release .gitattributes
git commit -m "Release 0.9.x: Installer per LFS, Download via GitHub Releases"
git push origin main
```

**Git LFS einmalig:** `.\scripts\setup-git-lfs.ps1` — Details: `docs/DEPLOY.md`.
