// Карточка блюда: фото (своё или картинка ИИ), название, КБЖУ и клетчатка, оценка и совет. Одинаковая на «+» и в сохранённом блюде.
// Шаблон — src/templates/partials/meal-card.html (значения в объекте card).
// Есть фото — оно крупно сверху карточки; нет — маленькая плашка цвета оценки, как раньше.
import { mealStats, mealTint } from '../domain/meal.js';

/**
 * @param {object} meal
 * @param {string} [photo] — фото черновика (на «+»); у сохранённого блюда берётся meal.photo
 * @param {{ drawing?: boolean, aiArt?: boolean }} [opts] — drawing: ИИ ещё рисует картинку; aiArt: фото нарисовано ИИ
 */
export function mealCard(meal, photo, opts = {}) {
  const src = photo || meal.photo || '';
  const drawing = !!opts.drawing && !src;
  return {
    name: meal.name,
    stats: mealStats(meal),
    verdict: (meal.kcal || 0) + ' ккал · ' + meal.verdict,
    tip: meal.tip,
    tint: mealTint(meal),
    photo: src,
    hasPhoto: !!src,
    drawing,
    showThumb: !src && !drawing,
    aiArt: !!src && (opts.aiArt != null ? opts.aiArt : meal.source === 'text')
  };
}
