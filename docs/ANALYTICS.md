# Аналитика: словарь событий

Каждое событие уходит в **PostHog** и дублируется в **Supabase** → таблица `analytics_events` (`event`, `properties` jsonb, `screen`, `session_id`, `user_id`).
Код: `src/services/analytics.js`. Все вызовы `track()` — в методах `src/app/App.js` (одно действие пользователя → одно место в коде).

## Общие свойства (у всех событий)

| Свойство | Значение |
|---|---|
| `screen` | текущий экран: `onboarding_consent`, `onboarding_about`, `onboarding_goals`, `onboarding_cycle`, `today`, `add_entry`, `insights`, `profile`, `legal_terms` / `legal_privacy` / `legal_consent`, `meal`, `assistant` |
| `app_version` | версия из `src/config.js` |
| `is_demo` | `true`, если открыто с `?demo` |
| `platform` | `telegram` или `web` |
| `tg_language`, `tg_is_premium` | в PostHog при наличии Telegram user; id и username не передаются |

**Пользователь.** `distinct_id` = id пользователя Supabase (в Telegram — один и тот же для аккаунта на любом устройстве). После онбординга на персону ставятся свойства: `sex`, `age`, `has_height`, `has_weight` (сами рост и вес не передаются), `goals`, `goals_count`, `has_custom_goal`, `cycle_enabled`, `pregnant`, `coc`, `reminder_am`, `reminder_pm`, `onboarded_at`. Обновляются при изменении профиля.

**Экраны.** На каждый экран шлётся `$pageview` с `$current_url = …/#<screen>` — работает стандартная Web Analytics и Paths в PostHog.

## События

### Запуск и навигация
| Событие | Когда | Свойства |
|---|---|---|
| `app_opened` | открытие приложения | `is_returning`, `local_days` |
| `screen_viewed` | показ экрана (кроме онбординга) | `screen_name` |
| `nav_clicked` | переход между экранами | `to`, `from` (`today` / `add_entry` / `insights` / `profile`), `source` (`tab` / `avatar` / `back` / `empty_day` / `today_summary` — тап по показателю на главной) |
| `day_selected` | выбор дня: календарь в шапке «Сегодня» или неделя в инсайтах | `days_ago`, `direction` (`calendar` / `prev` / `next`), `has_data` |

### Онбординг
| Событие | Когда | Свойства |
|---|---|---|
| `onboarding_started` | показан первый шаг онбординга новому пользователю | — |
| `onboarding_skipped` | «Не сейчас» на шаге цикла | `step` (`cycle`) |
| `onboarding_step_viewed` | показ шага | `step`, `step_index` |
| `onboarding_step_completed` | «Дальше» на шаге | `step` + `sex`, `age`, `has_height`, `has_weight` (about) / `goals`, `goals_count`, `has_custom_goal` (goals) / `cycle_enabled`, `last_period` (cycle) |
| `onboarding_validation_error` | не заполнены имя/пол | `step`, `missing` |
| `onboarding_back` | кнопка «Назад» | `step` |
| `consent_checkbox_toggled` | клик по чекбоксу | `checked` |
| `consent_blocked` | «Продолжить» без галочки | — |
| `consent_accepted` | согласие принято | `version`, `documents` |
| `legal_doc_opened` | открыт документ (внутри приложения) | `doc` (`terms` / `privacy` / `consent`), `source` (`onboarding` / `profile` / `legal_link`) |
| `onboarding_completed` | онбординг завершён | свойства персоны + `skipped`, `duration_sec` |

### Запись дня (экран «+»)
| Событие | Когда | Свойства |
|---|---|---|
| `nav_clicked` (`to: add_entry`) | нажат «+» — показаны три карточки | `from` — экран под шторкой, `source` (`tab` / `empty_day`) |
| `add_section_opened` | выбрана карточка «+» | `section` (`stool` / `food` / `water`) |
| `add_sheet_closed` | «+» закрыли без сохранения («×», затемнение, крестик, «Назад») | — |
| `info_opened` | тап по «?» рядом с нормой или советом | `topic` (`fiber` / `water` / `targets` / `bristol` / `tips`), `screen` |
| `source_opened` | переход по ссылке на источник в карточке «?» | `source` (`who_fiber` / `efsa_water` / `heaton` / `nice_ibs` / `nhs_bowel`), `topic` |
| `water_changed` | ± жидкость в разделе «Жидкости» | `step_ml` (250, 150, 500, −250), `draft_ml` — сколько добавится к дню |
| `stool_status_selected` | «Был» / «Не было» | `value` (`had` / `none` / `cleared`) |
| `bristol_type_selected` | выбор типа | `bristol_type` 1–7 |
| `stool_color_selected` | выбор цвета стула | `color` (`brown` / `light` / `yellow` / `green` / `dark` / `red` / `cleared`), `where` (`form` — новая запись / `entry` — правка) |
| `stress_set` | ползунок стресса отпущен | `stress` 0–10, `where` |
| `symptom_toggled` | чип самочувствия | `symptom`, `selected` |
| `period_marked` | «Месячные» / «Месячных нет» | `value` |
| `food_photo_added` | выбрано фото блюда | `source`, `file_type`, `size_kb` |
| `food_photo_removed` | фото убрали до разбора | — |
| `food_analysis_requested` | «Разобрать с ИИ» | `has_photo`, `has_note` |
| `food_analysis_completed` | ИИ разобрал блюдо | `source` (`photo` / `text`), `has_note`, `tone`, `kcal`, `fiber`, `latency_ms` |
| `food_analysis_failed` | ошибка или не еда | `source`, `reason`, `latency_ms` |
| `food_reanalyzed` | пересчёт после «Уточнить» | `where` (`draft` — до сохранения / `saved` — сохранённое блюдо), `kcal` |
| `food_reanalyze_failed` | ошибка пересчёта | `where`, `reason` |
| `food_removed` | «Убрать» блюдо до сохранения | — |
| `meal_opened` | открыто сохранённое блюдо из «Записей дня» | — |
| `meal_deleted` | сохранённое блюдо удалено | — |
| `entry_opened` | открыта запись о стуле/самочувствии из «Записей дня» | — |
| `entry_updated` | запись исправлена | `stool_status`, `bristol_type`, `has_color`, `stress` |
| `entry_deleted` | запись удалена | — |
| `entry_save_blocked` | «Сохранить» без данных | `reason` |
| `food_autoanalyze_on_save` | нажали «Сохранить» с описанием/фото блюда без разбора — ИИ запускается сам | `has_photo` |
| `water_opened` | открыта запись «Жидкость» из «Записей дня» | `is_today` |
| `water_updated` | количество жидкости за день исправлено | `ml_before`, `ml_after`, `is_today` |
| `water_deleted` | запись о жидкости удалена | `is_today` |
| `period_deleted` | отметка «Месячные» убрана из «Записей дня» | — |
| `entry_saved` | запись сохранена | `stool_status`, `bristol_type`, `symptoms`, `symptoms_count`, `has_food`, `food_source`, `food_tone`, `period_mark`, `water_ml_added`, `water_ml_day`, `gut_score`, `score_before`, `score_delta`, `days_logged_last7`, `hour` |
| `first_entry_saved` | первая запись пользователя | как у `entry_saved` |

### «На главный экран»
| Событие | Когда | Свойства |
|---|---|---|
| `home_prompt_shown` | показана модалка (Telegram на телефоне, Bot API 8.0+, есть хотя бы одна запись, ярлыка нет, не откладывали) | `os` (`ios` / `android`), `status` (`missed` / `unknown` — ответ `checkHomeScreenStatus`) |
| `home_prompt_add_clicked` | «Добавить на экран» | `os` |
| `home_prompt_added` | Telegram сообщил, что ярлык добавлен (`homeScreenAdded`) | — |
| `home_prompt_dismissed` | модалку закрыли | `how` (`later` — «Напомнить позже», 3 дня / `close` — крестик или затемнение, 14 дней / `back` — «Назад», 14 дней) |

### ИИ и инсайты
| Событие | Когда | Свойства |
|---|---|---|
| `ai_insights_generated` | получен совет дня + наблюдение | `latency_ms`, `days_count` |
| `ai_insights_failed` | ошибка | `error` |
| `assistant_opened` | открыта панель ИИ-помощника | `from` (`dock` — круглая кнопка рядом с меню) |
| `assistant_image_attached` | к вопросу приложено фото | `file_type`, `size_kb` |
| `ai_question_asked` | вопрос помощнику | `source` (`suggestion` / `custom`), `turn` (номер сообщения в диалоге), `length`, `has_image` |
| `ai_answer_received` | ответ получен | `source`, `latency_ms`, `answer_length` |
| `ai_answer_failed` | ошибка | `source`, `error` |

### Профиль
| Событие | Когда | Свойства |
|---|---|---|
| `profile_updated` | изменения профиля (с задержкой 0,7 с) | `fields` (в т. ч. `height`, `weight` — только названия полей, без значений) |
| `cycle_toggled` | переключатель цикла | `enabled` |
| `cycle_option_toggled` | беременность / КОК (онбординг и профиль) | `option` (`pregnant` / `coc`), `enabled` |
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
6. **Ярлык на экране «Домой»:** воронка `home_prompt_shown` → `home_prompt_add_clicked` → `home_prompt_added` с разбивкой по `os`.
7. **Документы и поддержка:** `legal_doc_opened` по `doc`, `support_clicked`.

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
