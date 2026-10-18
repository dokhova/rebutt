// «Инсайты»: средний показатель недели, столбики по дням, статистика, наблюдение ИИ, вопросы к ИИ.
import { IS_DEMO } from '../config.js';
import { parseKey, addDays, mondayOf, dayMonth, MONTHS_GEN, WEEKDAYS_SHORT } from '../domain/dates.js';
import { gutScore, symptomsOf, toneOf, hasData, TONE_WORD, TONE_COLOR } from '../domain/score.js';
import { cycleDay, daysToLuteal } from '../domain/cycle.js';

const BAR_MAX_PX = 90;
const BAR_MIN_PX = 12;

export function insightsView(app) {
  const s = app.state, p = s.profile, todayK = app.today(), monday = mondayOf(todayK);
  // Неделя, но не раньше дня, когда человек начал вести дневник
  const since = p.since ? p.since.slice(0, 10) : '';
  const start = since > monday && since <= todayK ? since : monday;
  const days = [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(monday, i)).filter((k) => k >= start);
  const pastDays = days.filter((k) => k <= todayK).length;
  let stools = 0, normal = 0, symptomDays = 0, fiberSum = 0, meals = 0, idxSum = 0, idxDays = 0, dataDays = 0;

  const bars = days.map((k) => {
    const d = parseKey(k), dow = WEEKDAYS_SHORT[(d.getDay() + 6) % 7];
    const day = app.day(k), sc = k > todayK ? null : gutScore(day);
    for (const g of day.gut) if (g.type > 0) { stools++; if (g.type === 3 || g.type === 4) normal++; }
    for (const m of day.meals) { fiberSum += Number(m.fiber) || 0; meals++; }
    if (symptomsOf(day).length) symptomDays++;
    if (sc) { idxSum += sc.idx; idxDays++; }
    if (hasData(day)) dataDays++;
    return {
      dow,
      value: sc ? sc.idx : '',
      height: sc ? Math.max(BAR_MIN_PX, Math.round((sc.idx - 30) / 70 * BAR_MAX_PX)) : BAR_MIN_PX,
      bg: sc ? TONE_COLOR[toneOf(sc.idx)] : 'transparent',
      border: sc ? '0' : '1px dashed rgba(255,255,255,.36)',
      dayCls: 'bar-day' + (k === todayK ? ' today' : ''),
      title: d.getDate() + ' ' + MONTHS_GEN[d.getMonth()] + (sc ? ': ' + sc.idx + '%' : ': нет данных')
    };
  });

  const avg = idxDays ? Math.round(idxSum / idxDays) : null;
  const normalPct = stools ? Math.round(normal / stools * 100) : null;
  const cdToday = cycleDay(p, todayK, todayK);

  return {
    weekLabel: start === monday ? weekLabel(monday) : 'С ' + dayMonth(start),
    avg: avg == null ? '—' : avg,
    hasAvg: avg != null,
    avgTone: 'dot lg ' + toneOf(avg),
    avgWord: TONE_WORD[toneOf(avg)],
    bars,
    normalPct: normalPct == null ? '—' : normalPct + '%',
    symptomDays,
    symptomDaysText: symptomDays + ' из ' + pastDays,
    fiberAvg: meals ? (fiberSum / meals).toFixed(1).replace('.', ',') + ' г' : '—',
    noticed: noticedText(app, todayK, { dataDays, normalPct, symptomDays }),
    showCycleNote: cdToday > 0 && !p.coc,
    daysToLuteal: daysToLuteal(cdToday, p.len),

    openAssistant: () => app.openAssistant('insights')
  };
}

/** 'Неделя, 12–18 октября' или 'Неделя, 29 сентября – 5 октября' */
function weekLabel(mondayK) {
  const a = parseKey(mondayK), b = parseKey(addDays(mondayK, 6));
  return 'Неделя, ' + (a.getMonth() === b.getMonth()
    ? a.getDate() + '–' + b.getDate() + ' ' + MONTHS_GEN[b.getMonth()]
    : a.getDate() + ' ' + MONTHS_GEN[a.getMonth()] + ' – ' + b.getDate() + ' ' + MONTHS_GEN[b.getMonth()]);
}

/** Блок «ИИ заметил»: ответ ИИ → «смотрю…» → подсказка «нужно больше данных» → простая статистика */
function noticedText(app, todayK, stats) {
  const s = app.state;
  if (IS_DEMO) {
    const pizza = gutScore(app.day('2026-09-24'));
    return 'После пиццы вечером кишечник работал на ' + (pizza ? pizza.idx : '—') + '%. В дни с овсянкой на завтрак — не ниже 80%.';
  }
  if (s.insights && s.insights.noticed && s.insights.date === todayK) return s.insights.noticed;
  if (s.insightsLoading) return 'Смотрю на ваши записи…';
  if (stats.dataDays < 3) return 'Добавьте записи хотя бы за 3 дня — здесь появятся закономерности между едой и самочувствием.';
  const normal = stats.normalPct == null ? '' : 'За неделю стул был в норме в ' + stats.normalPct + '% случаев. ';
  return normal + 'Дней с дискомфортом: ' + stats.symptomDays + '.';
}
