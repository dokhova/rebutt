-- Фото блюд: путь к файлу в Storage + приватный бакет meal-photos.
-- Файл лежит по пути <user_id>/<meal_id>.jpg — доступ только у владельца (RLS по первой папке пути).
-- Запустить: Supabase → SQL Editor → вставить файл → Run.

alter table public.meals add column if not exists photo_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('meal-photos', 'meal-photos', false, 1048576, array['image/jpeg'])
on conflict (id) do nothing;

drop policy if exists "own meal photos read" on storage.objects;
create policy "own meal photos read" on storage.objects
  for select to authenticated
  using (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "own meal photos insert" on storage.objects;
create policy "own meal photos insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "own meal photos update" on storage.objects;
create policy "own meal photos update" on storage.objects
  for update to authenticated
  using (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "own meal photos delete" on storage.objects;
create policy "own meal photos delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = auth.uid()::text);
