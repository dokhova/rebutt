// Календарь «Когда начались последние месячные» — один для онбординга и профиля.
// Последние 6 недель, нажатие на день = день 1 цикла. Следующие 4 дня подсвечены — так видно, что это «месячные», а не одна дата.
// Будущие дни и дни старше 60 дней не выбираются (как ограничение в App.setLastPeriod).
import { addDays, diffDays, mondayOf, dayMonth, dayMonthShort, parseKey, MONTHS_GEN } from '../domain/dates.js';

const WEEKS = 6;
const MAX_AGO = 60;
const PERIOD_DAYS = 5;
const MONTHS_NOM = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];

/** picked — выбран ли день (в онбординге до первого нажатия ничего не выбрано) */
export function periodCalendarView(app, picked = true) {
  const p = app.state.profile, todayK = app.today();
  const startK = picked && !p.lastUnknown ? addDays(todayK, -p.lastAgo) : '';
  const first = addDays(mondayOf(todayK), -7 * (WEEKS - 1));
  const cells = Array.from({ length: WEEKS * 7 }, (_, i) => {
    const k = addDays(first, i), ago = diffDays(todayK, k), d = parseKey(k).getDate();
    const off = ago < 0 || ago > MAX_AGO;
    const sinceStart = startK ? diffDays(k, startK) : -1;
    const band = sinceStart > 0 && sinceStart < PERIOD_DAYS && ago >= 0;
    const bandEnd = band && (sinceStart === PERIOD_DAYS - 1 || ago === 0);
    const cls = 'pc-day' + (off ? ' off' : '') + (k === startK ? ' on' + (p.lastAgo > 0 ? ' band-start' : '') : '') +
      (band ? ' band' : '') + (bandEnd ? ' band-end' : '') + (k === todayK ? ' today' : '');
    return { label: String(d), month: d === 1 ? MONTHS_GEN[parseKey(k).getMonth()].slice(0, 3) : '', cls, aria: dayMonth(k), pick: () => { if (!off) app.pickPeriodStart(ago); } };
  });
  const m1 = parseKey(first).getMonth(), m2 = parseKey(todayK).getMonth();
  const cd = startK ? (p.lastAgo % p.len) + 1 : 0;
  return {
    pcMonths: m1 === m2 ? MONTHS_NOM[m2] : MONTHS_NOM[m1] + ' — ' + MONTHS_NOM[m2],
    pcCells: cells,
    pcHasStart: !!startK,
    pcSummary: startK
      ? 'Сегодня ' + cd + '-й день цикла · следующие примерно ' + dayMonthShort(addDays(startK, p.len * Math.ceil((p.lastAgo + 1) / p.len)))
      : 'Нажмите на первый день месячных — можно примерно',
    pcUnknownCls: 'pc-unknown' + (picked && p.lastUnknown ? ' on' : ''),
    pcUnknown: () => app.pickPeriodStart(null)
  };
}
