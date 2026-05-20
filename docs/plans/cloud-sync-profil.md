# Chronell Profil-Sync (Supabase)

## Datenbank-Schema (Migration)

**Projekt:** Chronell (`rueobtpqmeagsqjqtbwn`, Region eu-west-1)

| Weg | Status |
|-----|--------|
| **Supabase-MCP in Cursor** (empfohlen) | Migration `chronell_profile_snapshots` ist angewendet |
| SQL Editor / `npx supabase db push` | Alternative; SQL in [`supabase/migrations/20260520100000_chronell_profile_snapshots.sql`](../../supabase/migrations/20260520100000_chronell_profile_snapshots.sql) |

### Supabase-MCP einrichten (einmalig)

1. In Cursor: **Settings → MCP** → Supabase-Plugin aktiv.
2. Im Chat: Agent bittet um **Authenticate** → Browser → Supabase-Konto erlauben.
3. Danach kann der Agent Migrationen mit `apply_migration` / SQL mit `execute_sql` ausführen — ohne SQL Editor.

Neue Migrationen: Datei unter `supabase/migrations/` anlegen, Agent bitten „Migration auf Chronell anwenden“.

## Einmalig im Supabase-Dashboard

1. **Projekt „Chronell“** (`rueobtpqmeagsqjqtbwn`) — nicht GigPal oder andere Projekte.
2. **Authentication → Sign In / Providers → Azure**: Schalter **Enable** + Client-ID (GUID), Secret, Tenant-URL speichern.  
   Fehler `provider is not enabled` = Azure hier noch aus oder falsches Projekt.
3. **Authentication → URL Configuration → Redirect URLs** zusätzlich eintragen:
   - `http://127.0.0.1:47842` (Desktop-OAuth für Chronell)
4. **Authentication → Providers → Email** (optional): E-Mail-OTP als Alternative.

### Fehler: „Error getting user email from external provider“

Microsoft liefert die E-Mail nicht im Token → Supabase kann den Nutzer nicht anlegen.

**Azure Portal** (dieselbe App-Registrierung wie in Supabase eingetragen):

1. **Token configuration** → **Add optional claim** → Token type **ID** → `email`, `preferred_username` (optional `xms_edov`) → Save.
2. **API permissions** → **Microsoft Graph** → Delegated: `openid`, `profile`, `email`, `User.Read` → **Grant admin consent** (falls sichtbar).
3. Erneut in Chronell anmelden; im Browser ggf. Microsoft-Abmeldung oder privates Fenster.

**Schnell-Workaround in Supabase:** Azure-Provider → **Allow users without an email** = Ein (nur wenn obiges nicht möglich).

## Lokale Konfiguration

`.env` (nicht committen):

```env
CHRONELL_SUPABASE_URL=https://xxxx.supabase.co
CHRONELL_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

## Was synchronisiert wird

Ein JSON-Snapshot pro Nutzer (`chronell_profile_snapshots`), gleicher Inhalt wie „Einstellungen sichern“:

- Notizen, Entity-Links, Regeln, QuickSteps, Workflow, UI-localStorage, …
- **Konten-Präferenzen** (Secure Store): Farbe, **Signaturvorlagen inkl. HTML**, Standard-Signatur, Kalender-Vorausschau, Book-with-me-URL, Konten-Reihenfolge
- **Nicht**: OAuth-Tokens, Mail-Inhalte, `mail.db`-Cache

## App

Einstellungen → Allgemein → **Cloud-Sync**

## Phase 2 (Komfort)

- **Auto-Sync:** Beim App-Start (nach ~8 s), im Hintergrund im eingestellten Intervall (**2–30 Min**, Standard 5; Einstellungen → Cloud-Sync), nur leichter Cloud-Zeitstempel-Check, voller Abruf nur bei Änderungen; **5 s** nach Änderungen an Notizen, Verbindungen oder Konten-Präferenzen (z. B. Signaturen).
- **UI-Prefs:** Renderer meldet `localStorage` alle 30 s an den Main-Prozess.
- **Konflikt-Auswahl:** Wenn die Cloud neuer ist als der letzte Abruf auf diesem Gerät (oder lokale Änderungen + anderer Cloud-Stand), pausiert Auto-Sync. In den Einstellungen: **Cloud-Stand übernehmen** oder **Lokalen Stand hochladen**.
- **Notiz-Anhänge:** Bucket `chronell-note-attachments` (Migration `20260520120000_chronell_note_attachments_storage.sql`).
- Push nur bei lokalen Änderungen (`profileCloudLocalDirtyAt`), nicht bei jedem Poll.
