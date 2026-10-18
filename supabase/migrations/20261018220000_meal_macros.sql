-- КБЖУ и комментарий к блюду.
-- Запустить: Supabase → SQL Editor → вставить файл → Run.
alter table public.meals add column if not exists protein numeric(6,1);
alter table public.meals add column if not exists fat numeric(6,1);
alter table public.meals add column if not exists carbs numeric(6,1);
alter table public.meals add column if not exists note text;
alter table public.meals drop constraint if exists meals_source_check;
alter table public.meals add constraint meals_source_check check (source in ('photo', 'text', 'example'));
