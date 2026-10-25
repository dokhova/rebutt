// Карточка блюда: миниатюра (своё фото или плашка цвета оценки), название, калории и оценка, БЖУ и клетчатка, совет.
// Одинаковая на «+» и в сохранённом блюде — с фото и без фото одна и та же раскладка.
// Шаблон — src/templates/partials/meal-card.html (значения в объекте card).
import { mealStats, mealTint, mealPhoto } from '../domain/meal.js';

/**
 * @param {object} meal
 * @param {string} [photo] — фото черновика (на «+»); у сохранённого блюда берётся из meal
 */
export function mealCard(meal, photo) {
  const src = photo || mealPhoto(meal);
  return {
    name: meal.name,
    stats: mealStats(meal),
    verdict: (meal.kcal || 0) + ' ккал · ' + meal.verdict,
    tip: meal.tip,
    tint: mealTint(meal),
    photo: src,
    hasPhoto: !!src
  };
}
