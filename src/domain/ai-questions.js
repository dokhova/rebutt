// Подсказки-вопросы в шторке «Спросить ИИ»: собраны из записей человека за последние 7 дней,
// чтобы первый вопрос был про его неделю, а не общий. Порядок — по приоритету, максимум 3.
// Если данных мало, добиваем вопросами по целям из профиля, потом — общими (AI_SUGGESTED_QUESTIONS).
// Тон мягкий: спрашиваем «почему / как», без диагнозов и тревожных слов.

import { AI_SUGGESTED_QUESTIONS, SYMPTOM_OK } from './catalog.js';
import { weekComfort, fiberOf } from './score.js';
import { dailyTargets } from './targets.js';
import { cycleDay, cycleHint, isPeriodDay } from './cycle.js';

const MAX = 3;
const WEEK = 7;
/** На сколько процентов должен сдвинуться комфорт к прошлой неделе, чтобы спросить «почему» */
const TREND_PTS = 8;
/** Сколько дней за неделю должен повториться признак, чтобы о нём спросить */
const REPEAT_DAYS = 2;

const SYMPTOM_Q = {
  'Вздутие': 'Отчего у меня бывает вздутие?',
  'Тяжесть': 'Откуда у меня тяжесть в животе?',
  'Боль': 'Когда у меня чаще болит живот?',
  'Газы': 'Из-за чего у меня бывают газы?'
};

const GOAL_Q = {
  stool: 'Что поможет наладить мой стул?',
  bloat: 'Как мне уменьшить вздутие?',
  food: 'Какая еда влияет на меня сильнее всего?',
  weight: 'Как питание влияет на мой кишечник?'
};

/**
 * @param profile — профиль (domain/profile.js)
 * @param log     — записи { 'YYYY-MM-DD': DayRecord }
 * @param todayK  — сегодня
 * @param addDays — dates.addDays (передаём, чтобы не тянуть даты в тесты отдельно)
 * @returns string[] — до 3 вопросов
 */
export function aiQuestions(profile, log, todayK, addDays) {
  const out = [];
  const add = (q) => { if (q && out.length < MAX && !out.includes(q)) out.push(q); };
  const days = Array.from({ length: WEEK }, (_, i) => log[addDays(todayK, -i)]).filter(Boolean);
  const gut = days.flatMap((d) => d.gut || []);

  // 1. Комфорт заметно изменился к прошлой неделе
  const now = weekComfort(log, todayK, addDays), before = weekComfort(log, addDays(todayK, -WEEK), addDays);
  if (now && before) {
    if (now.value <= before.value - TREND_PTS) add('Почему комфорт снизился на этой неделе?');
    else if (now.value >= before.value + TREND_PTS) add('Что помогло комфорту вырасти на этой неделе?');
  }

  // 2. Повторяющийся симптом — самый частый
  const symDays = {};
  for (const d of days) for (const s of new Set((d.gut || []).flatMap((g) => g.sym || []))) if (s !== SYMPTOM_OK) symDays[s] = (symDays[s] || 0) + 1;
  const topSym = Object.entries(symDays).sort((a, b) => b[1] - a[1])[0];
  if (topSym && topSym[1] >= REPEAT_DAYS) add(SYMPTOM_Q[topSym[0]]);

  // 3. Форма и частота стула
  const typed = gut.filter((g) => g.type > 0);
  const daysWithGut = days.filter((d) => d.gut && d.gut.length).length;
  if (typed.filter((g) => g.type <= 2).length >= REPEAT_DAYS) add('Почему стул бывает твёрдым?');
  if (typed.filter((g) => g.type >= 6).length >= REPEAT_DAYS) add('Почему стул бывает жидким?');
  if (daysWithGut >= 4 && typed.length < 3) add('Почему стул реже 3 раз за неделю?');

  // 4. Стресс
  if (days.filter((d) => (d.gut || []).some((g) => g.stress != null && g.stress >= 8)).length >= REPEAT_DAYS) add('Как стресс влияет на мой кишечник?');

  // 5. Цикл: сейчас «окно», когда он может влиять
  const cd = cycleDay(profile, todayK, todayK);
  const today = log[todayK] || { gut: [], meals: [], period: false, water: 0 };
  if (profile.cycle && cycleHint(cd, profile.len, profile.coc, isPeriodDay(profile, today, cd))) add('Как цикл сейчас влияет на мой стул?');

  // 6. Частое блюдо — как оно на меня действует
  const meals = days.flatMap((d) => d.meals || []);
  const counts = {};
  for (const m of meals) { const n = (m.name || '').trim(); if (n) counts[n] = (counts[n] || 0) + 1; }
  const topMeal = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  if (topMeal && topMeal[1] >= REPEAT_DAYS) add('Как «' + topMeal[0] + '» влияет на мой кишечник?');

  // 7. Клетчатки в среднем мало (только по дням, где записана еда)
  const fibers = days.map(fiberOf).filter((f) => f != null);
  if (fibers.length >= 3 && fibers.reduce((a, f) => a + f, 0) / fibers.length < dailyTargets(profile).fiberG * 0.6) add('Чем мне добрать клетчатку?');

  // 8. Цели из профиля, потом общие вопросы
  for (const g of profile.goals || []) add(GOAL_Q[g]);
  for (const q of AI_SUGGESTED_QUESTIONS) add(q);
  return out;
}
