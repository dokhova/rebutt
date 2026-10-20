// Карточка блюда: название, КБЖУ и клетчатка, оценка и совет. Одинаковая на «+» и в сохранённом блюде.
// Шаблон — src/templates/partials/meal-card.html (значения в объекте card).
import { mealStats, mealTint } from '../domain/meal.js';

export function mealCard(meal, photo) {
  return {
    name: meal.name,
    stats: mealStats(meal),
    verdict: (meal.kcal || 0) + ' ккал · ' + meal.verdict,
    tip: meal.tip,
    tint: mealTint(meal),
    photo: photo || meal.photo || ''
  };
}
