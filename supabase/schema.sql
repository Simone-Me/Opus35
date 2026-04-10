create extension if not exists pgcrypto;

create table if not exists public.composers (
  id uuid primary key default gen_random_uuid(),
  openopus_id integer unique not null,
  name text not null,
  complete_name text,
  epoch text,
  birth integer,
  death integer,
  bio text,
  wikipedia_url text,
  portrait_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.works (
  id uuid primary key default gen_random_uuid(),
  composer_id uuid not null references public.composers(id) on delete cascade,
  openopus_id integer unique not null,
  title text not null,
  genre text,
  publication_year integer,
  popularity integer,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  work_id uuid not null references public.works(id) on delete cascade,
  categories text[] not null default '{}',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, work_id),
  constraint categories_allowed_values check (
    categories <@ array['heard', 'favorite', 'bought', 'alert']::text[]
  )
);

create table if not exists public.profile_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  note text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profile_notes_note_length check (char_length(note) between 1 and 500)
);

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

create index if not exists idx_works_composer_id on public.works(composer_id);
create index if not exists idx_works_title_tsv on public.works using gin (to_tsvector('simple', title));
create index if not exists idx_user_logs_user_id on public.user_logs(user_id);
create index if not exists idx_user_logs_work_id on public.user_logs(work_id);
create index if not exists idx_user_logs_categories on public.user_logs using gin (categories);
create index if not exists idx_profile_notes_user_id on public.profile_notes(user_id);
create index if not exists idx_composer_notes_user_id on public.composer_notes(user_id);
create index if not exists idx_composer_notes_composer_id on public.composer_notes(composer_id);
create index if not exists idx_daily_recommendations_user_date on public.daily_recommendations(user_id, recommendation_date desc);
create index if not exists idx_daily_recommendations_user_work_date on public.daily_recommendations(user_id, work_id, recommendation_date desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute procedure public.set_updated_at();

create trigger set_user_logs_updated_at
before update on public.user_logs
for each row
execute procedure public.set_updated_at();

create trigger set_profile_notes_updated_at
before update on public.profile_notes
for each row
execute procedure public.set_updated_at();

create trigger set_composer_notes_updated_at
before update on public.composer_notes
for each row
execute procedure public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, split_part(new.email, '@', 1))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute procedure public.handle_new_user();

alter table public.composers enable row level security;
alter table public.works enable row level security;
alter table public.profiles enable row level security;
alter table public.user_logs enable row level security;
alter table public.profile_notes enable row level security;
alter table public.composer_notes enable row level security;
alter table public.daily_recommendations enable row level security;

create policy "Public can read composers"
on public.composers
for select
to anon, authenticated
using (true);

create policy "Public can read works"
on public.works
for select
to anon, authenticated
using (true);

create policy "Users can read own profile"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

create policy "Users can insert own profile"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

create policy "Users can update own profile"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "Users can read own logs"
on public.user_logs
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own logs"
on public.user_logs
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own logs"
on public.user_logs
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own logs"
on public.user_logs
for delete
to authenticated
using (auth.uid() = user_id);

create policy "Users can read own notes"
on public.profile_notes
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own notes"
on public.profile_notes
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own notes"
on public.profile_notes
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own notes"
on public.profile_notes
for delete
to authenticated
using (auth.uid() = user_id);

create policy "Users can read own composer notes"
on public.composer_notes
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own composer notes"
on public.composer_notes
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own composer notes"
on public.composer_notes
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own composer notes"
on public.composer_notes
for delete
to authenticated
using (auth.uid() = user_id);

create policy "Users can read own recommendations"
on public.daily_recommendations
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own recommendations"
on public.daily_recommendations
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can delete own recommendations"
on public.daily_recommendations
for delete
to authenticated
using (auth.uid() = user_id);
