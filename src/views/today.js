// «Сегодня»: шапка (аватар, день, календарь), карточка «Комфорт за день» с кольцом, плитки показателей,
// «Что может помочь», цикл, записи дня. Базовые блоки видны всегда — даже в первый день без записей.
import { IS_DEMO } from '../config.js';
import { BRISTOL_TYPES, FALLBACK_TIPS, SYMPTOM_OK, STOOL_COLORS, stressWord } from '../domain/catalog.js';
import { dailyTargets } from '../domain/targets.js';
import { mealSummary, mealTint } from '../domain/meal.js';
import { parseKey, addDays, dayMonth, WEEKDAYS_SHORT, WEEKDAYS_FULL } from '../domain/dates.js';
import { gutScore, toneOf, fiberOf, waterOf, hasData } from '../domain/score.js';
import { suggestionsFor, suggestionsFromHistory, litres } from '../domain/suggestions.js';
import { cycleDay, cycleHint, isPeriodDay } from '../domain/cycle.js';
import { DEMO_TIP_CALM } from '../domain/demo.js';

/** На главной — не больше двух подсказок, одна строка каждая: читать должно быть быстро */
const MAX_TIPS = 2;

const EMPTY_TIPS = {
  today: ['Начнём с одной записи', 'Отметь стул, еду или воду — и здесь появятся подсказки на сегодня.'],
  past: ['В этот день записей нет', 'Если забыли отметить — внесите стул, еду или воду за этот день через «+».']
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
    ...dayTitle(sel, todayK),
    dateMin: since || addDays(todayK, -90),
    dateMax: todayK,
    dateValue: sel,
    pickDay: (e) => app.pickDay(e.target.value),

    // пустой день — кнопка внести данные; для прошлого дня «+» пишет именно в него (App.entryDay)

    // показатели и подсказки
    ...metrics(sc, day, app, dailyTargets(p)),
    tips: tipsOf(s, day, sc, tone, isToday, todayK, { targets: dailyTargets(p), goals: p.goals }),

    ...cycleCard(p, day, cd),
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

const bar = (pct, tone) => ({ width: 'width: ' + Math.max(0, Math.min(100, Math.round(pct))) + '%', cls: 'mbar-fill ' + tone });

/** Стул, форма, комфорт (большая карточка с кольцом) + плитки клетчатки и жидкости.
 *  Нет данных — тусклые «0» / «–» той же высоты: пустой день выглядит так же, как заполненный.
 *  Полоски на стекле всегда лаймовые: это ориентир, не оценка. */
function metrics(sc, day, app, targets) {
  const TILE = 'gvalue num', DIM = 'gvalue num is-dash';
  const empty = (unit, text = '0') => ({ text, tileCls: DIM, unit, bar: bar(0, 'empty') });

  // стул: сколько раз из обычных 1–3 («не было» — честный 0)
  const stool = !sc || (!sc.n && !sc.had) ? empty(' раз')
    // 1–3 раза в день — обычно, поэтому уже один раз заполняет полоску целиком: «нужно больше» здесь неверный сигнал
    : { text: String(sc.n), tileCls: TILE, unit: sc.n > 1 && sc.n < 5 ? ' раза' : ' раз', bar: bar(sc.n > 0 ? 100 : 0, toneOf(sc.reg)) };

  // форма: тип по Бристольской шкале; на плитке — 7 точек, выбранная крупнее
  const form = !sc || !sc.last ? empty(' тип', '–') : { text: String(sc.last), tileCls: TILE, unit: ' тип', bar: bar(sc.form, toneOf(sc.form)) };
  const formDots = [1, 2, 3, 4, 5, 6, 7].map((n) => ({ cls: 'gdot' + (sc && sc.last === n ? ' on' : '') }));

  // комфорт за день — главная цифра: по отмеченному самочувствию
  const hasComfort = !!sc && sc.comfort != null;
  const comfort = hasComfort
    ? { text: String(sc.comfort), heroCls: 'hero-value num' }
    : { text: '–', heroCls: 'hero-value num is-dash' };
  const C = 2 * Math.PI * 50, pct = hasComfort ? Math.max(0, Math.min(100, sc.comfort)) / 100 : 0;
  const ring = { dash: (C * pct).toFixed(1) + ' ' + C.toFixed(1), text: hasComfort ? String(sc.comfort) : '–', cls: 'ring-num' + (hasComfort ? '' : ' is-dash') };

  // клетчатка и жидкость — к дневному ориентиру
  const fiber = fiberOf(day), water = waterOf(day);
  const fiberPct = fiber == null ? 0 : fiber / targets.fiberG * 100, waterPct = water / targets.waterMl * 100;
  const fiberUnit = ' / ' + targets.fiberG + ' г', waterUnit = ' / ' + litres(targets.waterMl) + ' л';
  return {
    addStool: () => app.pickAddSection('stool'),
    addFood: () => app.pickAddSection('food'),
    addWater: () => app.pickAddSection('water'),
    stool, form, formDots, comfort, ring,
    fiber: fiber == null ? empty(fiberUnit) : { text: String(fiber), tileCls: TILE, unit: fiberUnit, bar: bar(fiberPct, toneOf(fiberPct)) },
    water: !water ? empty(waterUnit) : { text: litres(water), tileCls: TILE, unit: waterUnit, bar: bar(waterPct, toneOf(waterPct)) }
  };
}

/** «Что может помочь»: совет ИИ на сегодня (если есть) + правила из domain/suggestions.js; пусто — заготовка по тону */
function tipsOf(s, day, sc, tone, isToday, todayK, opts) {
  const items = [];
  const ai = s.insights;
  if (isToday && sc && ai && ai.date === todayK && ai.tipTitle) items.push({ id: 'ai', icon: 'ai', tone: 'calm', title: ai.tipTitle, text: ai.tipText });
  if (hasData(day)) items.push(...suggestionsFor(day, sc, opts));
  // сегодня записей нет — подсказки по прошлым дням и целям (если и их нет — приглашение)
  else if (isToday) items.push(...suggestionsFromHistory(s.log, todayK, { ...opts, addDays }));
  if (!items.length) {
    const [title, text] = !hasData(day) ? EMPTY_TIPS[isToday ? 'today' : 'past'] : FALLBACK_TIPS[tone] || FALLBACK_TIPS.mild;
    items.push({ id: 'fallback', icon: 'calm', tone: 'mild', title, text: IS_DEMO && tone === 'calm' && sc ? DEMO_TIP_CALM : text });
  }
  return items.slice(0, MAX_TIPS).map((t) => ({
    ...t,
    tileCls: 'tip-icon ' + t.tone,
    // пояснение под заголовком — только когда в нём совет показаться врачу; остальное — по «?» у заголовка блока
    showText: /врач/i.test(t.text || ''),
    isWater: t.icon === 'water', isFiber: t.icon === 'fiber', isWalk: t.icon === 'walk',
    isWarm: t.icon === 'warm' || t.icon === 'slow', isCalm: t.icon === 'calm', isAi: t.icon === 'ai', isPhoto: t.icon === 'photo'
  }));
}

/** Строка о цикле — только в окна месячных/овуляции (беременность и менопауза — без блока) */
function cycleCard(p, day, cd) {
  const hint = p.cycle ? cycleHint(cd, p.len, p.coc, isPeriodDay(p, day, cd)) : null;
  return { showCycle: !!hint, cycle: hint ? { title: hint[0], text: hint[1] } : null };
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
