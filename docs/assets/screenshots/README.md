# Screenshots (Homepage)

PNG-Dateien für die Sektion **Chronell in Aktion** auf der Marketing-Homepage (`docs/index.html`).

| Datei | Modul |
|-------|--------|
| `mail-triage.png` | Mail · Posteingang + Lesefenster |
| `calendar.png` | Kalender · Zeitliste + Termin-Vorschau |
| `design.png` | Fluent Design · Presets & Ebenen |
| `connections.png` | Verbindungen · Graph + Notiz-Vorschau |
| `work.png` | Alle Arbeit · Kanban |
| `dashboard.png` | Home · Dashboard-Kacheln |

**Erzeugen** (SVG-Mockups im Chronell-Look, 1280×800):

```powershell
node scripts/generate-homepage-screenshots.mjs
```

Anschließend `docs/assets/screenshots/*.png` committen und pushen (GitHub Pages).

Für echte App-Screenshots: Fenster in Chronell öffnen, PNG ablegen und obige Dateinamen beibehalten — dann `index.html` nicht anpassen (Pfade bleiben gleich).
