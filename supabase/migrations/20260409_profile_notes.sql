create table if not exists public.profile_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  note text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profile_notes_note_length check (char_length(note) between 1 and 500)
);

create index if not exists idx_profile_notes_user_id
on public.profile_notes(user_id);

drop trigger if exists set_profile_notes_updated_at on public.profile_notes;
create trigger set_profile_notes_updated_at
before update on public.profile_notes
for each row
execute procedure public.set_updated_at();

alter table public.profile_notes enable row level security;

drop policy if exists "Users can read own notes" on public.profile_notes;
create policy "Users can read own notes"
on public.profile_notes
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own notes" on public.profile_notes;
create policy "Users can insert own notes"
on public.profile_notes
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own notes" on public.profile_notes;
create policy "Users can update own notes"
on public.profile_notes
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own notes" on public.profile_notes;
create policy "Users can delete own notes"
on public.profile_notes
for delete
to authenticated
using (auth.uid() = user_id);
