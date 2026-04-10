alter table public.works
add column if not exists publication_year integer;

create table if not exists public.composer_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  composer_id uuid not null references public.composers(id) on delete cascade,
  note text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint composer_notes_note_length check (char_length(note) between 1 and 500),
  constraint composer_notes_user_composer_key unique (user_id, composer_id)
);

create table if not exists public.daily_recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  work_id uuid not null references public.works(id) on delete cascade,
  recommendation_date date not null,
  created_at timestamptz not null default now(),
  constraint daily_recommendations_user_day_key unique (user_id, recommendation_date)
);

create index if not exists idx_composer_notes_user_id
on public.composer_notes(user_id);

create index if not exists idx_composer_notes_composer_id
on public.composer_notes(composer_id);

create index if not exists idx_daily_recommendations_user_date
on public.daily_recommendations(user_id, recommendation_date desc);

create index if not exists idx_daily_recommendations_user_work_date
on public.daily_recommendations(user_id, work_id, recommendation_date desc);

drop trigger if exists set_composer_notes_updated_at on public.composer_notes;
create trigger set_composer_notes_updated_at
before update on public.composer_notes
for each row
execute procedure public.set_updated_at();

alter table public.composer_notes enable row level security;
alter table public.daily_recommendations enable row level security;

drop policy if exists "Users can read own composer notes" on public.composer_notes;
create policy "Users can read own composer notes"
on public.composer_notes
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own composer notes" on public.composer_notes;
create policy "Users can insert own composer notes"
on public.composer_notes
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own composer notes" on public.composer_notes;
create policy "Users can update own composer notes"
on public.composer_notes
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own composer notes" on public.composer_notes;
create policy "Users can delete own composer notes"
on public.composer_notes
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can read own recommendations" on public.daily_recommendations;
create policy "Users can read own recommendations"
on public.daily_recommendations
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own recommendations" on public.daily_recommendations;
create policy "Users can insert own recommendations"
on public.daily_recommendations
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own recommendations" on public.daily_recommendations;
create policy "Users can delete own recommendations"
on public.daily_recommendations
for delete
to authenticated
using (auth.uid() = user_id);
