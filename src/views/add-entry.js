// «+»: запись за сегодня — стул, цвет, самочувствие, стресс, отметка месячных, еда.
import { MEAL_TINT } from '../domain/catalog.js';
import { gutFormView } from './gut-form.js';
import { mealCard } from './meal-card.js';
import { dayMonth } from '../domain/dates.js';
import { gutScore } from '../domain/score.js';
import { cycleDay } from '../domain/cycle.js';

export function addEntryView(app) {
  const s = app.state, f = s.form, p = s.profile, todayK = app.today();
  const today = app.day(todayK);
  const scoreNow = gutScore(today), scorePreview = gutScore(app.draftDay(today).day);
  const seg = (on) => 'seg' + (on ? ' on' : '');

  return {
    dateLong: 'Сегодня, ' + dayMonth(todayK),

    ...gutFormView(app, 'form'),

    cycleEnabled: p.cycle && !p.pregnant,
    cycleDayKnown: cycleDay(p, todayK, todayK) > 0,
    cycleDay: cycleDay(p, todayK, todayK),
    periodNo: seg(f.period === 'no'),
    periodYes: seg(f.period === 'yes'),
    setPeriodNo: () => app.setPeriodMark('no'),
    setPeriodYes: () => app.setPeriodMark('yes'),

    food: { pick: f.food === 'pick', scan: f.food === 'scan', done: f.food === 'done' },
    photo: f.photo,
    noPhoto: !f.photo,
    note: f.note,
    onNote: (e) => app.setForm({ note: e.target.value }),
    onPhoto: (e) => {
      const file = e.target.files && e.target.files[0];
      e.target.value = ''; // чтобы можно было выбрать то же фото повторно
      if (file) app.pickFoodPhoto(file);
    },
    removePhoto: () => app.removeFoodPhoto(),
    analyzeCls: 'btn secondary' + (f.photo || f.note.trim() ? '' : ' off'),
    analyze: () => app.analyzeFoodDraft(),
    scanTint: MEAL_TINT.mild,
    card: f.result ? mealCard({ ...f.result, note: f.note }, f.photo) : null,
    removeFood: () => app.removeFood(),
    fixOpen: f.fixOpen,
    fixClosed: !f.fixOpen,
    openFix: () => app.setForm({ fixOpen: true }),
    fix: f.fix,
    onFix: (e) => app.setForm({ fix: e.target.value }),
    fixCls: 'btn secondary' + (f.fix.trim() && !f.fixing ? '' : ' off'),
    fixLabel: f.fixing ? 'Пересчитываем…' : 'Пересчитать',
    applyFix: () => app.applyFoodFix(),

    scoreNow: scoreNow ? scoreNow.idx + '%' : '—',
    scorePreview: scorePreview ? scorePreview.idx + '%' : '—',
    save: () => app.saveEntry()
  };
}
