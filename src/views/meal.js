// Сохранённое блюдо: карточка, уточнение (ИИ пересчитает), удаление.
import { dayMonth } from '../domain/dates.js';
import { mealCard } from './meal-card.js';

export function mealView(app) {
  const me = app.state.mealEdit, meal = app.findMeal(me.day, me.id);
  if (!meal) return { mealMissing: true, closeMeal: () => app.closeMeal() };
  return {
    mealMissing: false,
    mealFound: true,
    mealWhen: dayMonth(me.day) + ', ' + meal.time,
    card: mealCard(meal),
    noteText: meal.note,
    fix: me.fix,
    onFix: (e) => app.setMealFix(e.target.value),
    fixCls: 'btn secondary' + (me.fix.trim() && !me.fixing ? '' : ' off'),
    fixLabel: me.fixing ? 'Пересчитываем…' : 'Пересчитать',
    applyFix: () => app.applyMealFix(),
    deleteMeal: () => app.deleteMeal(),
    closeMeal: () => app.closeMeal()
  };
}
