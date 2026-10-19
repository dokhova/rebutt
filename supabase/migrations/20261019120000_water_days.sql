-- Жидкость за день (мл) — раздел «Жидкости» на экране «+» и плитка на главной.
-- Запустить: Supabase → SQL Editor → вставить файл → Run.
create table if not exists public.water_days (
  user_id    uuid not null references auth.users (id) on delete cascade,
  day        date not null,
  ml         integer not null default 0 check (ml between 0 and 20000),
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

alter table public.water_days enable row level security;

drop policy if exists "own water days" on public.water_days;
create policy "own water days" on public.water_days
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
