-- Начало месячных указано примерно («2–3 недели назад»): день цикла не показываем числом,
-- первая отметка месячных уточняет начало цикла.
-- Запустить: Supabase → SQL Editor → вставить файл → Run.
alter table public.profiles add column if not exists cycle_last_approx boolean not null default false;
