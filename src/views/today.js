// «Сегодня»: шапка (аватар, стрик, переключатель дня), показатель дня, кольца, совет, цикл, записи дня.
// Базовые блоки видны всегда — даже в первый день без записей.
import { IS_DEMO } from '../config.js';
import { BRISTOL_TYPES, FALLBACK_TIPS, SYMPTOM_OK, STOOL_COLORS, stressWord } from '../domain/catalog.js';
import { mealSummary, mealTint } from '../domain/meal.js';
import { parseKey, addDays, dayMonthShort, WEEKDAYS_SHORT } from '../domain/dates.js';
import { gutScore, toneOf, TONE_COLOR } from '../domain/score.js';
import { cycleDay, cyclePhase, isPeriodDay, PREGNANCY_NOTE } from '../domain/cycle.js';
import { streakDays } from '../domain/streak.js';
import { DEMO_TIP_CALM } from '../domain/demo.js';

const RING_LENGTH = 263.9; // длина окружности r=42 в SVG колец (viewBox 100)

const EMPTY_TIPS = {
  today: ['Начнём с одной записи', 'Отметьте стул, самочувствие или еду — и здесь появится совет на сегодня.'],
  past: ['В этот день записей нет', 'Ничего страшного — продолжайте с сегодняшнего дня.']
};

export function todayView(app) {
  const s = app.state, p = s.profile, todayK = app.today();
  const sel = s.selected, day = app.day(sel), isToday = sel === todayK;
  const since = (p.since || '').slice(0, 10);
  const sc = gutScore(day);
  const tone = toneOf(sc ? sc.idx : null);
  const cd = cycleDay(p, sel, todayK);

  return {
    // шапка
    initial: (p.name.trim()[0] || '·').toUpperCase(),
    avatarUrl: s.avatarUrl,
    noAvatar: !s.avatarUrl,
    goProfile: () => app.navigate('profile', 'avatar'),
    streak: streakDays(s.log, todayK),
    dayLabel: dayLabel(sel, todayK),
    prevCls: 'day-arrow' + (since && sel <= since ? ' off' : ''),
    nextCls: 'day-arrow' + (isToday ? ' off' : ''),
    prevDay: () => app.shiftDay(-1),
    nextDay: () => app.shiftDay(1),

    // показатель дня
    gutTone: isPeriodDay(p, day, cd) ? 'cycle' : sc ? tone : 'empty',
    idx: sc ? sc.idx : '—',
    hasScore: !!sc,
    rings: rings(sc),
    goInsights: () => app.navigate('insights', 'today_summary'),
    showAddButton: isToday && !sc,
    goAddFromEmpty: () => app.navigate('add', 'empty_day'),

    tip: tipOf(s, sc, tone, isToday, todayK),
    ...cycleCard(p, cd),
    timeline: timeline(app, sel, day, p)
  };
}

function dayLabel(k, todayK) {
  if (k === todayK) return 'Сегодня';
  if (k === addDays(todayK, -1)) return 'Вчера';
  return WEEKDAYS_SHORT[(parseKey(k).getDay() + 6) % 7] + ', ' + dayMonthShort(k);
}

/** Карточка цикла: беременность, фаза (на КОК — упрощённо) или ничего */
function cycleCard(p, cd) {
  if (p.cycle && p.pregnant) return { showCycle: true, cycle: { caption: 'Цикл', phase: PREGNANCY_NOTE[0], note: PREGNANCY_NOTE[1] } };
  if (!cd) return { showCycle: false, cycle: null };
  const [phase, note] = cyclePhase(cd, p.len, p.coc);
  return { showCycle: true, cycle: { caption: 'Цикл · день ' + cd + ' из ' + p.len + (p.coc ? ' · КОК' : ''), phase, note } };
}

/** Три кольца: стул, форма, комфорт. Без записей — пустые кольца с «—». */
function rings(sc) {
  const ring = (label, value, text, sub) => ({
    label, sub, text,
    dash: value == null ? '0' : (value / 100 * RING_LENGTH).toFixed(1),
    color: value == null ? 'transparent' : TONE_COLOR[toneOf(value)]
  });
  if (!sc) return [ring('Стул', null, '—', 'нет записи'), ring('Форма', null, '—', 'нет записи'), ring('Комфорт', null, '—', 'нет записи')];
  const symSub = sc.sym.length === 1 ? sc.sym[0].toLowerCase() : sc.sym.length ? sc.sym.length + ' симптома' : 'без симптомов';
  return [
    ring('Стул', sc.reg, sc.n + '×', sc.n ? (sc.n === 1 ? 'раз за день' : 'раза за день') : (sc.had ? 'не было' : 'не отмечено')),
    ring('Форма', sc.last ? sc.form : null, sc.last ? String(sc.last) : '—', sc.last ? 'тип ' + sc.last + (sc.last === 3 || sc.last === 4 ? ' · норма' : '') : 'нет стула'),
    ring('Комфорт', sc.comfort, sc.comfort + '%', symSub)
  ];
}

/** Совет ИИ на сегодня, если есть; иначе — заготовка по тону дня */
function tipOf(s, sc, tone, isToday, todayK) {
  if (!sc) { const [title, text] = EMPTY_TIPS[isToday ? 'today' : 'past']; return { title, text }; }
  const ai = s.insights;
  if (isToday && ai && ai.date === todayK && ai.tipTitle) return { title: ai.tipTitle, text: ai.tipText };
  const [title, text] = FALLBACK_TIPS[tone] || FALLBACK_TIPS.mild;
  return { title, text: IS_DEMO && tone === 'calm' ? DEMO_TIP_CALM : text };
}

const colorLabel = (id) => ((STOOL_COLORS.find((c) => c.id === id) || {}).label || '').toLowerCase();

/** Записи дня по времени. Стул, самочувствие и еду можно открыть и поправить. */
function timeline(app, dayK, day, profile) {
  const items = [];
  for (const g of day.gut) {
    const sym = g.sym.filter((v) => v !== SYMPTOM_OK);
    const parts = [sym.length ? sym.join(', ').toLowerCase() : 'без дискомфорта'];
    if (g.color) parts.unshift(colorLabel(g.color));
    if (g.stress != null) parts.push('стресс ' + g.stress + ' · ' + stressWord(g.stress).toLowerCase());
    const open = () => app.openEntry(dayK, g.id);
    if (g.type > 0) items.push({ kind: 'stool', type: String(g.type), title: 'Стул · тип ' + g.type + ' · ' + BRISTOL_TYPES[g.type].replace(' — норма', '').toLowerCase(), sub: parts.join(' · '), time: g.time, open });
    else items.push({ kind: 'feel', title: g.type === 0 ? 'Стула не было' : 'Самочувствие', sub: parts.join(' · '), time: g.time, open });
  }
  for (const m of day.meals) {
    items.push({ kind: 'meal', tint: mealTint(m), photo: m.photo, title: m.name, sub: mealSummary(m), time: m.time, open: () => app.openMeal(dayK, m.id) });
  }
  if (profile.cycle && day.period) items.push({ kind: 'period', title: 'Месячные', sub: 'отмечено вручную', time: 'день', sortKey: '00:00' });
  items.sort((a, b) => (a.sortKey || a.time).localeCompare(b.sortKey || b.time));
  return items.map((e) => ({
    ...e,
    rowCls: 'row' + (e.open ? ' tappable' : ''),
    hasOpen: !!e.open,
    isStool: e.kind === 'stool', isMeal: e.kind === 'meal', isFeel: e.kind === 'feel', isPeriod: e.kind === 'period'
  }));
}
