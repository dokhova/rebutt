# Аналитика: словарь событий

Каждое событие уходит в **PostHog** и дублируется в **Supabase** → таблица `analytics_events` (`event`, `properties` jsonb, `screen`, `session_id`, `user_id`).
Код: `src/services/analytics.js`. Все вызовы `track()` — в методах `src/app/App.js` (одно действие пользователя → одно место в коде).

## Общие свойства (у всех событий)

| Свойство | Значение |
|---|---|
| `screen` | текущий экран: `onboarding_welcome`, `onboarding_consent`, `onboarding_about`, `onboarding_goals`, `onboarding_cycle`, `today`, `add_entry`, `insights`, `profile` |
| `app_version` | версия из `src/config.js` |
| `is_demo` | `true`, если открыто с `?demo` |
| `platform` | `web` |

**Пользователь.** `distinct_id` = id анонимного пользователя Supabase. После онбординга на персону ставятся свойства: `sex`, `age`, `goals`, `goals_count`, `has_custom_goal`, `cycle_enabled`, `reminder_am`, `reminder_pm`, `onboarded_at`. Обновляются при изменении профиля.

**Экраны.** На каждый экран шлётся `$pageview` с `$current_url = …/#<screen>` — работает стандартная Web Analytics и Paths в PostHog.

## События

### Запуск и навигация
| Событие | Когда | Свойства |
|---|---|---|
| `app_opened` | открытие приложения | `is_returning`, `local_days` |
| `screen_viewed` | показ экрана (кроме онбординга) | `screen_name` |
| `nav_clicked` | переход между экранами | `to`, `from` (`today` / `add_entry` / `insights` / `profile`), `source` (`tab` / `avatar` / `back` / `empty_day`) |
| `day_selected` | выбор дня в неделе | `days_ago`, `has_data` |

### Онбординг
| Событие | Когда | Свойства |
|---|---|---|
| `onboarding_started` | «Начать» на приветствии | — |
| `onboarding_skipped` | «Пропустить» / «Не сейчас» | `step` (`welcome` / `cycle`) |
| `onboarding_step_viewed` | показ шага | `step`, `step_index` |
| `onboarding_step_completed` | «Дальше» на шаге | `step` + `sex`, `age` (about) / `goals`, `goals_count`, `has_custom_goal` (goals) / `cycle_enabled`, `last_period` (cycle) |
| `onboarding_validation_error` | не заполнены имя/пол | `step`, `missing` |
| `onboarding_back` | кнопка «Назад» | `step` |
| `consent_checkbox_toggled` | клик по чекбоксу | `checked` |
| `consent_blocked` | «Продолжить» без галочки | — |
| `consent_accepted` | согласие принято | `version`, `documents` |
| `legal_doc_opened` | открыт документ | `doc` (`terms` / `privacy` / `consent`), `source` (`onboarding` / `profile`) |
| `onboarding_completed` | онбординг завершён | свойства персоны + `skipped`, `duration_sec` |

### Запись дня (экран «+»)
| Событие | Когда | Свойства |
|---|---|---|
| `stool_status_selected` | «Был» / «Не было» | `value` (`had` / `none` / `cleared`) |
| `bristol_type_selected` | выбор типа | `bristol_type` 1–7 |
| `symptom_toggled` | чип самочувствия | `symptom`, `selected` |
| `period_marked` | «Месячные» / «Месячных нет» | `value` |
| `food_photo_added` | загружено фото / «на примере» | `source` (`photo` / `example`), `file_type`, `size_kb` |
| `food_analysis_completed` | ИИ разобрал блюдо | `source`, `verdict`, `tone`, `kcal`, `fiber`, `latency_ms` |
| `food_analysis_failed` | ошибка или не еда | `reason`, `latency_ms` |
| `food_removed` | убрали фото | — |
| `entry_save_blocked` | «Сохранить» без данных | `reason` |
| `entry_saved` | запись сохранена | `stool_status`, `bristol_type`, `symptoms`, `symptoms_count`, `has_food`, `food_source`, `food_tone`, `period_mark`, `gut_score`, `score_before`, `score_delta`, `days_logged_last7`, `hour` |
| `first_entry_saved` | первая запись пользователя | как у `entry_saved` |

### ИИ и инсайты
| Событие | Когда | Свойства |
|---|---|---|
| `ai_insights_generated` | получен совет дня + наблюдение | `latency_ms`, `days_count` |
| `ai_insights_failed` | ошибка | `error` |
| `ai_question_asked` | вопрос ИИ | `source` (`suggestion` / `custom`), `length` |
| `ai_answer_received` | ответ получен | `source`, `latency_ms`, `answer_length` |
| `ai_answer_failed` | ошибка | `source`, `error` |

### Профиль
| Событие | Когда | Свойства |
|---|---|---|
| `profile_updated` | изменения профиля (с задержкой 0,7 с) | `fields` |
| `cycle_toggled` | переключатель цикла | `enabled` |
| `reminder_toggled` | напоминания | `slot` (`morning` / `evening`), `enabled` |
| `export_clicked` | экспорт | `format` (`csv` / `pdf_report`), `rows` / `days` |
| `support_clicked` | «Написать в Telegram» | `source` |
| `data_deleted` / `data_delete_cancelled` | «Удалить все данные» | — |

## Что собрать в PostHog

1. **Воронка онбординга:** `app_opened` → `onboarding_started` → `consent_accepted` → `onboarding_step_completed (step=about)` → `onboarding_completed` → `first_entry_saved`.
2. **Активация:** доля `onboarding_completed`, сделавших `entry_saved` в течение 24 ч.
3. **Удержание:** Retention по `entry_saved` (день 1 / 7 / 21 — обещание «за 21 день»).
4. **Использование ИИ:** тренды `food_analysis_completed`, `ai_question_asked`; медиана `latency_ms`; доля `*_failed`.
5. **Качество дня:** среднее `gut_score` из `entry_saved` по неделям; разбивка по `food_tone`.
6. **Документы и поддержка:** `legal_doc_opened` по `doc`, `support_clicked`.

## SQL в Supabase

Вьюхи из миграции: `daily_active_users`, `onboarding_funnel`. Примеры:

```sql
-- топ событий за 7 дней
select event, count(*) from analytics_events
where created_at > now() - interval '7 days' group by 1 order by 2 desc;

-- средний показатель кишечника по дням
select date_trunc('day', created_at)::date d, avg((properties->>'gut_score')::int)
from analytics_events where event = 'entry_saved' group by 1 order by 1;
```
