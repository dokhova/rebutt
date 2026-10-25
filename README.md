# [название] — трекер кишечника

Мобильное веб-приложение: дневник стула по Бристольской шкале, самочувствие, жидкость за день, менструальный цикл, разбор еды по фото через ИИ, инсайты и показатель «работа кишечника» в процентах.

| | |
|---|---|
| Фронт | Vite, vanilla JS, свой мини-рантайм шаблонов на [morphdom](https://github.com/patrick-steele-idem/morphdom) — без React |
| Бэк | серверные функции Vercel в `api/` → OpenAI |
| Данные | Supabase: Postgres + анонимная авторизация + RLS |
| Аналитика | PostHog + дубль событий в Supabase |

Как устроен код — **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**. События аналитики — **[docs/ANALYTICS.md](docs/ANALYTICS.md)**.

## Быстрый старт

```bash
npm install
cp .env.example .env.local   # заполнить ключи
npx vercel dev               # фронт + /api на http://localhost:3000
```

`npm run dev` поднимает только фронт (Vite, порт 5173): интерфейс работает, ИИ — нет.
Без ключей вообще приложение тоже запускается: данные хранятся только в браузере, аналитика выключена.

| Команда | Что делает |
|---|---|
| `npm run dev` | фронт с hot reload |
| `npm run build` | сборка в `dist/` |
| `npm run lint` | ESLint |
| `npm test` | тесты расчётов (`tests/`, встроенный `node:test`) |
| `npm run check` | lint + test + build — перед коммитом |

## Режимы

- **Обычный** — реальная дата, данные пользователя, ИИ через `/api`.
- **Демо** — `/?demo`: онбординг; `/?demo#today`, `#insights`, `#profile` — сразу экран с тестовой неделей 20–26 сентября 2026; `#add` — главная с открытым выбором «+». Ответы ИИ — заглушки, ничего не сохраняется. Для показов и юзер-тестов.

## Деплой

### 1. Supabase
1. Создать проект.
2. **Authentication → Sign In / Providers → Allow anonymous sign-ins: ON** — для входа из обычного браузера. Провайдер **Email** должен быть включён (по умолчанию включён) — через него работает вход по Telegram.
3. **SQL Editor** → выполнить по очереди все файлы из `supabase/migrations/` (по возрастанию даты в имени).
4. **Project Settings → API Keys** → скопировать `Publishable key` (`sb_publishable_…`) и `Secret key` (`sb_secret_…`). Project URL — `https://<id проекта>.supabase.co`.

### 2. PostHog
**Project settings** → Project API key (`phc_…`) и регион (EU / US).

### 3. Vercel
1. **Add New → Project → Import** репозиторий с GitHub. Framework определится как Vite.
2. **Settings → Environment Variables** — всё из `.env.example`. Тип **Secret** для `OPENAI_API_KEY`, `TELEGRAM_BOT_TOKEN`, `SUPABASE_SECRET_KEY` (без префикса `VITE_` — они не попадают в браузер). Остальные — **Config**.
3. Deploy. После изменения переменных — Redeploy.
4. Проверка: открыть `https://<домен>/api/health?openai=1` — все поля `true`, `openai_check: "ok"`.

### 4. Telegram
@BotFather → `/mybots` → бот → **Bot Settings → Menu Button** → URL приложения.
В Telegram пользователь входит по своему аккаунту (`/api/auth/telegram`): данные привязаны к Telegram id, имя и аватар берутся из Telegram.

## Где что менять

| Что | Где |
|---|---|
| Название приложения | `src/config.js` → `APP_NAME` и `[название]` в `public/legal/*.html` |
| Версия | `package.json` → `version` (попадает в профиль и аналитику) |
| Ссылка поддержки | `src/config.js` → `SUPPORT_URL` |
| Тексты документов | `public/legal/*.html`; после правки поднять `LEGAL_VERSION` в `src/config.js` |
| Цели, симптомы, типы стула, блюда-примеры | `src/domain/catalog.js` |
| Формула «работы кишечника» | `src/domain/score.js` |
| Нормы клетчатки (ВОЗ) и воды (EFSA) | `src/domain/targets.js` |
| Источники норм и советов, тексты карточек «?» | `src/domain/sources.js` |
| Кнопки «Стакан / Чашка / Бутылка» | `src/domain/catalog.js` → `WATER_STEPS` |
| Что ИИ знает о пользователе | `src/domain/ai-context.js` |
| Подсказки «Что может помочь» на главной | `src/domain/suggestions.js` |
| Цвета, шрифты | `src/styles/tokens.css` |
| Промпты ИИ | `api/ask.js`, `api/food.js`, `api/insights.js`; общие правила — `SAFETY` в `api/_lib/openai.js` |
| Модель ИИ | переменная `OPENAI_MODEL` (по умолчанию `gpt-5-mini`) |

## Юридическое

- Пока приложение бесплатное, отдельная оферта не нужна: пользовательское соглашение оформлено как оферта на бесплатное использование. Для платных функций понадобится отдельная оферта (цена, оплата, возвраты).
- Документы в `public/legal/` заполнены (оператор — ИП Дохова А. М., Грузия). Перед публичным запуском показать юристу. Документы открываются внутри приложения (экран `legal`), текст берётся из этих же файлов.
- Для пользователей из РФ (152-ФЗ) первичная запись персональных данных должна идти в базу на территории РФ. Supabase, PostHog и OpenAI — за рубежом; это нужно решить до масштабирования.
- Минимальный возраст — 18 лет.

## Что не сделано

- Напоминания утром и вечером сохраняются в профиль, но не отправляются (нет push и рассылок в Telegram).
- Вне Telegram аккаунт анонимный и привязан к браузеру; связать его с Telegram-аккаунтом пока нельзя.
- Лимит запросов в `/api` хранится в памяти инстанса. При росте нагрузки заменить на Redis (например, Upstash).
