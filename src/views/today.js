// «Сегодня»: шапка (аватар, день, календарь), дуга «работа кишечника», показатели дня,
// «Что может помочь», цикл, записи дня. Базовые блоки видны всегда — даже в первый день без записей.
import { IS_DEMO } from '../config.js';
import { BRISTOL_TYPES, FALLBACK_TIPS, SYMPTOM_OK, STOOL_COLORS, stressWord } from '../domain/catalog.js';
import { dailyTargets } from '../domain/targets.js';
import { mealSummary, mealTint } from '../domain/meal.js';
import { parseKey, addDays, dayMonth, WEEKDAYS_SHORT, WEEKDAYS_FULL } from '../domain/dates.js';
import { gutScore, toneOf, TONE_COLOR, fiberOf, waterOf, hasData } from '../domain/score.js';
import { suggestionsFor, litres } from '../domain/suggestions.js';
import { cycleDay, cyclePhase, isPeriodDay, PREGNANCY_NOTE, MENOPAUSE_NOTE } from '../domain/cycle.js';
import { DEMO_TIP_CALM } from '../domain/demo.js';

// Дуга: нижняя полуокружность в SVG 350×300, центр (175, 115), радиус 155 — те же числа в templates/screens/today.html.
// Заполняется слева направо: 0% — левый край, 100% — правый.
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
    idx: sc ? sc.idx : '',
    hasScore: !!sc,
    noScore: !sc,
    ...arc(sc, arcTone),
    goInsights: () => app.navigate('insights', 'today_summary'),
    showAddButton: isToday && !sc,
    goAddFromEmpty: () => app.openAddSheet('empty_day'),

    // показатели и подсказки
    ...metrics(sc, day, app, dailyTargets(p)),
    tips: tipsOf(s, day, sc, tone, isToday, todayK, { targets: dailyTargets(p), goals: p.goals }),

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
    knobX: (ARC.cx - ARC.r * Math.cos(a)).toFixed(1),
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
function metrics(sc, day, app, targets) {
  const VAL = 'metric-value num', EMPTY = { text: 'не отмечено', cls: 'metric-value is-empty', unit: '', bar: bar(0, 'empty') };

  // стул: сколько раз из обычных 1–3 («не было» — честный 0)
  const stool = !sc || (!sc.n && !sc.had) ? EMPTY
    : { text: String(sc.n), cls: VAL, unit: sc.n > 1 && sc.n < 5 ? ' раза' : ' раз', bar: bar(Math.min(sc.n, 3) / 3 * 100, toneOf(sc.reg)) };

  // форма: тип по Бристольской шкале; полоска — насколько форма близка к ровной (score.js → form)
  const form = !sc || !sc.last ? EMPTY : { text: String(sc.last), cls: VAL, unit: ' тип', bar: bar(sc.form, toneOf(sc.form)) };

  // комфорт: по отмеченному самочувствию
  const comfort = !sc ? EMPTY : { text: String(sc.comfort), cls: VAL, unit: ' %', bar: bar(sc.comfort, toneOf(sc.comfort)) };

  // клетчатка и жидкость — к дневному ориентиру; не отмечено — подпись, а не «—» или 0
  const fiber = fiberOf(day), water = waterOf(day);
  const fiberPct = fiber == null ? 0 : fiber / targets.fiberG * 100, waterPct = water / targets.waterMl * 100;
  return {
    // пустой день по стулу и самочувствию: вместо трёх прочерков — одна строка-приглашение
    noGut: !sc,
    hasGut: !!sc,
    addStool: () => app.pickAddSection('stool'),
    addFood: () => app.pickAddSection('food'),
    addWater: () => app.pickAddSection('water'),
    stool, form, comfort,
    fiber: fiber == null
      ? { text: 'нет еды', cls: 'metric-tile-value is-empty', unit: '', bar: bar(0, 'empty') }
      : { text: String(fiber), cls: 'metric-tile-value num', unit: ' из ' + targets.fiberG + ' г', bar: bar(fiberPct, toneOf(fiberPct)) },
    water: !water
      ? { text: 'не отмечено', cls: 'metric-tile-value is-empty', unit: '', bar: bar(0, 'empty') }
      : { text: litres(water), cls: 'metric-tile-value num', unit: ' из ' + litres(targets.waterMl) + ' л', bar: bar(waterPct, toneOf(waterPct)) }
  };
}

/** «Что может помочь»: совет ИИ на сегодня (если есть) + правила из domain/suggestions.js; пусто — заготовка по тону */
function tipsOf(s, day, sc, tone, isToday, todayK, opts) {
  const items = [];
  const ai = s.insights;
  if (isToday && sc && ai && ai.date === todayK && ai.tipTitle) items.push({ id: 'ai', icon: 'ai', tone: 'calm', title: ai.tipTitle, text: ai.tipText });
  if (hasData(day)) items.push(...suggestionsFor(day, sc, opts)); // пустой день — без подсказок, только приглашение
  if (!items.length) {
    const [title, text] = !hasData(day) ? EMPTY_TIPS[isToday ? 'today' : 'past'] : FALLBACK_TIPS[tone] || FALLBACK_TIPS.mild;
    items.push({ id: 'fallback', icon: 'calm', tone: 'mild', title, text: IS_DEMO && tone === 'calm' && sc ? DEMO_TIP_CALM : text });
  }
  return items.slice(0, MAX_TIPS).map((t) => ({
    ...t,
    tileCls: 'tip-icon ' + t.tone,
    isWater: t.icon === 'water', isFiber: t.icon === 'fiber', isWalk: t.icon === 'walk',
    isWarm: t.icon === 'warm' || t.icon === 'slow', isCalm: t.icon === 'calm', isAi: t.icon === 'ai', isPhoto: t.icon === 'photo'
  }));
}

/** Карточка цикла: беременность, фаза (на КОК — упрощённо) или ничего */
function cycleCard(p, cd) {
  if (p.cycle && p.menopause) return { showCycle: true, cycle: { caption: 'Цикл', phase: MENOPAUSE_NOTE[0], note: MENOPAUSE_NOTE[1] } };
  if (p.cycle && p.pregnant) return { showCycle: true, cycle: { caption: 'Цикл', phase: PREGNANCY_NOTE[0], note: PREGNANCY_NOTE[1] } };
  if (!cd) return { showCycle: false, cycle: null };
  const [phase, note] = cyclePhase(cd, p.len, p.coc);
  return { showCycle: true, cycle: { caption: 'Цикл · день ' + cd + ' из ' + p.len + (p.coc ? ' · КОК' : ''), phase, note } };
}

const colorLabel = (id) => ((STOOL_COLORS.find((c) => c.id === id) || {}).label || '').toLowerCase();

/** Записи дня по времени. Любую запись можно открыть: поправить или удалить. */
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
  if (day.water > 0) items.push({ kind: 'water', title: 'Жидкость', sub: litres(day.water) + ' л за день', time: 'день', sortKey: '00:01', open: () => app.openWater(dayK) });
  if (profile.cycle && day.period) items.push({ kind: 'period', title: 'Месячные', sub: 'нажмите, чтобы убрать отметку', time: 'день', sortKey: '00:00', open: () => app.deletePeriod(dayK) });
  items.sort((a, b) => (a.sortKey || a.time).localeCompare(b.sortKey || b.time));
  return items.map((e) => ({
    ...e,
    rowCls: 'row' + (e.open ? ' tappable' : ''),
    titleCls: 'row-title' + (e.kind === 'meal' ? ' wrap' : ' nowrap'),
    hasOpen: !!e.open,
    isStool: e.kind === 'stool', isMeal: e.kind === 'meal', isFeel: e.kind === 'feel', isPeriod: e.kind === 'period', isWater: e.kind === 'water'
  }));
}
