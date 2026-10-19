// Шторка «+» поверх экрана: сначала слайдер из трёх карточек — «Стул», «Питание», «Жидкости», потом форма выбранного раздела.
// Черновик общий: можно вернуться к карточкам и заполнить другой раздел, «Сохранить» сохраняет всё сразу.
// Значения попадают в общий view вместе с экраном под шторкой — имена ключей не должны пересекаться с views/today.js и др.
import { MEAL_TINT, WATER_STEPS, WATER_GOAL_ML } from '../domain/catalog.js';
import { litres } from '../domain/suggestions.js';
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

  const stoolFilled = !!(f.stool || f.sym.length || f.stress != null || f.period);
  const foodFilled = f.food === 'done';
  const waterFilled = !!f.water;
  const sheet = s.addSheet || 'pick';
  const card = (id, title, sub, tone, filled) => ({
    id, title, sub, filled,
    cls: 'pick-card', iconCls: 'pick-icon ' + tone,
    isStool: id === 'stool', isFood: id === 'food', isWater: id === 'water',
    pick: () => app.pickAddSection(id)
  });
  const savedWater = today.water || 0, totalWater = Math.max(0, savedWater + (f.water || 0));

  return {
    dateLong: 'Сегодня, ' + dayMonth(todayK),

    // шторка: выбор раздела или форма
    sheetPicking: sheet === 'pick',
    sheetForm: sheet !== 'pick',
    sheetTitle: { pick: 'Что добавить?', stool: 'Стул', food: 'Питание', water: 'Жидкости' }[sheet],
    sheetCls: 'sheet slide-up' + (sheet === 'pick' ? ' short' : ''),
    closeAddSheet: () => app.closeAddSheet(),
    backToPicker: () => app.backToAddPicker(),
    pickCards: [
      card('stool', 'Стул', 'Тип, самочувствие', 'calm', stoolFilled),
      card('food', 'Питание', 'Фото или описание', 'mild', foodFilled),
      card('water', 'Жидкости', 'Вода, чай, суп', 'sens', waterFilled)
    ],
    hasDraft: stoolFilled || foodFilled || waterFilled,
    sec: { stool: sheet === 'stool', food: sheet === 'food', water: sheet === 'water' },

    // жидкости
    waterTotal: litres(totalWater),
    waterGoal: 'из ' + litres(WATER_GOAL_ML) + ' л за день',
    waterBar: 'width: ' + Math.min(100, Math.round(totalWater / WATER_GOAL_ML * 100)) + '%',
    waterDelta: f.water ? (f.water > 0 ? '+' : '−') + Math.abs(f.water) + ' мл в этой записи' : savedWater ? 'уже записано ' + litres(savedWater) + ' л' : 'пока ничего не записано',
    waterSteps: WATER_STEPS.map(([ml, label]) => ({ label, ml: '+' + ml + ' мл', add: () => app.addWater(ml) })),
    waterMinus: () => app.addWater(-250),
    waterMinusCls: 'round-btn lg' + (totalWater > 0 ? '' : ' off'),
    waterPlus: () => app.addWater(250),

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
