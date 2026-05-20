-- Storage-Bucket für Notiz-Anhänge (Phase 2). Im Supabase SQL Editor ausführen.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chronell-note-attachments',
  'chronell-note-attachments',
  false,
  52428800,
  null
)
on conflict (id) do nothing;

drop policy if exists "chronell_note_attachments_select_own" on storage.objects;
drop policy if exists "chronell_note_attachments_insert_own" on storage.objects;
drop policy if exists "chronell_note_attachments_update_own" on storage.objects;
drop policy if exists "chronell_note_attachments_delete_own" on storage.objects;

create policy "chronell_note_attachments_select_own"
  on storage.objects for select
  using (
    bucket_id = 'chronell-note-attachments'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "chronell_note_attachments_insert_own"
  on storage.objects for insert
  with check (
    bucket_id = 'chronell-note-attachments'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "chronell_note_attachments_update_own"
  on storage.objects for update
  using (
    bucket_id = 'chronell-note-attachments'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "chronell_note_attachments_delete_own"
  on storage.objects for delete
  using (
    bucket_id = 'chronell-note-attachments'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
