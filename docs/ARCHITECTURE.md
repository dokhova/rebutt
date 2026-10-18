# Архитектура

## Структура

```
index.html                     оболочка страницы, подключает src/main.js
src/
  main.js                      точка входа: стили, аналитика, регистрация шаблонов, mount
  config.js                    название, версия, поддержка, документы, переменные окружения
  core/
    runtime.js                 мини-рантайм: шаблоны + morphdom (см. ниже)
    id.js                      UUID
  domain/                      чистая логика, без DOM и сети — покрыта тестами
    dates.js                   ключи дней 'YYYY-MM-DD', сдвиги, русские названия
    catalog.js                 справочники: типы стула, цели, симптомы, блюда-примеры
    score.js                   «работа кишечника» %, тоны состояния
    cycle.js                   день и фаза цикла
    profile.js                 модель профиля, шаги онбординга, свойства для аналитики
    ai-context.js              сводка за 14 дней для ИИ
    demo.js                    данные демо-режима
  app/
    App.js                     корневой компонент: состояние + все действия пользователя
  views/                       view-функции: состояние → значения для шаблона экрана
                               (ask.js — общий блок «Спросить ИИ», legal.js — документ)
    index.js                   экран → view
    shell.js                   общее: нижнее меню, тост, фон
    onboarding.js today.js add-entry.js insights.js profile.js
  templates/
    app.html                   оболочка: фон, контейнер экрана, меню, тост
    screens/*.html             разметка экранов
    partials/ask.html          блок «Спросить ИИ» (на «Сегодня» и в «Инсайтах»)
    components/*.html          разметка компонентов Gut и Pebble
  components/                  Gut.js (иллюстрация кишечника), Pebble.js (иконка типа стула)
  services/                    всё, что ходит наружу
    supabase.js                клиент и анонимный вход
    store.js                   профиль и записи: localStorage + Supabase
    telegram.js                SDK Telegram, ссылки, BackButton, безопасные свойства аналитики
    analytics.js               PostHog + дубль событий в Supabase
    ai.js                      запросы к /api
    image.js                   сжатие фото перед отправкой в ИИ
    export.js                  CSV и отчёт для врача
  styles/
    tokens.css                 цвета, шрифты (CSS-переменные)
    base.css                   сброс, утилиты, анимации
    components.css             общие элементы: кнопки, карточки, чипы, меню
    screens.css                элементы конкретных экранов
api/                           серверные функции Vercel (Node)
  _lib/openai.js               вызов OpenAI со structured output, проверка JWT Supabase, лимит запросов
  food.js ask.js insights.js   ИИ
  auth/telegram.js             вход по Telegram-аккаунту
  health.js                    диагностика настроек
public/
  img/                         иллюстрации кишечника по состояниям
  legal/                       документы (статичные страницы)
supabase/migrations/           SQL-схема с RLS
tests/                         тесты domain/
```

## Поток данных

```
действие пользователя
  → обработчик из view (onClick="{{…}}")
  → метод App (src/app/App.js): меняет state, отправляет событие аналитики, пишет в store
  → setState → перерисовка в следующем микротаске
  → App.view() = shellView + view текущего экрана
  → шаблон экрана → DOM (morphdom обновляет только изменившееся)
```

Правила, которые держат код в порядке:

- **domain** не знает про DOM, state и сеть. Всё, что можно посчитать, считается там.
- **views** только готовят значения для шаблона: форматируют, выбирают классы, привязывают обработчики к методам App. Состояние не меняют.
- **App** — единственное место, где меняется состояние и отправляются события аналитики.
- **services** — единственное место, где есть `fetch`, Supabase, PostHog и `localStorage` (кроме кэша инсайтов в App).
- **Стили** — только классы из `src/styles`. Инлайн-стили в шаблонах — только для значений, вычисляемых на лету (высота столбика, цвет фона, размер компонента).

## Мини-рантайм шаблонов

`src/core/runtime.js` — около 200 строк, описание синтаксиса в шапке файла. Коротко:

```html
<div class="{{cls}}">{{text}}</div>
<button onClick="{{save}}">Сохранить</button>
<sc-if value="{{hasScore}}">…</sc-if>
<sc-for list="{{rings}}" as="r">{{r.label}}</sc-for>
<sc-include name="today"></sc-include>                  <!-- фрагмент из templates/screens -->
<sc-component name="Gut" tone="calm" size="260"></sc-component>
```

В шаблоне только подстановки путей (`a.b.c`), без выражений: всю логику держим во view.
Каждый `setState` перестраивает виртуальное дерево и сравнивает его с DOM через morphdom. Для приложения такого размера этого достаточно; при росте можно перейти на Preact или Lit, а view-функции перенести почти без изменений.

## Хранение данных

- Записи дня (`log`) — объект `{ 'YYYY-MM-DD': { gut: [], meals: [], period } }`, формат описан в `src/domain/score.js`.
- После онбординга всё сохраняется в `localStorage` (`gt_state_v1`) и параллельно в Supabase: каждая запись — отдельной строкой, профиль — upsert с задержкой 0,7 с.
- При запуске локальные и серверные записи объединяются по `id` (`store.mergeLogs`).
- Фото еды в базу не сохраняются: только результат разбора.
- Без Supabase или в демо-режиме `supabase === null`, все функции store молча работают только локально.

## Серверные функции

| Эндпоинт | Вход | Выход |
|---|---|---|
| `POST /api/food` | `{ image: dataURL, goals }` | `{ is_food, name, kcal, fiber, verdict, tone, tip }` |
| `POST /api/ask` | `{ question, context }` | `{ answer }` |
| `POST /api/insights` | `{ context }` | `{ tip_title, tip_text, noticed }` |

`context` строит `domain/ai-context.js`. Ответы модели приходят строго по JSON-схеме (structured outputs).
Если Supabase настроен, запрос без валидного JWT пользователя получит 401. Лимит — `AI_RATE_LIMIT_PER_MIN` запросов в минуту на пользователя.

## Как добавить…

**Экран:** шаблон `templates/screens/x.html` → `views/x.js` → строка в `views/index.js` → `registerPartial('x', …)` в `main.js` → `<sc-if value="{{is.x}}">` в `templates/app.html` и флаг в `views/shell.js` → имя для аналитики в `SCREEN_EVENT_NAME` в `App.js`.

**Событие аналитики:** вызвать `track('name', {…})` в методе App и дописать строку в `docs/ANALYTICS.md`.

**Поле профиля:** `domain/profile.js` (`blankProfile`) → колонка в новой миграции `supabase/migrations/` → `profileToRow` и `rowToProfile` в `services/store.js`.

## Правила интерфейса

- **Контраст.** Текст — не ниже 4.5:1 к фону (WCAG AA), рамки полей, чипов и чекбоксов — не ниже 3:1 (`--line-control`). Новые цвета проверять по этим порогам.
- **Шрифт.** Системный (SF Pro / Roboto / Segoe UI), без внешних шрифтов. Минимальный размер текста — 13px.
- **Цвет только для смысла.** Зелёный/фиолетовый — состояние кишечника, лайм — главное действие и выбор, красный — удаление. Декоративных градиентов, свечений и текстур нет.
- **Числа честные.** Нет данных — показываем «—», а не 0.
- **Текст поверх картинки** — только светлый (`--ink`), не серый.

## Telegram Mini App

SDK инициализируется перед аналитикой (`src/services/telegram.js`). Старые клиенты получают только поддерживаемые вызовы SDK.

**Вход.** В Telegram клиент отправляет `Telegram.WebApp.initData` на `POST /api/auth/telegram`. Сервер проверяет подпись токеном бота (`api/_lib/telegram.js`), находит или создаёт пользователя Supabase с техническим email `tg<id>@users.rebutt.app` и возвращает сессию. Так данные привязаны к Telegram-аккаунту, а не к хранилищу WebView. Вне Telegram — анонимный вход Supabase.

**Загрузка.** Пока не известно, есть ли профиль на сервере, показывается экран загрузки (`booting`, не дольше 6 с) — чтобы вернувшийся пользователь не видел онбординг.

**ИИ.** Запросы к `/api/*` несут и JWT Supabase, и `X-Telegram-Init-Data`. Сервер принимает любой из них (`requireUser` в `api/_lib/openai.js`).

**Профиль.** Имя по умолчанию и аватар берутся из `initDataUnsafe.user` (аватар не сохраняется в базе).

**Назад.** Нативная BackButton видна, когда есть куда возвращаться: открыт документ, профиль или не первый шаг онбординга (`App.canGoBack` / `App.back`).

**Документы** открываются внутри приложения (экран `legal`): текст берётся из `<main>` файлов `public/legal/*.html` (`src/services/legal.js`) и вставляется через привязку `html="{{…}}"`. Ссылки между документами тоже открываются внутри, остальные — через `openLink` / `openTelegramLink`.

**Экспорт.** CSV создаётся через Blob, отчёт — через окно печати; в Telegram WebView это ненадёжно, поэтому внутри Telegram показывается просьба открыть приложение в браузере.

**Диагностика.** `GET /api/health?openai=1` показывает, какие переменные окружения заданы, и проверяет ключ OpenAI.
