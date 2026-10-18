// «Работа кишечника», % — главный показатель дня.
//
// Запись дня (DayRecord):
//   { gut: GutEntry[], meals: Meal[], period: boolean }
// GutEntry: { id, time 'HH:MM', type, sym: string[] }
//   type 1–7 — стул по Бристольской шкале, 0 — «стула не было», -1 — отмечено только самочувствие
// Meal: { id, time, name, kcal, fiber, verdict, tone, tip, photo?, source? }

import { SYMPTOM_OK } from './catalog.js';

export const emptyDay = () => ({ gut: [], meals: [], period: false });

/** Уникальные симптомы за день, без «Всё хорошо» */
export const symptomsOf = (day) => [...new Set(day.gut.flatMap((x) => x.sym).filter((x) => x !== SYMPTOM_OK))];

export const hasData = (day) => !!day && ((day.gut && day.gut.length > 0) || (day.meals && day.meals.length > 0));

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

/** Тон состояния по проценту: calm ≥ 80, mild ≥ 62, иначе sens; нет данных → empty */
export const toneOf = (v) => (v == null ? 'empty' : v >= 80 ? 'calm' : v >= 62 ? 'mild' : 'sens');

export const TONE_WORD = { calm: 'Хорошо', mild: 'Есть сбои', sens: 'Нужно внимание', empty: 'Нет данных' };

/** Цвета тонов — те же, что в styles/tokens.css (нужны в JS для SVG-колец и столбиков) */
export const TONE_COLOR = { calm: '#D3FA9D', mild: '#7FA866', sens: '#A78BFA', cycle: '#7954C8', empty: 'rgba(255,255,255,.15)' };

/** RGB для фонового свечения экрана */
export const TONE_GLOW_RGB = { calm: '211,250,157', mild: '127,168,102', sens: '167,139,250', cycle: '121,84,200', empty: '168,163,179' };
