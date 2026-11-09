// «Работа кишечника», % — главный показатель дня.
//
// Запись дня (DayRecord):
//   { gut: GutEntry[], meals: Meal[], period: boolean, water: number }
//   water — сколько жидкости выпито за день, мл (вода, чай, суп и т.п. — одним числом)
// GutEntry: { id, time 'HH:MM', type, sym: string[], color?: id из STOOL_COLORS, stress?: 0–10 }
//   type 1–7 — стул по Бристольской шкале, 0 — «стула не было», -1 — отмечено только самочувствие
// Meal: { id, time, name, kcal, fiber, verdict, tone, tip, photo?, source? }

import { SYMPTOM_OK } from './catalog.js';

export const emptyDay = () => ({ gut: [], meals: [], period: false, water: 0 });

/** Уникальные симптомы за день, без «Всё хорошо» */
export const symptomsOf = (day) => [...new Set(day.gut.flatMap((x) => x.sym).filter((x) => x !== SYMPTOM_OK))];

export const hasData = (day) => !!day && ((day.gut && day.gut.length > 0) || (day.meals && day.meals.length > 0) || day.water > 0);

/** Клетчатка за день, г — сумма по блюдам с разбором. null — блюд не было. */
export const fiberOf = (day) => (day && day.meals && day.meals.length ? Math.round(day.meals.reduce((a, m) => a + (Number(m.fiber) || 0), 0)) : null);

/** Жидкость за день, мл */
export const waterOf = (day) => (day && day.water > 0 ? day.water : 0);

// Насколько форма стула близка к норме, по типам Бристольской шкалы
const FORM_BY_TYPE = { 1: 35, 2: 55, 3: 85, 4: 92, 5: 72, 6: 48, 7: 30 };

/**
 * Считает показатель дня. Нет записей о стуле/самочувствии → null.
 *   form    — форма стула (среднее по типам за день)
 *   reg     — регулярность: был стул / отметили «не было» / только самочувствие
 *   comfort — самочувствие: −24 за каждый симптом
 *   idx     — итог: 35% форма + 30% регулярность + 35% комфорт
 */
export function gutScore(day) {
  if (!day || !day.gut.length) return null;
  const typed = day.gut.filter((x) => x.type > 0);
  const had = day.gut.some((x) => x.type >= 0);
  const sym = symptomsOf(day);
  const form = typed.length ? Math.round(typed.reduce((a, x) => a + FORM_BY_TYPE[x.type], 0) / typed.length) : 58;
  const reg = typed.length ? 90 : (had ? 50 : 70);
  const comfort = Math.max(30, 92 - 24 * sym.length);
  const last = typed.length ? typed[typed.length - 1].type : 0;
  return { idx: Math.round(0.35 * form + 0.3 * reg + 0.35 * comfort), form, reg, comfort, n: typed.length, had, last, sym };
}

// ---------- «Комфорт за 7 дней» — главная цифра на главной ----------
// Норму стула в гастроэнтерологии считают за неделю, а не за день: от 3 раз в неделю до 3 раз в день
// (Heaton 1992, NHANES 2018 — источники в sources.js). Один день без стула ничего не значит,
// поэтому главная цифра — скользящая неделя, заканчивающаяся выбранным днём. Плитки остаются за день.

export const WEEK_DAYS = 7;
/** Выбранный день весит вдвое больше остальных — свежая запись заметно сдвигает цифру */
const DAY_WEIGHT = 2;
/** Регулярность учитываем, только когда отмечено не меньше 4 дней из 7 — иначе мало данных */
const REG_MIN_DAYS = 4;
const REG_MIN_STOOLS = 3;
const REG_PENALTY = 8;

/**
 * Комфорт за 7 дней (k и 6 дней до него): { value, days, stools } или null, если за неделю
 * нет записей о стуле/самочувствии.
 *   value  — взвешенное среднее дневного комфорта (по самочувствию); если отмечено ≥ 4 дней,
 *            а стула меньше 3 раз за неделю — мягко меньше: −8 за каждый недостающий раз
 *   days   — сколько дней недели с записями
 *   stools — сколько раз был стул за неделю
 */
export function weekComfort(log, k, addDays) {
  let sum = 0, wsum = 0, days = 0, stools = 0;
  for (let i = 0; i < WEEK_DAYS; i++) {
    const d = log && log[addDays(k, -i)];
    const sc = d && d.gut && d.gut.length ? gutScore({ ...emptyDay(), ...d }) : null;
    if (!sc) continue;
    const w = i === 0 ? DAY_WEIGHT : 1;
    sum += sc.comfort * w; wsum += w; days++; stools += sc.n;
  }
  if (!days) return null;
  let value = sum / wsum;
  if (days >= REG_MIN_DAYS && stools < REG_MIN_STOOLS) value -= REG_PENALTY * (REG_MIN_STOOLS - stools);
  return { value: Math.max(0, Math.round(value)), days, stools };
}

/** Тон состояния по проценту: calm ≥ 80, mild ≥ 62, иначе sens; нет данных → empty */
export const toneOf = (v) => (v == null ? 'empty' : v >= 80 ? 'calm' : v >= 62 ? 'mild' : 'sens');

// Слова для состояния — спокойные, без тревоги
export const TONE_WORD = { calm: 'Хорошо', mild: 'Небольшие сбои', sens: 'Нужна забота', empty: 'Нет данных' };

/** Цвета тонов — те же, что в styles/tokens.css (нужны в JS для SVG-колец и столбиков) */
export const TONE_COLOR = { calm: '#D3FA9D', mild: '#7FA866', sens: '#A78BFA', cycle: '#7954C8', empty: 'var(--track)' };
