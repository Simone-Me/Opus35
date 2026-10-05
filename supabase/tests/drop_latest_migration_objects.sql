-- Rewinds a fresh schema.sql install to the state production had before
-- migrations/202610050001_hardening_rpc_views.sql, so the migration is tested
-- the way it will really run (new functions pick up default privileges).
drop view if exists public.works_index;
drop view if exists public.work_genres;
drop view if exists public.composer_epochs;
drop function if exists public.toggle_user_log_category(uuid, text);
drop function if exists public.set_user_log_category(uuid, text, jsonb);
drop function if exists public.remove_user_log_category(uuid, text);
drop function if exists public.generate_daily_recommendation(date);
alter table public.user_logs drop constraint if exists user_logs_details_shape;
alter table public.composers drop column if exists enrichment_attempted_at;
drop index if exists public.idx_works_title;
drop index if exists public.idx_works_genre;
drop index if exists public.idx_composers_name;
drop index if exists public.idx_composers_epoch;
