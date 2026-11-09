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

// ---------- «Комфорт за день» утром: опора на прошлые дни ----------
// Новый день без записей — это не 0% и не «нет данных»: кишечник работал и вчера.
// Пока о самочувствии сегодня ничего не отмечено, показываем базу по последним дням,
// после первой записи плавно переходим к сегодняшнему значению.

/** Сколько дней назад смотрим и сколько дней с записями берём; веса — свежим дням больше */
const BASE_LOOKBACK = 7;
const BASE_WEIGHTS = [0.5, 0.3, 0.2];
/** Вес сегодняшних записей: одна запись — 60% (цифра не прыгает), со второй — 100% */
const todayWeight = (n) => (n >= 2 ? 1 : n === 1 ? 0.6 : 0);

/**
 * База комфорта по прошлым дням: взвешенное среднее комфорта за последние (до 3) дней
 * с записями о стуле/самочувствии в пределах недели до дня k. Нет таких дней → null.
 */
export function comfortBaseline(log, k, addDays) {
  const vals = [];
  for (let i = 1; i <= BASE_LOOKBACK && vals.length < BASE_WEIGHTS.length; i++) {
    const d = log && log[addDays(k, -i)];
    const sc = d && d.gut && d.gut.length ? gutScore({ ...emptyDay(), ...d }) : null;
    if (sc) vals.push(sc.comfort);
  }
  if (!vals.length) return null;
  const w = BASE_WEIGHTS.slice(0, vals.length), sum = w.reduce((a, x) => a + x, 0);
  return Math.round(vals.reduce((a, v, i) => a + v * w[i], 0) / sum);
}

/**
 * Комфорт для главной: { value, fromPast } или null.
 *   fromPast — цифра пока только по прошлым дням (в карточке подпись «по прошлым дням»).
 * База используется только для сегодняшнего дня: прошлый день без записей остаётся пустым.
 */
export function dayComfort(log, k, day, addDays, isToday) {
  const sc = gutScore(day);
  const base = isToday ? comfortBaseline(log, k, addDays) : null;
  if (!sc) return base == null ? null : { value: base, fromPast: true };
  const w = base == null ? 1 : todayWeight(day.gut.length);
  return { value: Math.round(sc.comfort * w + (base ?? 0) * (1 - w)), fromPast: false };
}

/** Тон состояния по проценту: calm ≥ 80, mild ≥ 62, иначе sens; нет данных → empty */
export const toneOf = (v) => (v == null ? 'empty' : v >= 80 ? 'calm' : v >= 62 ? 'mild' : 'sens');

// Слова для состояния — спокойные, без тревоги
export const TONE_WORD = { calm: 'Хорошо', mild: 'Небольшие сбои', sens: 'Нужна забота', empty: 'Нет данных' };

/** Цвета тонов — те же, что в styles/tokens.css (нужны в JS для SVG-колец и столбиков) */
export const TONE_COLOR = { calm: '#D3FA9D', mild: '#7FA866', sens: '#A78BFA', cycle: '#7954C8', empty: 'var(--track)' };
