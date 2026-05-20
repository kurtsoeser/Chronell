-- Chronell Profil-Sync (MVP): ein Snapshot pro Nutzer (Notizen, Verbindungen, UI-Prefs).
-- Im Supabase SQL Editor ausführen oder via Supabase CLI deployen.

create table if not exists public.chronell_profile_snapshots (
  user_id uuid primary key references auth.users (id) on delete cascade,
  device_id text not null,
  payload jsonb not null,
  payload_version int not null default 2,
  updated_at timestamptz not null default now()
);

create index if not exists idx_chronell_profile_snapshots_updated
  on public.chronell_profile_snapshots (updated_at desc);

alter table public.chronell_profile_snapshots enable row level security;

drop policy if exists "chronell_profile_own_row" on public.chronell_profile_snapshots;

create policy "chronell_profile_own_row"
  on public.chronell_profile_snapshots
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
