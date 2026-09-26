# Screenshots (Homepage)

PNG-Dateien für die Sektion **Chronell in Aktion** auf der Marketing-Homepage (`docs/index.html`).

| Datei | Modul |
|-------|--------|
| `mail-triage.png` | Mail · Posteingang + Lesefenster |
| `calendar.png` | Kalender · Woche + Termine |
| `design.png` | Fluent Design · Einstellungen Darstellung |
| `connections.png` | Verbindungen · Graph |
| `work.png` | Alle Arbeit · Kanban |
| `dashboard.png` | Home · Dashboard-Kacheln |

## Echte App-Screenshots (empfohlen)

Mit dem erweiterten Demo-Seed (Nordlicht Consulting):

```powershell
npm run demo:build-pack
npm run capture:homepage-screenshots
```

Startet die Demo-App, wechselt die Module und schreibt PNGs (1280×800) nach `docs/assets/screenshots/`.

## SVG-Mockups (Fallback)

```powershell
node scripts/generate-homepage-screenshots.mjs
```

Anschließend committen und pushen (GitHub Pages / chronell.app).
