-- Рост и вес в профиле (по желанию). Нужны для личных ориентиров воды и клетчатки и для советов ИИ.
-- Запустить: Supabase → SQL Editor → вставить файл → Run.
alter table public.profiles add column if not exists height_cm smallint
  check (height_cm between 120 and 230);
alter table public.profiles add column if not exists weight_kg smallint
  check (weight_kg between 30 and 250);
