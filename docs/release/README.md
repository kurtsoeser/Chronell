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
   - **Git commit + push** → GitHub Pages aktualisiert sich

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

## Manuell nachziehen

```powershell
npm run publish:docs-release:full
```

Details: `docs/DEPLOY.md`
