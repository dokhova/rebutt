// «Когда начались последние месячные» — одна лента дней (онбординг и профиль).
// Лента прокручивается вбок, сегодня — справа. Нажатие на день = день 1 цикла, следующие 4 дня подсвечены.
// Дни старше 60 дней не показываем (как ограничение в App.setLastPeriod).
import { addDays, diffDays, dayMonth, dayMonthShort, parseKey, MONTHS_GEN } from '../domain/dates.js';

const MONTHS_NOM = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

const DAYS = 45;
const PERIOD_DAYS = 5;
const WD = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

/** Прокрутка ленты к выбранному дню (или к сегодня) — один раз при появлении */
const scrolled = new WeakSet();
function scrollStrip(el) {
  if (!el || scrolled.has(el)) return;
  scrolled.add(el);
  requestAnimationFrame(() => {
    const on = el.querySelector('.pc-day.on');
    el.scrollLeft = on ? on.offsetLeft - el.clientWidth / 2 + on.offsetWidth / 2 : el.scrollWidth;
  });
}

/** picked — выбран ли день (в онбординге до первого нажатия ничего не выбрано) */
export function periodCalendarView(app, picked = true) {
  const p = app.state.profile, todayK = app.today();
  const startK = picked && !p.lastUnknown ? addDays(todayK, -p.lastAgo) : '';
  const days = Array.from({ length: DAYS + 1 }, (_, i) => {
    const ago = DAYS - i, k = addDays(todayK, -ago), d = parseKey(k);
    const since = startK ? diffDays(k, startK) : -1;
    const cls = 'pc-day' + (k === startK ? ' on' : '') + (since > 0 && since < PERIOD_DAYS ? ' band' : '') + (k === todayK ? ' today' : '');
    return {
      wd: k === todayK ? 'сег' : WD[d.getDay()],
      n: String(d.getDate()),
      month: d.getDate() === 1 || i === 0 ? MONTHS_GEN[d.getMonth()].slice(0, 3) : '',
      cls, aria: dayMonth(k), pick: () => app.pickPeriodStart(ago)
    };
  });
  const cd = startK ? (p.lastAgo % p.len) + 1 : 0;
  return {
    // над лентой — месяц выбранного дня (или текущий), чтобы было понятно, что за даты
    pcMonths: MONTHS_NOM[parseKey(startK || todayK).getMonth()],
    pcPicked: startK ? 'Начались ' + dayMonth(startK) : '',
    pcDays: days,
    pcScroll: scrollStrip,
    pcSummary: startK
      ? 'Сегодня ' + cd + '-й день цикла · следующие примерно ' + dayMonthShort(addDays(startK, p.len * Math.ceil((p.lastAgo + 1) / p.len)))
      : 'Выберите первый день месячных — можно примерно. Справа — сегодня',
    pcUnknownCls: 'pc-unknown' + (picked && p.lastUnknown ? ' on' : ''),
    pcUnknown: () => app.pickPeriodStart(null)
  };
}
