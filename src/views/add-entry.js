// «+» в меню — экран «Запись»: стул, что ещё влияет (месячные, стресс), еда, жидкость — всё сразу.
// «+» в плитке на главной — модалка по центру с одним действием: стул (свайп по типам), еда (фото / текст), жидкость (стаканы).
// Черновик общий: «Сохранить» сохраняет всё, что отмечено.
// Черновик переживает закрытие шторки и перезапуск приложения (App.saveDraft), «Очистить» на карточках — начать заново.
// Значения попадают в общий view вместе с экраном под шторкой — имена ключей не должны пересекаться с views/today.js и др.
import { MEAL_TINT, WATER_STEPS } from '../domain/catalog.js';
import { stoolBlockView } from './stool-block.js';
import { dailyTargets } from '../domain/targets.js';
import { litres } from '../domain/suggestions.js';
import { mealCard } from './meal-card.js';
import { dayMonth, addDays, parseKey, WEEKDAYS_FULL } from '../domain/dates.js';
import { gutScore } from '../domain/score.js';
import { cycleDay } from '../domain/cycle.js';
import { noCyclePhases } from '../domain/profile.js';
import { draftSections } from '../domain/draft.js';
import { isAndroid } from '../services/telegram.js';

export function addEntryView(app) {
  // День записи — выбранный на главной (можно дописать забытый день), по умолчанию сегодня
  const s = app.state, f = s.form, p = s.profile, todayK = app.today(), dayK = app.entryDay();
  const isToday = dayK === todayK;
  const today = app.day(dayK);
  const scoreNow = gutScore(today), scorePreview = gutScore(app.draftDay(today).day);
  const seg = (on) => 'seg' + (on ? ' on' : '');

  const { stool: stoolFilled, food: foodFilled, water: waterFilled } = draftSections(f);
  const sheet = s.addSheet || 'all';
  const isAll = sheet === 'all';
  const savedWater = today.water || 0, totalWater = Math.max(0, savedWater + (f.water || 0));
  const waterTarget = dailyTargets(p).waterMl;
  const cupsFull = Math.round(totalWater / CUP_ML);

  return {
    dateLong: dayLabel(dayK, todayK),
    isPastDay: !isToday,

    // экран «Запись» или модалка одного раздела
    sheetAll: isAll,
    sheetModal: !isAll,
    sheetTitle: { all: 'Запись', stool: 'Стул', food: 'Еда', water: 'Жидкость' }[sheet],
    closeAddSheet: () => app.closeAddSheet(),
    hasDraft: stoolFilled || foodFilled || waterFilled,
    discardDraft: () => app.discardDraft(),
    sec: { stool: sheet === 'stool', food: sheet === 'food', water: sheet === 'water' },
    modalCta: { stool: 'Сохранить', food: 'Добавить', water: 'Готово' }[sheet] || 'Сохранить',

    ...stoolBlockView(app, 'form'),

    // что ещё влияет: месячные (если включён цикл) и стресс тремя кнопками
    periodOn: f.period === 'yes',
    periodSwitch: 'gswitch' + (f.period === 'yes' ? ' on' : ''),
    togglePeriod: () => app.setPeriodMark('yes'),

    // стаканы: тап по стакану n — за день n × 250 мл
    cups: Array.from({ length: CUPS }, (_, i) => ({
      cls: 'cup' + (i < cupsFull ? ' on' : ''), label: 'Стакан ' + (i + 1) + ' — ' + litres((i + 1) * CUP_ML) + ' л за день',
      tap: () => app.setWaterCups(i + 1)
    })),
    waterNow: litres(totalWater),
    waterOf: '/ ' + litres(waterTarget) + ' л',

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


    cycleEnabled: p.cycle && !noCyclePhases(p),
    cycleDayKnown: cycleDay(p, dayK, todayK) > 0,
    cycleDay: cycleDay(p, dayK, todayK),
    periodNo: seg(f.period === 'no'),
    periodYes: seg(f.period === 'yes'),
    setPeriodNo: () => app.setPeriodMark('no'),
    setPeriodYes: () => app.setPeriodMark('yes'),

    food: { pick: f.food === 'pick', scan: f.food === 'scan', done: f.food === 'done' },
    photo: f.photo,
    // на Android камера из мини-аппа не открывается — там только выбор из галереи
    photoLabel: isAndroid() ? 'Добавить фото блюда' : 'Сфотографировать блюдо',
    photoCamera: !isAndroid(),
    photoGallery: isAndroid(),
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

const CUPS = 8, CUP_ML = 250;
/** «Сегодня, 25 октября», «Вчера, 24 октября», «Пятница, 23 октября» */
function dayLabel(k, todayK) {
  if (k === todayK) return 'Сегодня, ' + dayMonth(k);
  if (k === addDays(todayK, -1)) return 'Вчера, ' + dayMonth(k);
  return WEEKDAYS_FULL[parseKey(k).getDay()] + ', ' + dayMonth(k);
}
