// «Инсайты»: средний показатель за последние 7 дней (сегодня — последний столбик), столбики по дням (стекло), две плитки статистики, наблюдение ИИ.
import { IS_DEMO } from '../config.js';
import { parseKey, addDays, MONTHS_GEN, WEEKDAYS_SHORT } from '../domain/dates.js';
import { gutScore, symptomsOf, toneOf, hasData, TONE_WORD } from '../domain/score.js';
import { cycleDay, daysToLuteal } from '../domain/cycle.js';

const BAR_MIN_PCT = 8;

export function insightsView(app) {
  const s = app.state, p = s.profile, todayK = app.today(), first = addDays(todayK, -6);
  // Скользящие 7 дней, а не календарная неделя: в понедельник экран не пустеет.
  // Дни до начала дневника приглушены и не входят в статистику
  const since = p.since ? p.since.slice(0, 10) : '';
  const start = since > first && since <= todayK ? since : first;
  const days = [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(first, i));
  const pastDays = days.filter((k) => k >= start && k <= todayK).length;
  const typeCount = {};
  let stools = 0, normal = 0, symptomDays = 0, fiberSum = 0, meals = 0, idxSum = 0, idxDays = 0, dataDays = 0;

  const bars = days.map((k) => {
    const d = parseKey(k), dow = WEEKDAYS_SHORT[(d.getDay() + 6) % 7];
    const before = k < start;
    if (before) return { dow, value: '', pct: 0, fillCls: 'gbar-fill', dayCls: 'gbar-day off', title: d.getDate() + ' ' + MONTHS_GEN[d.getMonth()] + ': до начала дневника' };
    const day = app.day(k), sc = k > todayK ? null : gutScore(day);
    for (const g of day.gut) if (g.type > 0) { stools++; typeCount[g.type] = (typeCount[g.type] || 0) + 1; if (g.type === 3 || g.type === 4) normal++; }
    for (const m of day.meals) { fiberSum += Number(m.fiber) || 0; meals++; }
    if (symptomsOf(day).length) symptomDays++;
    if (sc) { idxSum += sc.idx; idxDays++; }
    if (hasData(day)) dataDays++;
    return {
      dow,
      value: sc ? sc.idx : '',
      // высота столбика: 30 % → пусто, 100 % → полный; сегодня — лаймовый
      pct: sc ? Math.max(BAR_MIN_PCT, Math.round((sc.idx - 30) / 70 * 100)) : 0,
      fillCls: 'gbar-fill' + (k === todayK ? ' today' : ''),
      dayCls: 'gbar-day' + (k === todayK ? ' today' : ''),
      title: d.getDate() + ' ' + MONTHS_GEN[d.getMonth()] + (sc ? ': ' + sc.idx + '%' : ': нет данных')
    };
  });

  const avg = idxDays ? Math.round(idxSum / idxDays) : null;
  const normalPct = stools ? Math.round(normal / stools * 100) : null;
  // «Чаще всего» — тип, который отмечали чаще за неделю (при равенстве — ближе к норме, к 4)
  const topType = Object.keys(typeCount).map(Number)
    .sort((a, b) => typeCount[b] - typeCount[a] || Math.abs(a - 4) - Math.abs(b - 4))[0] || null;
  const cdToday = cycleDay(p, todayK, todayK);

  return {
    weekLabel: weekLabel(first),
    avg: avg == null ? '—' : avg,
    hasAvg: avg != null,
    avgTone: 'dot lg ' + toneOf(avg),
    avgWord: TONE_WORD[toneOf(avg)],
    bars,
    normalPct: normalPct == null ? '—' : normalPct + '%',
    topType: topType || '–',
    topTypeUnit: topType ? ' тип' : '',
    topTypeCls: 'gvalue num' + (topType ? '' : ' is-dash'),
    symptomDays,
    pastDays,
    symptomDaysText: symptomDays + ' из ' + pastDays,
    fiberAvg: meals ? (fiberSum / meals).toFixed(1).replace('.', ',') + ' г' : '—',
    noticed: noticedText(app, todayK, { dataDays, normalPct, symptomDays }),
    showCycleNote: cdToday > 0 && !p.coc,
    daysToLuteal: daysToLuteal(cdToday, p.len)
  };
}

/** '7 дней, 3–9 ноября' или '7 дней, 29 сентября – 5 октября' */
function weekLabel(firstK) {
  const a = parseKey(firstK), b = parseKey(addDays(firstK, 6));
  return '7 дней, ' + (a.getMonth() === b.getMonth()
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
  const normal = stats.normalPct == null ? '' : 'За 7 дней гладкий стул (тип 3–4) был в ' + stats.normalPct + '% случаев. ';
  return normal + 'Дней с дискомфортом: ' + stats.symptomDays + '.';
}
