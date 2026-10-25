// «+»: над меню всплывают три отдельные карточки слайдером — «Стул», «Питание», «Жидкости»; выбранная открывает шторку с формой раздела.
// Черновик общий: можно вернуться к карточкам и заполнить другой раздел, «Сохранить» сохраняет всё сразу.
// Значения попадают в общий view вместе с экраном под шторкой — имена ключей не должны пересекаться с views/today.js и др.
import { MEAL_TINT, WATER_STEPS } from '../domain/catalog.js';
import { dailyTargets } from '../domain/targets.js';
import { litres } from '../domain/suggestions.js';
import { gutFormView } from './gut-form.js';
import { mealCard } from './meal-card.js';
import { dayMonth, addDays, parseKey, WEEKDAYS_FULL } from '../domain/dates.js';
import { isAndroid } from '../services/telegram.js';
import { gutScore } from '../domain/score.js';
import { cycleDay } from '../domain/cycle.js';
import { noCyclePhases } from '../domain/profile.js';

export function addEntryView(app) {
  // День записи — выбранный на главной (можно дописать забытый день), по умолчанию сегодня
  const s = app.state, f = s.form, p = s.profile, todayK = app.today(), dayK = app.entryDay();
  const isToday = dayK === todayK;
  const today = app.day(dayK);
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
    dateLong: dayLabel(dayK, todayK),
    isPastDay: !isToday,

    // шторка: выбор раздела или форма
    sheetPicking: sheet === 'pick',
    sheetForm: sheet !== 'pick',
    sheetTitle: { pick: 'Что добавить?', stool: 'Стул', food: 'Питание', water: 'Жидкости' }[sheet],
    closeAddSheet: () => app.closeAddSheet(),
    backToPicker: () => app.backToAddPicker(),
    pickCards: [
      card('stool', 'Стул', 'Тип, цвет', 'calm', stoolFilled),
      card('food', 'Питание', 'Фото, текст', 'mild', foodFilled),
      card('water', 'Жидкости', 'Вода, чай', 'sens', waterFilled)
    ],
    hasDraft: stoolFilled || foodFilled || waterFilled,
    sec: { stool: sheet === 'stool', food: sheet === 'food', water: sheet === 'water' },

    // жидкости
    waterCaption: isToday ? 'За сегодня' : 'За ' + dayMonth(dayK),
    waterTotal: litres(totalWater),
    waterGoal: 'из ' + litres(dailyTargets(p).waterMl) + ' л за день',
    waterBar: 'width: ' + Math.min(100, Math.round(totalWater / dailyTargets(p).waterMl * 100)) + '%',
    waterDelta: f.water ? (f.water > 0 ? '+' : '−') + Math.abs(f.water) + ' мл в этой записи' : savedWater ? 'уже записано ' + litres(savedWater) + ' л' : 'пока ничего не записано',
    waterSteps: WATER_STEPS.map(([ml, label]) => ({ label, ml: '+' + ml + ' мл', add: () => app.addWater(ml) })),
    waterMinus: () => app.addWater(-250),
    waterMinusCls: 'round-btn lg' + (totalWater > 0 ? '' : ' off'),
    waterPlus: () => app.addWater(250),

    ...gutFormView(app, 'form'),

    cycleEnabled: p.cycle && !noCyclePhases(p),
    cycleDayKnown: cycleDay(p, dayK, todayK) > 0,
    cycleDay: cycleDay(p, dayK, todayK),
    periodNo: seg(f.period === 'no'),
    periodYes: seg(f.period === 'yes'),
    setPeriodNo: () => app.setPeriodMark('no'),
    setPeriodYes: () => app.setPeriodMark('yes'),

    food: { pick: f.food === 'pick', scan: f.food === 'scan', done: f.food === 'done' },
    photo: f.photo,
    noPhoto: !f.photo,
    photoSplit: !f.photo && isAndroid(),
    photoSingle: !f.photo && !isAndroid(),
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
    card: f.result ? mealCard(f.result, f.photo, { drawing: f.art === 'loading', aiArt: f.source === 'text' && !!f.photo }) : null,
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

/** «Сегодня, 25 октября», «Вчера, 24 октября», «Пятница, 23 октября» */
function dayLabel(k, todayK) {
  if (k === todayK) return 'Сегодня, ' + dayMonth(k);
  if (k === addDays(todayK, -1)) return 'Вчера, ' + dayMonth(k);
  return WEEKDAYS_FULL[parseKey(k).getDay()] + ', ' + dayMonth(k);
}
