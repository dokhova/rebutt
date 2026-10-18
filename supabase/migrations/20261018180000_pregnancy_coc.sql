-- Беременность и КОК в профиле.
-- Запустить: Supabase → SQL Editor → вставить файл → Run.
alter table public.profiles add column if not exists pregnant boolean not null default false;
alter table public.profiles add column if not exists coc boolean not null default false;
