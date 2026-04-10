alter table public.composers
add column if not exists bio text,
add column if not exists wikipedia_url text;

alter table public.user_logs
add column if not exists categories text[];

do $$
begin
	if exists (
		select 1
		from information_schema.columns
		where table_schema = 'public'
			and table_name = 'user_logs'
			and column_name = 'category'
	) then
		update public.user_logs
		set categories = array[category]
		where categories is null and category is not null;
	end if;

	update public.user_logs
	set categories = '{}'::text[]
	where categories is null;
end
$$;

do $$
begin
	if exists (
		select 1
		from public.user_logs
		group by user_id, work_id
		having count(*) > 1
	) then
		with merged as (
			select
				min(ul.id) as keep_id,
				ul.user_id,
				ul.work_id,
				coalesce(
					array_agg(distinct cats.category) filter (where cats.category is not null),
					'{}'::text[]
				) as merged_categories
			from public.user_logs ul
			left join lateral unnest(coalesce(ul.categories, '{}'::text[])) as cats(category) on true
			group by ul.user_id, ul.work_id
		),
		updated as (
			update public.user_logs ul
			set categories = m.merged_categories
			from merged m
			where ul.id = m.keep_id
				and ul.categories is distinct from m.merged_categories
		)
		delete from public.user_logs ul
		using merged m
		where ul.user_id = m.user_id
			and ul.work_id = m.work_id
			and ul.id <> m.keep_id;
	end if;
end
$$;

alter table public.user_logs
alter column categories set default '{}',
alter column categories set not null;

alter table public.user_logs
drop constraint if exists user_logs_user_id_work_id_category_key;

do $$
begin
	if not exists (
		select 1
		from pg_constraint
		where conname = 'user_logs_user_id_work_id_key'
			and conrelid = 'public.user_logs'::regclass
	) then
		alter table public.user_logs
		add constraint user_logs_user_id_work_id_key unique (user_id, work_id);
	end if;
end
$$;

alter table public.user_logs
drop constraint if exists categories_allowed_values;

alter table public.user_logs
add constraint categories_allowed_values
check (categories <@ array['heard', 'favorite', 'bought', 'alert']::text[]);

create index if not exists idx_user_logs_categories on public.user_logs using gin (categories);
create index if not exists idx_works_title_tsv on public.works using gin (to_tsvector('simple', title));

alter table public.user_logs
drop column if exists category;
