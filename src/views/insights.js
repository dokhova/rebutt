// «Инсайты»: средний показатель недели, столбики по дням, статистика, наблюдение ИИ, вопросы к ИИ.
import { IS_DEMO } from '../config.js';
import { AI_SUGGESTED_QUESTIONS } from '../domain/catalog.js';
import { parseKey, addDays, mondayOf, MONTHS_GEN, WEEKDAYS_SHORT } from '../domain/dates.js';
import { gutScore, symptomsOf, toneOf, hasData, TONE_WORD, TONE_COLOR } from '../domain/score.js';
import { cycleDay, daysToLuteal } from '../domain/cycle.js';

const BAR_MAX_PX = 90;
const BAR_MIN_PX = 12;

export function insightsView(app) {
  const s = app.state, p = s.profile, todayK = app.today(), monday = mondayOf(todayK);
  let stools = 0, normal = 0, symptomDays = 0, fiberSum = 0, meals = 0, idxSum = 0, idxDays = 0, dataDays = 0;

  const bars = WEEKDAYS_SHORT.map((dow, i) => {
    const k = addDays(monday, i), d = parseKey(k);
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
    weekLabel: weekLabel(monday),
    avg: avg == null ? '—' : avg,
    hasAvg: avg != null,
    avgTone: 'dot lg ' + toneOf(avg),
    avgWord: TONE_WORD[toneOf(avg)],
    bars,
    normalPct: normalPct == null ? '—' : normalPct + '%',
    symptomDays,
    fiberAvg: meals ? (fiberSum / meals).toFixed(1).replace('.', ',') + ' г' : '—',
    noticed: noticedText(app, todayK, { dataDays, normalPct, symptomDays }),
    showCycleNote: cdToday > 0,
    daysToLuteal: daysToLuteal(cdToday, p.len),

    suggestions: AI_SUGGESTED_QUESTIONS.map((q) => ({ q, pick: () => app.ask(q, 'suggestion') })),
    hasChat: !!s.ai.question,
    question: s.ai.question,
    answer: s.ai.loading ? 'Думаю…' : s.ai.answer,
    answerCls: 'card bubble-a' + (s.ai.loading ? ' pulse' : ''),
    askText: s.askText,
    onAskInput: (e) => app.setState({ askText: e.target.value }),
    sendAsk: () => app.ask(s.askText.trim(), 'custom')
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
