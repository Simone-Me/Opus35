alter table public.composers
add column if not exists bio text,
add column if not exists wikipedia_url text;

alter table public.user_logs
add column if not exists categories text[];

update public.user_logs
set categories = array[category]
where categories is null and category is not null;

alter table public.user_logs
alter column categories set default '{}',
alter column categories set not null;

alter table public.user_logs
drop constraint if exists user_logs_user_id_work_id_category_key;

alter table public.user_logs
add constraint user_logs_user_id_work_id_key unique (user_id, work_id);

alter table public.user_logs
drop constraint if exists categories_allowed_values;

alter table public.user_logs
add constraint categories_allowed_values
check (categories <@ array['heard', 'favorite', 'bought', 'alert']::text[]);

create index if not exists idx_user_logs_categories on public.user_logs using gin (categories);
create index if not exists idx_works_title_tsv on public.works using gin (to_tsvector('simple', title));

alter table public.user_logs
drop column if exists category;
