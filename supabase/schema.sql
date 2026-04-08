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

create index if not exists idx_works_composer_id on public.works(composer_id);
create index if not exists idx_works_title_tsv on public.works using gin (to_tsvector('simple', title));
create index if not exists idx_user_logs_user_id on public.user_logs(user_id);
create index if not exists idx_user_logs_work_id on public.user_logs(work_id);
create index if not exists idx_user_logs_categories on public.user_logs using gin (categories);

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
