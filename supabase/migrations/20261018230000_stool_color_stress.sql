-- Цвет стула и уровень стресса в записи.
-- Запустить: Supabase → SQL Editor → вставить файл → Run.
alter table public.gut_entries add column if not exists color text
  check (color in ('brown', 'light', 'yellow', 'green', 'dark', 'red'));
alter table public.gut_entries add column if not exists stress smallint
  check (stress between 0 and 10);
