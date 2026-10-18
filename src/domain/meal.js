// Блюдо после разбора ИИ: КБЖУ, клетчатка, оценка для кишечника.
import { VERDICT_BY_TONE, MEAL_TINT } from './catalog.js';

const TONES = ['calm', 'mild', 'sens'];
const num = (v, digits = 0) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return 0;
  const k = 10 ** digits;
  return Math.round(n * k) / k;
};

/** Приводит ответ ИИ или старую запись к единому виду */
export function normalizeMeal(r) {
  const tone = TONES.includes(r.tone) ? r.tone : 'mild';
  return {
    name: String(r.name || 'Блюдо').slice(0, 60),
    kcal: num(r.kcal),
    protein: num(r.protein, 1),
    fat: num(r.fat, 1),
    carbs: num(r.carbs, 1),
    fiber: num(r.fiber, 1),
    tone,
    verdict: VERDICT_BY_TONE[tone],
    tip: String(r.tip || '').slice(0, 200)
  };
}

const grams = (v) => String(v).replace('.', ',') + ' г';

/** Ячейки БЖУ + клетчатка для карточки блюда (калории — в строке под названием) */
export function mealStats(m) {
  return [
    { label: 'Белки', value: grams(m.protein || 0) },
    { label: 'Жиры', value: grams(m.fat || 0) },
    { label: 'Углеводы', value: grams(m.carbs || 0) },
    { label: 'Клетчатка', value: grams(m.fiber || 0) }
  ];
}

/** Короткая строка для списка записей */
export const mealSummary = (m) => (m.kcal || 0) + ' ккал · Б ' + (m.protein || 0) + ' · Ж ' + (m.fat || 0) + ' · У ' + (m.carbs || 0);

export const mealTint = (m) => MEAL_TINT[m.tone] || MEAL_TINT.mild;
