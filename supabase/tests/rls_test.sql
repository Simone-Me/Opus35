-- RLS + RPC regression tests for Opus35.
-- Every check raises an exception on failure, so with ON_ERROR_STOP the run
-- stops at the first broken expectation.
--
-- Run on a disposable Postgres (see scripts/test-db.sh), after
-- supabase_stub.sql + schema.sql. Never run against the real project:
-- it inserts fixture users and catalog rows.

\set ON_ERROR_STOP on
\set QUIET on
\o /dev/null

-- Fixtures (as superuser) ------------------------------------------------------
reset role;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'user-a@example.com'),
  ('00000000-0000-0000-0000-0000000000b2', 'user-b@example.com');

insert into public.composers (id, openopus_id, name, epoch) values
  ('10000000-0000-0000-0000-000000000001', 1, 'Bach', 'Baroque');

insert into public.works (id, composer_id, openopus_id, title, genre) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 11, 'Mass in B minor', 'Vocal'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 12, 'Goldberg Variations', 'Keyboard'),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 13, 'Cello Suite No. 1', 'Chamber');

do $$
begin
  if (select count(*) from public.profiles) <> 2 then
    raise exception 'handle_new_user trigger should create one profile per user';
  end if;
end
$$;

-- RLS must be enabled everywhere --------------------------------------------
do $$
declare
  v_table text;
begin
  for v_table in
    select tablename from pg_tables
    where schemaname = 'public'
      and tablename in ('composers', 'works', 'profiles', 'user_logs', 'profile_notes', 'composer_notes', 'daily_recommendations')
      and not rowsecurity
  loop
    raise exception 'RLS disabled on public.%', v_table;
  end loop;
end
$$;

-- Anonymous visitor ------------------------------------------------------------
set role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', false);

do $$
begin
  if (select count(*) from public.works_index) <> 3 then
    raise exception 'anon should read the public catalog through works_index';
  end if;
  if (select count(*) from public.work_genres) <> 3 then
    raise exception 'anon should read work_genres';
  end if;
  if (select count(*) from public.composer_epochs) <> 1 then
    raise exception 'anon should read composer_epochs';
  end if;
  if (select count(*) from public.profiles) <> 0 then
    raise exception 'anon must not read profiles';
  end if;
end
$$;

do $$
begin
  perform public.set_user_log_category('20000000-0000-0000-0000-000000000001', 'heard', null);
  raise exception 'anon must not execute set_user_log_category';
exception
  when insufficient_privilege then null;
end
$$;

do $$
begin
  perform public.generate_daily_recommendation(current_date);
  raise exception 'anon must not execute generate_daily_recommendation';
exception
  when insufficient_privilege then null;
end
$$;

do $$
begin
  perform public.toggle_user_log_category('20000000-0000-0000-0000-000000000001', 'favorite');
  raise exception 'anon must not execute toggle_user_log_category';
exception
  when insufficient_privilege then null;
end
$$;

do $$
begin
  perform public.remove_user_log_category('20000000-0000-0000-0000-000000000001', 'favorite');
  raise exception 'anon must not execute remove_user_log_category';
exception
  when insufficient_privilege then null;
end
$$;

do $$
begin
  update public.composers set bio = 'vandalised';
  if exists (select 1 from public.composers where bio = 'vandalised') then
    raise exception 'anon must not update composers';
  end if;
end
$$;

-- User A: atomic category RPCs -----------------------------------------------
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', false);

do $$
declare
  w1 constant uuid := '20000000-0000-0000-0000-000000000001';
  v_row public.user_logs;
begin
  select * into v_row from public.set_user_log_category(w1, 'heard', '{"place":"Philharmonie de Paris","date":"2026-01-10"}');
  if v_row.categories <> array['heard'] or v_row.details #>> '{heard,place}' <> 'Philharmonie de Paris' then
    raise exception 'set_user_log_category insert failed: % %', v_row.categories, v_row.details;
  end if;

  select * into v_row from public.set_user_log_category(w1, 'favorite', null);
  if v_row.categories <> array['heard', 'favorite'] or v_row.details #>> '{heard,place}' is null then
    raise exception 'adding a flag must keep other categories and details: % %', v_row.categories, v_row.details;
  end if;

  select * into v_row from public.set_user_log_category(w1, 'heard', '{}');
  if v_row.categories <> array['heard', 'favorite'] or v_row.details #>> '{heard,place}' is null then
    raise exception 're-adding heard with empty details must keep stored details';
  end if;

  select * into v_row from public.set_user_log_category(w1, 'heard', '{"place":"Opera de Paris"}');
  if v_row.details #>> '{heard,place}' <> 'Opera de Paris' or v_row.details #>> '{heard,date}' is not null then
    raise exception 'non-empty details must replace the category details: %', v_row.details;
  end if;

  perform public.toggle_user_log_category(w1, 'favorite');
  if (select categories from public.user_logs where work_id = w1) <> array['heard'] then
    raise exception 'toggle should remove an active flag';
  end if;

  perform public.toggle_user_log_category(w1, 'favorite');
  if (select categories from public.user_logs where work_id = w1) <> array['heard', 'favorite'] then
    raise exception 'toggle should add an inactive flag';
  end if;

  -- Toggle on a work without any log creates the row.
  perform public.toggle_user_log_category('20000000-0000-0000-0000-000000000003', 'alert');
  if (select categories from public.user_logs where work_id = '20000000-0000-0000-0000-000000000003') <> array['alert'] then
    raise exception 'toggle should create a missing row';
  end if;
  perform public.toggle_user_log_category('20000000-0000-0000-0000-000000000003', 'alert');
  if exists (select 1 from public.user_logs where work_id = '20000000-0000-0000-0000-000000000003') then
    raise exception 'toggling the last flag off should delete the row';
  end if;

  select * into v_row from public.remove_user_log_category(w1, 'heard');
  if v_row.categories <> array['favorite'] or v_row.details ? 'heard' then
    raise exception 'remove should drop category and its details: % %', v_row.categories, v_row.details;
  end if;

  perform public.remove_user_log_category(w1, 'favorite');
  if exists (select 1 from public.user_logs where work_id = w1) then
    raise exception 'row should be deleted when no category is left';
  end if;

  -- Removing on a missing row is a no-op.
  perform public.remove_user_log_category(w1, 'alert');
end
$$;

do $$
begin
  perform public.set_user_log_category('20000000-0000-0000-0000-000000000001', 'stolen', null);
  raise exception 'invalid category must be rejected';
exception
  when invalid_parameter_value then null;
end
$$;

do $$
begin
  perform public.set_user_log_category('20000000-0000-0000-0000-000000000001', 'heard', '"just a string"');
  raise exception 'non-object details must be rejected';
exception
  when invalid_parameter_value then null;
end
$$;

do $$
begin
  perform public.set_user_log_category(
    '20000000-0000-0000-0000-000000000001',
    'heard',
    jsonb_build_object('comment', (select string_agg(md5(i::text), '') from generate_series(1, 2000) i))
  );
  raise exception 'oversized details must be rejected';
exception
  when check_violation then null;
end
$$;

-- Data for isolation checks.
select public.set_user_log_category('20000000-0000-0000-0000-000000000002', 'alert', null);
insert into public.profile_notes (user_id, note) values ('00000000-0000-0000-0000-0000000000a1', 'note of A');
insert into public.composer_notes (user_id, composer_id, note)
values ('00000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-000000000001', 'composer note of A');

do $$
begin
  insert into public.profile_notes (user_id, note) values ('00000000-0000-0000-0000-0000000000a1', '');
  raise exception 'empty note must be rejected';
exception
  when check_violation then null;
end
$$;

-- User A: daily recommendation -------------------------------------------------
reset role;
insert into public.daily_recommendations (user_id, work_id, recommendation_date) values
  ('00000000-0000-0000-0000-0000000000a1', '20000000-0000-0000-0000-000000000001', current_date - 1),
  ('00000000-0000-0000-0000-0000000000a1', '20000000-0000-0000-0000-000000000002', current_date - 200),
  -- Older than 365 days: work 3 is eligible again.
  ('00000000-0000-0000-0000-0000000000a1', '20000000-0000-0000-0000-000000000003', current_date - 400);
set role authenticated;

do $$
declare
  v_first uuid;
  v_second uuid;
begin
  -- Random choice: repeat so a broken exclusion window cannot pass by luck.
  for i in 1..25 loop
    delete from public.daily_recommendations where recommendation_date = current_date;

    v_first := public.generate_daily_recommendation(current_date);
    if v_first <> '20000000-0000-0000-0000-000000000003' then
      raise exception 'recommendation must skip works recommended in the last 365 days, got %', v_first;
    end if;
  end loop;

  v_second := public.generate_daily_recommendation(current_date);
  if v_second <> v_first then
    raise exception 'recommendation must be stable for the same day';
  end if;

  if (select count(*) from public.daily_recommendations where recommendation_date = current_date) <> 1 then
    raise exception 'only one recommendation row per day';
  end if;
end
$$;

do $$
begin
  perform public.generate_daily_recommendation(current_date + 5);
  raise exception 'far-away days must be rejected';
exception
  when invalid_parameter_value then null;
end
$$;

-- User B: must not see or touch A's data ---------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', false);

do $$
begin
  if (select count(*) from public.user_logs) <> 0 then
    raise exception 'B must not read A logs';
  end if;
  if (select count(*) from public.profile_notes) <> 0 then
    raise exception 'B must not read A profile notes';
  end if;
  if (select count(*) from public.composer_notes) <> 0 then
    raise exception 'B must not read A composer notes';
  end if;
  if (select count(*) from public.daily_recommendations) <> 0 then
    raise exception 'B must not read A recommendations';
  end if;
  if (select count(*) from public.profiles) <> 1 then
    raise exception 'B must read only its own profile';
  end if;

  update public.profiles set display_name = 'hacked-by-b' where id = '00000000-0000-0000-0000-0000000000a1';
  delete from public.profile_notes;
  delete from public.user_logs;

  -- RPCs act on the caller only.
  perform public.remove_user_log_category('20000000-0000-0000-0000-000000000002', 'alert');
end
$$;

do $$
begin
  insert into public.user_logs (user_id, work_id, categories)
  values ('00000000-0000-0000-0000-0000000000a1', '20000000-0000-0000-0000-000000000003', array['heard']);
  raise exception 'B must not insert logs for A';
exception
  when insufficient_privilege then null;
end
$$;

do $$
begin
  update public.composers set bio = 'vandalised';
  if exists (select 1 from public.composers where bio = 'vandalised') then
    raise exception 'authenticated users must not update composers';
  end if;
end
$$;

-- Back as superuser: A's data is intact -----------------------------------------
reset role;

do $$
begin
  if (select display_name from public.profiles where id = '00000000-0000-0000-0000-0000000000a1') = 'hacked-by-b' then
    raise exception 'B updated A profile';
  end if;
  if not exists (
    select 1 from public.user_logs
    where user_id = '00000000-0000-0000-0000-0000000000a1'
      and work_id = '20000000-0000-0000-0000-000000000002'
      and categories = array['alert']
  ) then
    raise exception 'B changed or deleted A logs';
  end if;
  if (select count(*) from public.profile_notes) <> 1 then
    raise exception 'B deleted A notes';
  end if;
end
$$;

\o
\echo 'rls_test.sql: all checks passed'
