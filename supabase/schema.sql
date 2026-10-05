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
  created_at timestamptz not null default now(),
  enrichment_attempted_at timestamptz
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
  ),
  constraint user_logs_details_shape check (
    jsonb_typeof(details) = 'object'
    and pg_column_size(details) <= 16384
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
create index if not exists idx_works_title on public.works(title);
create index if not exists idx_works_genre on public.works(genre);
create index if not exists idx_composers_name on public.composers(name);
create index if not exists idx_composers_epoch on public.composers(epoch);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute procedure public.set_updated_at();

drop trigger if exists set_user_logs_updated_at on public.user_logs;
create trigger set_user_logs_updated_at
before update on public.user_logs
for each row
execute procedure public.set_updated_at();

drop trigger if exists set_profile_notes_updated_at on public.profile_notes;
create trigger set_profile_notes_updated_at
before update on public.profile_notes
for each row
execute procedure public.set_updated_at();

drop trigger if exists set_composer_notes_updated_at on public.composer_notes;
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

drop policy if exists "Public can read composers" on public.composers;
create policy "Public can read composers"
on public.composers
for select
to anon, authenticated
using (true);

drop policy if exists "Public can read works" on public.works;
create policy "Public can read works"
on public.works
for select
to anon, authenticated
using (true);

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "Users can read own logs" on public.user_logs;
create policy "Users can read own logs"
on public.user_logs
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own logs" on public.user_logs;
create policy "Users can insert own logs"
on public.user_logs
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own logs" on public.user_logs;
create policy "Users can update own logs"
on public.user_logs
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own logs" on public.user_logs;
create policy "Users can delete own logs"
on public.user_logs
for delete
to authenticated
using (auth.uid() = user_id);

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

-- RPCs and read views (kept identical to migrations/202610050001_hardening_rpc_views.sql)

-- Adds a category to the caller's log for a work (creating the row if needed).
-- p_details, when a non-empty object, replaces details[p_category].
create or replace function public.set_user_log_category(
  p_work_id uuid,
  p_category text,
  p_details jsonb default null
)
returns setof public.user_logs
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_details jsonb := '{}'::jsonb;
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if p_category is null
    or p_category <> all (array['heard', 'favorite', 'bought', 'alert']) then
    raise exception 'Invalid category: %', p_category using errcode = '22023';
  end if;

  if p_details is not null and jsonb_typeof(p_details) <> 'object' then
    raise exception 'Details must be a JSON object' using errcode = '22023';
  end if;

  if p_details is not null and p_details <> '{}'::jsonb then
    v_details := jsonb_build_object(p_category, p_details);
  end if;

  return query
  insert into public.user_logs as ul (user_id, work_id, categories, details)
  values (v_user_id, p_work_id, array[p_category], v_details)
  on conflict (user_id, work_id) do update
    set categories = case
          when p_category = any (ul.categories) then ul.categories
          else array_append(ul.categories, p_category)
        end,
        details = ul.details || excluded.details
  returning ul.*;
end;
$$;

-- Removes a category (and its details) from the caller's log for a work.
-- Deletes the row when no category is left. Returns the remaining row, or nothing.
create or replace function public.remove_user_log_category(
  p_work_id uuid,
  p_category text
)
returns setof public.user_logs
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_row public.user_logs;
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  update public.user_logs ul
  set categories = array_remove(ul.categories, p_category),
      details = ul.details - p_category
  where ul.user_id = v_user_id
    and ul.work_id = p_work_id
  returning ul.* into v_row;

  if not found then
    return;
  end if;

  if cardinality(v_row.categories) = 0 then
    delete from public.user_logs where id = v_row.id;
    return;
  end if;

  return next v_row;
end;
$$;

-- Flips a flag category. Row lock makes concurrent toggles serialize.
create or replace function public.toggle_user_log_category(
  p_work_id uuid,
  p_category text
)
returns setof public.user_logs
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_categories text[];
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select ul.categories into v_categories
  from public.user_logs ul
  where ul.user_id = v_user_id
    and ul.work_id = p_work_id
  for update;

  if found and p_category = any (v_categories) then
    return query select * from public.remove_user_log_category(p_work_id, p_category);
  else
    return query select * from public.set_user_log_category(p_work_id, p_category, null);
  end if;
end;
$$;

-- Picks (once per user and day) a random work not recommended in the previous 365 days.
-- p_day is the caller's local calendar day, accepted within one day of the server date.
create or replace function public.generate_daily_recommendation(p_day date)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_work_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if p_day is null or p_day not between current_date - 1 and current_date + 1 then
    raise exception 'Invalid recommendation day' using errcode = '22023';
  end if;

  select dr.work_id into v_work_id
  from public.daily_recommendations dr
  where dr.user_id = v_user_id
    and dr.recommendation_date = p_day;

  if found then
    return v_work_id;
  end if;

  select w.id into v_work_id
  from public.works w
  where not exists (
    select 1
    from public.daily_recommendations dr
    where dr.user_id = v_user_id
      and dr.work_id = w.id
      and dr.recommendation_date > p_day - 365
      and dr.recommendation_date < p_day
  )
  order by random()
  limit 1;

  if v_work_id is null then
    select w.id into v_work_id from public.works w order by random() limit 1;
  end if;

  if v_work_id is null then
    raise exception 'No works available' using errcode = 'P0002';
  end if;

  insert into public.daily_recommendations (user_id, work_id, recommendation_date)
  values (v_user_id, v_work_id, p_day)
  on conflict (user_id, recommendation_date) do nothing;

  select dr.work_id into v_work_id
  from public.daily_recommendations dr
  where dr.user_id = v_user_id
    and dr.recommendation_date = p_day;

  return v_work_id;
end;
$$;

revoke execute on function public.set_user_log_category(uuid, text, jsonb) from public, anon;
revoke execute on function public.remove_user_log_category(uuid, text) from public, anon;
revoke execute on function public.toggle_user_log_category(uuid, text) from public, anon;
revoke execute on function public.generate_daily_recommendation(date) from public, anon;
grant execute on function public.set_user_log_category(uuid, text, jsonb) to authenticated;
grant execute on function public.remove_user_log_category(uuid, text) to authenticated;
grant execute on function public.toggle_user_log_category(uuid, text) to authenticated;
grant execute on function public.generate_daily_recommendation(date) to authenticated;

create or replace view public.works_index
with (security_invoker = true) as
select
  w.id,
  w.title,
  w.genre,
  w.publication_year,
  w.popularity,
  w.openopus_id,
  w.composer_id,
  c.name as composer_name,
  c.complete_name as composer_complete_name,
  c.epoch as composer_epoch
from public.works w
join public.composers c on c.id = w.composer_id;

create or replace view public.work_genres
with (security_invoker = true) as
select distinct w.genre
from public.works w
where w.genre is not null;

create or replace view public.composer_epochs
with (security_invoker = true) as
select distinct c.epoch
from public.composers c
where c.epoch is not null;

grant select on public.works_index, public.work_genres, public.composer_epochs
to anon, authenticated;
