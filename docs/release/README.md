# Chronell-Installer für die Homepage

## Ein Befehl — alles automatisch

```powershell
npm run build:win
```

1. **Eine Frage** zu Beginn: neue Patch-Version `[J]` oder gleiche Version neu bauen `[N]`
2. Danach läuft alles von selbst:
   - Windows-Installer bauen
   - Installer nach `docs/release/` kopieren (Git LFS)
   - `latest.json` / `versions.json` aktualisieren
   - Installer auf **GitHub Releases** hochladen (öffentlicher Download)
   - Homepage-Download-URLs setzen
   - **Git commit + push** → GitHub Pages / [chronell.app](https://chronell.app/) aktualisiert sich

**Download-URL** (sofort nach Upload): steht am Ende der Build-Ausgabe.

**Nur lokal bauen** (ohne Upload/Push):

```powershell
npm run build:win:local
```

## Voraussetzungen (einmalig)

- [Git LFS](https://git-lfs.github.com/) installiert
- [GitHub CLI](https://cli.github.com/) mit `gh auth login`
- Git-Remote `origin` auf `kurtsoeser/Chronell`

LFS einrichten (falls noch nicht geschehen): `.\scripts\ensure-git-lfs.ps1`

## Nach einem Coding-Tag (Publish-Day)

Alles in einem Durchlauf: Release-Notizen, Funktionsprotokoll, Homepage, QA, Build, Git-Push, GitHub Release:

```powershell
npm run publish:day
```

Release-Notizen werden **automatisch aus Git** erzeugt (`scripts/generate-release-notes.ps1`) — geänderte Dateien seit `v{package.json}` plus Working Tree. Optional nur ansehen: `-ReviewNotes`, manuell: `-ManualNotes`.

Vorschau: `npm run release:notes`

**Nur testen ohne Änderungen:**

```powershell
npm run publish:day:dry
```

**Nur lokal bauen** (ohne Push): `npm run publish:day -- -LocalOnly`

Flags: `-SkipChecks`, `-NoBump`, `-Bump minor`, `-NotesFile docs/releases/0.9.25.md`

## Manuell nachziehen

```powershell
npm run publish:docs-release:full
```

Details: `docs/DEPLOY.md`
