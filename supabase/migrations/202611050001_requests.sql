-- Run once in the existing LD LATTE project. No existing tables are removed.
begin;

create table public.requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (length(btrim(title)) > 0),
  description text not null check (length(btrim(description)) > 0),
  category text not null check (category in ('Бот', 'Интеграция', 'Отчёт', 'Другое')),
  status text not null default 'Новая' check (status in ('Новая', 'В работе', 'Завершена')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index requests_user_created_idx on public.requests (user_id, created_at desc);

create function public.set_request_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger requests_updated_at before update on public.requests
  for each row execute function public.set_request_updated_at();

alter table public.requests enable row level security;

create policy requests_select_own on public.requests
  for select to authenticated using ((select auth.uid()) = user_id);
create policy requests_insert_own on public.requests
  for insert to authenticated with check ((select auth.uid()) = user_id and status = 'Новая');
create policy requests_update_own on public.requests
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- No client delete permission. Identity/timestamps are not client-editable.
revoke all on public.requests from anon, authenticated;
grant select on public.requests to authenticated;
grant insert (id, user_id, title, description, category) on public.requests to authenticated;
grant update (title, description, category, status) on public.requests to authenticated;

commit;
