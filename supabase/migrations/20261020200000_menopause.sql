-- Менопауза в профиле (раздел «Цикл»).
-- Запустить: Supabase → SQL Editor → вставить файл → Run.
alter table public.profiles add column if not exists menopause boolean not null default false;
