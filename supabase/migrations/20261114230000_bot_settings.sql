-- Настройки бота: сейчас только file_id картинки приветствия.
-- Telegram отдаёт уже загруженную картинку по file_id мгновенно, а по ссылке каждый раз скачивает её заново.
-- Доступ — только у сервера (secret key); RLS включён, политик нет — из приложения таблица не видна.
create table if not exists public.bot_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table public.bot_settings enable row level security;
