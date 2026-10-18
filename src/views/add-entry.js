// «+»: запись за сегодня — стул, самочувствие, отметка месячных, еда по фото.
import { BRISTOL_TYPES, SYMPTOMS, EXAMPLE_MEALS, MEAL_TINT } from '../domain/catalog.js';
import { dayMonth } from '../domain/dates.js';
import { gutScore } from '../domain/score.js';
import { cycleDay } from '../domain/cycle.js';

export function addEntryView(app) {
  const s = app.state, f = s.form, p = s.profile, todayK = app.today();
  const today = app.day(todayK);
  const scoreNow = gutScore(today), scorePreview = gutScore(app.draftDay(today).day);
  const meal = f.result || EXAMPLE_MEALS[0];
  const seg = (on) => 'seg' + (on ? ' on' : '');

  return {
    dateLong: 'Сегодня, ' + dayMonth(todayK),

    stoolHad: seg(f.stool === 'had'),
    stoolNone: seg(f.stool === 'none'),
    setHad: () => app.setStool('had'),
    setNone: () => app.setStool('none'),
    showTypes: f.stool === 'had',
    types: Object.keys(BRISTOL_TYPES).map(Number).map((n) => ({
      type: String(n), short: BRISTOL_TYPES[n], on: f.type === n,
      aria: 'Тип ' + n + ', ' + BRISTOL_TYPES[n],
      cls: 'type-card' + (f.type === n ? ' on' : ''),
      pick: () => app.pickBristolType(n)
    })),

    symptoms: SYMPTOMS.map((label) => {
      const on = f.sym.includes(label);
      return { label, on, cls: 'chip' + (on ? ' on' : ''), pick: () => app.toggleSymptom(label) };
    }),

    cycleEnabled: p.cycle && !p.pregnant,
    cycleDayKnown: cycleDay(p, todayK, todayK) > 0,
    cycleDay: cycleDay(p, todayK, todayK),
    periodNo: seg(f.period === 'no'),
    periodYes: seg(f.period === 'yes'),
    setPeriodNo: () => app.setPeriodMark('no'),
    setPeriodYes: () => app.setPeriodMark('yes'),

    food: { pick: f.food === 'pick', scan: f.food === 'scan', done: f.food === 'done' },
    photo: f.photo,
    meal: { ...meal, tint: MEAL_TINT[meal.tone] || MEAL_TINT.mild, fiberText: String(meal.fiber).replace('.', ',') },
    onPhoto: (e) => {
      const file = e.target.files && e.target.files[0];
      e.target.value = ''; // чтобы можно было выбрать то же фото повторно
      if (file) app.addFoodPhoto(file);
    },
    tryExample: () => app.tryExampleMeal(),
    removeFood: () => app.removeFood(),

    scoreNow: scoreNow ? scoreNow.idx + '%' : '—',
    scorePreview: scorePreview ? scorePreview.idx + '%' : '—',
    save: () => app.saveEntry()
  };
}
