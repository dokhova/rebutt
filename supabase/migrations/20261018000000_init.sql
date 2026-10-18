-- Схема данных трекера кишечника.
-- Запустить: Supabase → SQL Editor → вставить файл целиком → Run
-- (или `supabase db push`, если используете Supabase CLI).
-- Перед этим: Authentication → Sign In / Providers → включить «Allow anonymous sign-ins».

create extension if not exists pgcrypto;

-- ---------- Профиль (онбординг + настройки) ----------
create table if not exists public.profiles (
  id               uuid primary key references auth.users (id) on delete cascade,
  name             text,
  age              smallint check (age between 0 and 120),
  sex              text check (sex in ('f', 'm')),
  goals            text[] not null default '{}',
  goal_other       text,
  cycle_enabled    boolean not null default false,
  cycle_last_start date,
  cycle_length     smallint not null default 28 check (cycle_length between 15 and 60),
  reminder_am      boolean not null default true,
  reminder_pm      boolean not null default false,
  onboarded_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ---------- Согласия с документами (журнал, для подтверждения) ----------
create table if not exists public.consents (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  document    text not null check (document in ('terms', 'privacy', 'consent')),
  version     text not null,
  accepted_at timestamptz not null default now(),
  user_agent  text
);
create index if not exists consents_user_idx on public.consents (user_id);

-- ---------- Записи о стуле и самочувствии ----------
create table if not exists public.gut_entries (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  day          date not null,
  time         time not null,
  stool        text check (stool in ('had', 'none')),         -- null = отметили только самочувствие
  bristol_type smallint check (bristol_type between 1 and 7),
  symptoms     text[] not null default '{}',
  created_at   timestamptz not null default now()
);
create index if not exists gut_entries_user_day_idx on public.gut_entries (user_id, day);

-- ---------- Еда (результат ИИ-разбора; фото не храним) ----------
create table if not exists public.meals (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  day        date not null,
  time       time not null,
  name       text not null,
  kcal       integer,
  fiber      numeric(5,1),
  verdict    text,
  tone       text check (tone in ('calm', 'mild', 'sens')),
  tip        text,
  source     text not null default 'photo' check (source in ('photo', 'example')),
  created_at timestamptz not null default now()
);
create index if not exists meals_user_day_idx on public.meals (user_id, day);

-- ---------- Дни месячных, отмеченные вручную ----------
create table if not exists public.period_days (
  user_id    uuid not null references auth.users (id) on delete cascade,
  day        date not null,
  created_at timestamptz not null default now(),
  primary key (user_id, day)
);

-- ---------- Аналитика (дубль событий PostHog) ----------
create table if not exists public.analytics_events (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  event       text not null,
  properties  jsonb not null default '{}',
  screen      text,
  session_id  text,
  app_version text,
  client_ts   timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists analytics_events_event_idx on public.analytics_events (event, created_at desc);
create index if not exists analytics_events_user_idx  on public.analytics_events (user_id, created_at desc);

-- ---------- RLS: каждый видит и меняет только своё ----------
alter table public.profiles         enable row level security;
alter table public.consents         enable row level security;
alter table public.gut_entries      enable row level security;
alter table public.meals            enable row level security;
alter table public.period_days      enable row level security;
alter table public.analytics_events enable row level security;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for all to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "own consents read" on public.consents;
create policy "own consents read" on public.consents
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "own consents insert" on public.consents;
create policy "own consents insert" on public.consents
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "own consents delete" on public.consents;
create policy "own consents delete" on public.consents
  for delete to authenticated using (user_id = auth.uid());

drop policy if exists "own gut entries" on public.gut_entries;
create policy "own gut entries" on public.gut_entries
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own meals" on public.meals;
create policy "own meals" on public.meals
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own period days" on public.period_days;
create policy "own period days" on public.period_days
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- события: пользователь может только писать свои и удалять (при «Удалить все данные»)
drop policy if exists "own events insert" on public.analytics_events;
create policy "own events insert" on public.analytics_events
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "own events delete" on public.analytics_events;
create policy "own events delete" on public.analytics_events
  for delete to authenticated using (user_id = auth.uid());

-- ---------- Удобные вьюхи для аналитики (смотреть в SQL Editor, под service role) ----------
create or replace view public.daily_active_users with (security_invoker = true) as
  select date_trunc('day', created_at)::date as day, count(distinct user_id) as dau
  from public.analytics_events group by 1 order by 1 desc;

create or replace view public.onboarding_funnel with (security_invoker = true) as
  select
    count(distinct user_id) filter (where event = 'app_opened')           as opened,
    count(distinct user_id) filter (where event = 'onboarding_started')   as started,
    count(distinct user_id) filter (where event = 'consent_accepted')     as consented,
    count(distinct user_id) filter (where event = 'onboarding_completed') as completed,
    count(distinct user_id) filter (where event = 'first_entry_saved')    as first_entry
  from public.analytics_events;
