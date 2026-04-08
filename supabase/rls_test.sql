-- RLS verification checklist for Opus35
-- Run in Supabase SQL editor with test users already created.

-- 1) Inspect policies are enabled
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public' and tablename in ('profiles', 'user_logs', 'composers', 'works');

-- 2) Simulate user A context
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);

-- User A can read public catalog
select id, name from public.composers limit 5;
select id, title from public.works limit 5;

-- User A can only read own profile/logs
select * from public.profiles;
select * from public.user_logs;

-- Insert own profile/log should succeed if ids match
insert into public.profiles (id, display_name)
values ('00000000-0000-0000-0000-0000000000a1', 'user-a')
on conflict (id) do nothing;

-- 3) Simulate user B context
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b2', true);

-- User B should not update/delete user A profile
update public.profiles
set display_name = 'hacked-by-b'
where id = '00000000-0000-0000-0000-0000000000a1';

delete from public.profiles
where id = '00000000-0000-0000-0000-0000000000a1';

-- User B should not see user A logs
select * from public.user_logs where user_id = '00000000-0000-0000-0000-0000000000a1';

-- 4) Reset role config
select set_config('request.jwt.claim.sub', '', true);
