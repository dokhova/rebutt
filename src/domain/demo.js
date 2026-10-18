// Демо-режим (/?demo): фиксированная неделя 20–26 сентября 2026 с тестовыми записями.
import { EXAMPLE_MEALS } from './catalog.js';
import { blankProfile } from './profile.js';
import { normalizeMeal } from './meal.js';
import { newId } from '../core/id.js';

export const DEMO_TODAY = '2026-09-26';

export const demoProfile = () => ({
  ...blankProfile(),
  name: 'Маша', age: 29, sex: 'f', goals: ['stool', 'bloat'], cycle: true,
  onboardedAt: '2026-09-21', since: '2026-09-21'
});

export function demoLog() {
  const gut = (time, type, sym) => ({ id: newId(), time, type, sym: sym || [] });
  const meal = (time, i) => ({ id: newId(), time, ...normalizeMeal(EXAMPLE_MEALS[i]), source: 'example', photo: '' });
  const day = (o) => ({ gut: [], meals: [], period: false, ...o });
  return {
    '2026-09-20': day({ gut: [gut('09:00', 5)] }),
    '2026-09-21': day({ gut: [gut('08:15', 4, ['Боль'])], meals: [meal('08:00', 1)] }),
    '2026-09-22': day({ gut: [gut('08:40', 4)], meals: [meal('08:20', 1)] }),
    '2026-09-23': day({ gut: [gut('21:00', 0, ['Вздутие'])], meals: [meal('20:30', 2)] }),
    '2026-09-24': day({ gut: [gut('09:10', 2, ['Вздутие', 'Тяжесть'])], meals: [meal('13:30', 0)] }),
    '2026-09-25': day({ gut: [gut('08:20', 3)], meals: [meal('08:30', 1)] }),
    '2026-09-26': day({ gut: [gut('08:35', 4)], meals: [meal('08:10', 1)] })
  };
}

/** Ответы-заглушки ИИ в демо: ключевое слово в вопросе → ответ */
export const DEMO_ANSWERS = {
  'ужин': 'Для лёгкости: запечённая рыба или курица с тушёными овощами и рисом. На ночь лучше без лука, чеснока и бобовых.',
  'вздут': 'По записям вздутие было после пиццы и в день без стула. Больше воды и клетчатки, меньше жирного вечером.'
};
export const DEMO_ANSWER_DEFAULT = 'В рабочей версии ответит ИИ на основе ваших записей и еды.';
export const DEMO_TIP_CALM = 'Овсянка утром уже 4-й раз совпадает со стулом типа 3–4. Оставьте её в завтраке.';
