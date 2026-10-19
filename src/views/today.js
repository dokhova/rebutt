// «Сегодня»: шапка (аватар, день, календарь), дуга «работа кишечника», показатели дня,
// «Что может помочь», цикл, записи дня. Базовые блоки видны всегда — даже в первый день без записей.
import { IS_DEMO } from '../config.js';
import { BRISTOL_TYPES, FALLBACK_TIPS, SYMPTOM_OK, STOOL_COLORS, FIBER_GOAL_G, WATER_GOAL_ML, stressWord } from '../domain/catalog.js';
import { mealSummary, mealTint } from '../domain/meal.js';
import { parseKey, addDays, dayMonth, WEEKDAYS_SHORT, WEEKDAYS_FULL } from '../domain/dates.js';
import { gutScore, toneOf, TONE_COLOR, fiberOf, waterOf } from '../domain/score.js';
import { suggestionsFor, litres } from '../domain/suggestions.js';
import { cycleDay, cyclePhase, isPeriodDay, PREGNANCY_NOTE } from '../domain/cycle.js';
import { DEMO_TIP_CALM } from '../domain/demo.js';

// Дуга: нижняя полуокружность в SVG 350×300, центр (175, 115), радиус 155 — те же числа в templates/screens/today.html
const ARC = { cx: 175, cy: 115, r: 155 };
const MAX_TIPS = 3;

// RGB тонов для свечения за дугой (цвета — TONE_COLOR)
const TONE_RGB = { calm: '211,250,157', mild: '127,168,102', sens: '167,139,250', cycle: '121,84,200' };

const EMPTY_TIPS = {
  today: ['Начнём с одной записи', 'Отметь стул, еду или воду — и здесь появятся подсказки на сегодня.'],
  past: ['В этот день записей нет', 'Ничего страшного — продолжай с сегодняшнего дня.']
};

export function todayView(app) {
  const s = app.state, p = s.profile, todayK = app.today();
  const sel = s.selected, day = app.day(sel), isToday = sel === todayK;
  const since = (p.since || '').slice(0, 10);
  const sc = gutScore(day);
  const tone = toneOf(sc ? sc.idx : null);
  const cd = cycleDay(p, sel, todayK);
  const arcTone = isPeriodDay(p, day, cd) && sc ? 'cycle' : tone;

  return {
    // шапка
    initial: (p.name.trim()[0] || '·').toUpperCase(),
    avatarUrl: s.avatarUrl,
    noAvatar: !s.avatarUrl,
    goProfile: () => app.navigate('profile', 'avatar'),
    ...dayTitle(sel, todayK),
    dateMin: since || addDays(todayK, -90),
    dateMax: todayK,
    dateValue: sel,
    pickDay: (e) => app.pickDay(e.target.value),

    // дуга
    idx: sc ? sc.idx : '—',
    hasScore: !!sc,
    ...arc(sc, arcTone),
    goInsights: () => app.navigate('insights', 'today_summary'),
    showAddButton: isToday && !sc,
    goAddFromEmpty: () => app.openAddSheet('empty_day'),

    // показатели и подсказки
    ...metrics(sc, day),
    tips: tipsOf(s, day, sc, tone, isToday, todayK),

    ...cycleCard(p, cd),
    timeline: timeline(app, sel, day, p)
  };
}

/** «Сегодня / пн, 19 октября», «Вчера / 18 октября», «Пятница / 16 октября» */
function dayTitle(k, todayK) {
  const wd = (parseKey(k).getDay() + 6) % 7;
  if (k === todayK) return { dayLabel: 'Сегодня', dateSub: WEEKDAYS_SHORT[wd].toLowerCase() + ', ' + dayMonth(k) };
  if (k === addDays(todayK, -1)) return { dayLabel: 'Вчера', dateSub: WEEKDAYS_SHORT[wd].toLowerCase() + ', ' + dayMonth(k) };
  return { dayLabel: WEEKDAYS_FULL[parseKey(k).getDay()], dateSub: dayMonth(k) };
}

/** Дуга: сколько закрашено, где ползунок, цвет и свечение по тону */
function arc(sc, tone) {
  if (!sc) return { arcDash: '0 100', knobX: 0, knobY: 0, knobR: 0, haloR: 0, arcColor: TONE_COLOR.empty, glowStyle: 'background: none' };
  const a = (sc.idx / 100) * Math.PI, rgb = TONE_RGB[tone] || TONE_RGB.mild;
  return {
    arcDash: sc.idx + ' 100',
    knobX: (ARC.cx + ARC.r * Math.cos(a)).toFixed(1),
    knobY: (ARC.cy + ARC.r * Math.sin(a)).toFixed(1),
    knobR: 6.5,
    haloR: 12,
    arcColor: TONE_COLOR[tone] || TONE_COLOR.mild,
    glowStyle: 'background: radial-gradient(circle, rgba(' + rgb + ',.2) 0%, rgba(' + rgb + ',.08) 40%, rgba(' + rgb + ',0) 70%)'
  };
}

const bar = (pct, tone) => ({ width: 'width: ' + Math.max(0, Math.min(100, Math.round(pct))) + '%', cls: 'mbar-fill ' + tone });

/** Стул, форма, комфорт + плитки клетчатки и жидкости. Нет данных — «—», а не 0.
 *  У всех одна и та же тонкая полоска: насколько показатель близок к ровному дню (цвет — по тем же порогам, что у дуги). */
function metrics(sc, day) {
  // стул: сколько раз из обычных 1–3
  const stool = !sc
    ? { value: '—', unit: '', bar: bar(0, 'empty') }
    : { value: String(sc.n), unit: sc.n > 1 && sc.n < 5 ? 'раза' : 'раз', bar: bar(Math.min(sc.n, 3) / 3 * 100, toneOf(sc.reg)) };

  // форма: тип по Бристольской шкале; полоска — насколько форма близка к ровной (score.js → form)
  const form = !sc || !sc.last
    ? { value: '—', bar: bar(0, 'empty') }
    : { value: String(sc.last), bar: bar(sc.form, toneOf(sc.form)) };

  // комфорт: по отмеченному самочувствию
  const comfort = !sc
    ? { value: '—', bar: bar(0, 'empty') }
    : {
      value: String(sc.comfort),
      bar: bar(sc.comfort, toneOf(sc.comfort))
    };

  // клетчатка и жидкость — к дневному ориентиру
  const fiber = fiberOf(day), water = waterOf(day);
  const fiberPct = fiber == null ? 0 : fiber / FIBER_GOAL_G * 100, waterPct = water / WATER_GOAL_ML * 100;
  return {
    stool, form, comfort,
    hasComfort: !!sc,
    fiber: { value: fiber == null ? '—' : String(fiber), goal: 'из ' + FIBER_GOAL_G + ' г', bar: bar(fiberPct, fiber == null ? 'empty' : toneOf(fiberPct)) },
    water: { value: litres(water), goal: 'из ' + litres(WATER_GOAL_ML) + ' л', bar: bar(waterPct, water ? toneOf(waterPct) : 'empty') }
  };
}

/** «Что может помочь»: совет ИИ на сегодня (если есть) + правила из domain/suggestions.js; пусто — заготовка по тону */
function tipsOf(s, day, sc, tone, isToday, todayK) {
  const items = [];
  const ai = s.insights;
  if (isToday && sc && ai && ai.date === todayK && ai.tipTitle) items.push({ id: 'ai', icon: 'ai', tone: 'calm', title: ai.tipTitle, text: ai.tipText });
  items.push(...suggestionsFor(day, sc));
  if (!items.length) {
    const [title, text] = !sc ? EMPTY_TIPS[isToday ? 'today' : 'past'] : FALLBACK_TIPS[tone] || FALLBACK_TIPS.mild;
    items.push({ id: 'fallback', icon: 'calm', tone: 'mild', title, text: IS_DEMO && tone === 'calm' && sc ? DEMO_TIP_CALM : text });
  }
  return items.slice(0, MAX_TIPS).map((t) => ({
    ...t,
    tileCls: 'tip-icon ' + t.tone,
    isWater: t.icon === 'water', isFiber: t.icon === 'fiber', isWalk: t.icon === 'walk',
    isWarm: t.icon === 'warm' || t.icon === 'slow', isCalm: t.icon === 'calm', isAi: t.icon === 'ai'
  }));
}

/** Карточка цикла: беременность, фаза (на КОК — упрощённо) или ничего */
function cycleCard(p, cd) {
  if (p.cycle && p.pregnant) return { showCycle: true, cycle: { caption: 'Цикл', phase: PREGNANCY_NOTE[0], note: PREGNANCY_NOTE[1] } };
  if (!cd) return { showCycle: false, cycle: null };
  const [phase, note] = cyclePhase(cd, p.len, p.coc);
  return { showCycle: true, cycle: { caption: 'Цикл · день ' + cd + ' из ' + p.len + (p.coc ? ' · КОК' : ''), phase, note } };
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
  if (day.water > 0) items.push({ kind: 'water', title: 'Жидкость', sub: litres(day.water) + ' л за день', time: 'день', sortKey: '00:01' });
  if (profile.cycle && day.period) items.push({ kind: 'period', title: 'Месячные', sub: 'отмечено вручную', time: 'день', sortKey: '00:00' });
  items.sort((a, b) => (a.sortKey || a.time).localeCompare(b.sortKey || b.time));
  return items.map((e) => ({
    ...e,
    rowCls: 'row' + (e.open ? ' tappable' : ''),
    hasOpen: !!e.open,
    isStool: e.kind === 'stool', isMeal: e.kind === 'meal', isFeel: e.kind === 'feel', isPeriod: e.kind === 'period', isWater: e.kind === 'water'
  }));
}
