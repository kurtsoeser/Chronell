# Chronell Demo-Umgebung

Die Demo-Umgebung ist eine **isolierte Installation** mit fiktiven Beispieldaten (Szenario „Nordlicht Consulting“). Echte Konten und Daten in `%AppData%\Chronell` bleiben unberührt.

## Demo starten

| Methode | Beschreibung |
|---------|--------------|
| **Desktop-Verknüpfung** | „Chronell Demo“ (Installer legt `--demo` an) |
| **Kommandozeile** | `Chronell.exe --demo` |
| **Entwicklung** | `npm run demo:launch` (`CHRONELL_DEMO=1`) |
| **In der App** | Ersteinrichtung → „Mit Demo-Daten ausprobieren“ oder Einstellungen → Allgemein → Demo-Umgebung |

Profilordner: `%AppData%\Chronell-Demo`

## Inhalt des Szenarios

- Zwei Demo-Konten (Anna Weber / Projekt Alpha) — Provider `demo`, kein OAuth
- Mail, Kalender, Aufgaben, Notizen, Kontakte und Verbindungs-Graph mit festen Beispiel-IDs
- Kein Versand an Microsoft/Google; Sync ist deaktiviert

## Zurücksetzen

- **In der App:** Banner oder Einstellungen → Demo → „Zurücksetzen“
- **CLI (ohne laufende App):** `npm run demo:reset`

Das gebündelte Paket `resources/demo/chronell-demo-pack.zip` wird neu entpackt.

## Demo-Paket neu bauen

```bash
npm run demo:build-pack
```

Erzeugt:

- `resources/demo/chronell-demo-pack.zip`
- `resources/demo/demo-pack-manifest.json`

Quellcode der Seed-Daten: `src/demo/`.

## Produktiv-Profil wieder öffnen

Im Demo-Banner oder in den Einstellungen: **Produktiv-Profil** — startet Chronell ohne `--demo` neu.

## Homepage-Screenshots

Mit laufender Demo-Instanz:

```bash
npm run demo:launch
npm run generate:homepage-screenshots
```

## Support-Export

Im aktiven Demo-Profil: Einstellungen → Demo → „Paket exportieren“ (`demo:export-pack`).
