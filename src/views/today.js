// «Сегодня»: неделя, показатель дня, кольца, совет, цикл, вопрос ИИ, записи дня.
import { IS_DEMO } from '../config.js';
import { BRISTOL_TYPES, FALLBACK_TIPS, SYMPTOM_OK } from '../domain/catalog.js';
import { mealSummary, mealTint } from '../domain/meal.js';
import { parseKey, addDays, diffDays, mondayOf, dayMonth, WEEKDAYS_SHORT, WEEKDAYS_FULL, MONTHS_GEN } from '../domain/dates.js';
import { gutScore, toneOf, TONE_COLOR } from '../domain/score.js';
import { cycleDay, cyclePhase, isPeriodDay, PREGNANCY_NOTE } from '../domain/cycle.js';
import { DEMO_TIP_CALM } from '../domain/demo.js';

const RING_LENGTH = 238.8; // длина окружности r=38 в SVG колец

export function todayView(app) {
  const s = app.state, p = s.profile, todayK = app.today();
  const sel = s.selected, day = app.day(sel), isToday = sel === todayK;
  const sc = gutScore(day);
  const tone = toneOf(sc ? sc.idx : null);
  const cd = cycleDay(p, sel, todayK);
  const periodToday = isPeriodDay(p, day, cd);

  return {
    hello: p.name.trim() ? 'Привет, ' + p.name.trim() : 'Привет',
    initial: (p.name.trim()[0] || '·').toUpperCase(),
    avatarUrl: s.avatarUrl,
    noAvatar: !s.avatarUrl,
    dateLong: (isToday ? 'Сегодня, ' : WEEKDAYS_FULL[parseKey(sel).getDay()] + ', ') + dayMonth(sel),
    goProfile: () => app.navigate('profile', 'avatar'),

    week: weekStrip(app, todayK),

    hasScore: !!sc,
    noScore: !sc,
    isToday,
    gutTone: periodToday ? 'cycle' : tone,
    idx: sc ? sc.idx : '—',
    rings: sc ? rings(sc) : [],
    tip: tipOf(s, tone, isToday, todayK),

    ...cycleCard(p, cd),
    openAssistant: () => app.openAssistant('today'),
    goInsights: () => app.navigate('insights', 'today_summary'),

    timeline: timeline(app, sel, day, p),
    goAddFromEmpty: () => app.navigate('add', 'empty_day')
  };
}

/** Карточка цикла: беременность, фаза (на КОК — упрощённо) или ничего */
function cycleCard(p, cd) {
  if (p.cycle && p.pregnant) return { showCycle: true, cycle: { caption: 'Цикл', phase: PREGNANCY_NOTE[0], note: PREGNANCY_NOTE[1] } };
  if (!cd) return { showCycle: false, cycle: null };
  const [phase, note] = cyclePhase(cd, p.len, p.coc);
  return { showCycle: true, cycle: { caption: 'Цикл · день ' + cd + ' из ' + p.len + (p.coc ? ' · КОК' : ''), phase, note } };
}

function weekStrip(app, todayK) {
  const s = app.state, p = s.profile, monday = mondayOf(todayK);
  return WEEKDAYS_SHORT.map((dow, i) => {
    const k = addDays(monday, i), d = parseKey(k);
    // будущие дни и дни до начала использования неактивны
    const future = k > todayK || (!!p.since && k < p.since.slice(0, 10));
    const day = app.day(k), sc = gutScore(day);
    const period = isPeriodDay(p, day, cycleDay(p, k, todayK));
    return {
      dow,
      num: d.getDate(),
      cls: 'day' + (k === s.selected ? ' sel' : '') + (future ? ' future' : ''),
      dot: 'dot' + (future ? '' : ' ' + toneOf(sc ? sc.idx : null)),
      aria: d.getDate() + ' ' + MONTHS_GEN[d.getMonth()] + (sc ? ', ' + sc.idx + '%' : '') + (period ? ', месячные' : ''),
      pick: () => { if (!future) app.selectDay(k, diffDays(todayK, k), !!sc); }
    };
  });
}

function rings(sc) {
  const ring = (label, value, text, sub) => ({
    label, sub, text,
    dash: value == null ? '0' : (value / 100 * RING_LENGTH).toFixed(1),
    color: value == null ? 'transparent' : TONE_COLOR[toneOf(value)]
  });
  const symSub = sc.sym.length === 1 ? sc.sym[0].toLowerCase() : sc.sym.length ? sc.sym.length + ' симптома' : 'без симптомов';
  return [
    ring('Стул', sc.reg, sc.n + '×', sc.n ? (sc.n === 1 ? 'раз за день' : 'раза за день') : (sc.had ? 'стула не было' : 'не отмечено')),
    ring('Форма', sc.last ? sc.form : null, sc.last ? String(sc.last) : '—', sc.last ? 'тип ' + sc.last + (sc.last === 3 || sc.last === 4 ? ' · норма' : '') : 'нет стула'),
    ring('Комфорт', sc.comfort, sc.comfort + '%', symSub)
  ];
}

/** Совет ИИ на сегодня, если есть; иначе — заготовка по тону дня */
function tipOf(s, tone, isToday, todayK) {
  const ai = s.insights;
  if (isToday && ai && ai.date === todayK && ai.tipTitle) return { title: ai.tipTitle, text: ai.tipText };
  const [title, text] = FALLBACK_TIPS[tone] || FALLBACK_TIPS.mild;
  return { title, text: IS_DEMO && tone === 'calm' ? DEMO_TIP_CALM : text };
}

/** Записи дня по времени: стул, самочувствие, еда, месячные */
function timeline(app, dayK, day, profile) {
  const items = [];
  for (const g of day.gut) {
    const sym = g.sym.filter((v) => v !== SYMPTOM_OK);
    const symText = sym.length ? sym.join(', ').toLowerCase() : 'без дискомфорта';
    if (g.type > 0) items.push({ kind: 'stool', type: String(g.type), title: 'Стул · тип ' + g.type, sub: BRISTOL_TYPES[g.type].toLowerCase() + ' · ' + symText, time: g.time });
    else items.push({ kind: 'feel', title: g.type === 0 ? 'Стула не было' : 'Самочувствие', sub: symText, time: g.time });
  }
  for (const m of day.meals) {
    items.push({ kind: 'meal', tint: mealTint(m), photo: m.photo, title: m.name, sub: mealSummary(m), time: m.time, open: () => app.openMeal(dayK, m.id) });
  }
  if (profile.cycle && day.period) items.push({ kind: 'period', title: 'Месячные', sub: 'отмечено вручную', time: 'день', sortKey: '00:00' });
  items.sort((a, b) => (a.sortKey || a.time).localeCompare(b.sortKey || b.time));
  return items.map((e) => ({
    ...e,
    rowCls: 'row' + (e.open ? ' tappable' : ''),
    isStool: e.kind === 'stool', isMeal: e.kind === 'meal', isFeel: e.kind === 'feel', isPeriod: e.kind === 'period'
  }));
}
