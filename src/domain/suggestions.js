// «Что может помочь» на главной: 1–3 мягкие подсказки по записям дня, ориентирам и целям пользователя.
// Мы не ставим диагнозов и не говорим «надо»: только предлагаем простой шаг и объясняем, почему он может помочь.
// Правила идут по приоритету, повторы по id отбрасываются.
//
// Каждая подсказка — только из официальных рекомендаций (domain/sources.js, их видно по «?» у заголовка):
//   клетчатка (ВОЗ), жидкость (EFSA; при жидком стуле — восполнять потери),
//   движение, регулярная еда без спешки, время на отдых (NICE), поводы показаться врачу (NHS).
// Порядок: что видно в записях сегодня (форма стула, симптомы, стресс) → цели из онбординга → вода и клетчатка к ориентиру.
// Цель «Похудеть» намеренно не даёт подсказок про еду и калории.

import { SYMPTOM_OK } from './catalog.js';
import { dailyTargets } from './targets.js';
import { fiberOf, waterOf } from './score.js';

const MAX = 3;
/** Сколько прошлых дней смотрим для подсказок на пустой день */
const HISTORY_DAYS = 7;
const GLASS_ML = 250;

/**
 * @param day  — запись дня (score.js)
 * @param sc   — результат gutScore(day) или null
 * @param opts — { targets: dailyTargets(profile) из domain/targets.js, goals: id целей из профиля }
 * @returns [{ id, icon, tone, title, text }]; icon: water | fiber | walk | slow | warm | calm | photo; tone: calm | mild | sens
 */
export function suggestionsFor(day, sc, opts = {}) {
  if (!day) return [];
  const targets = opts.targets || dailyTargets(null);
  const waterGoal = targets.waterMl, fiberGoal = targets.fiberG;
  const goals = new Set(opts.goals || []);

  const water = waterOf(day), fiber = fiberOf(day);
  const typed = day.gut.filter((g) => g.type > 0);
  const last = typed.length ? typed[typed.length - 1].type : 0;
  const noStool = day.gut.some((g) => g.type === 0) && !typed.length;
  const sym = new Set(day.gut.flatMap((g) => g.sym).filter((s) => s !== SYMPTOM_OK));
  const stress = Math.max(-1, ...day.gut.map((g) => (g.stress == null ? -1 : g.stress)));
  const glassesLeft = Math.max(1, Math.min(4, Math.round((waterGoal - water) / GLASS_ML)));

  const out = [];
  const add = (s) => { if (out.length < MAX && !out.some((x) => x.id === s.id)) out.push(s); };

  const waterTip = (text) => add({ id: 'water', icon: 'water', tone: 'sens', title: 'Попробуй ещё ' + glassesLeft + ' ' + glassesWord(glassesLeft) + ' воды', text });
  const fiberTip = () => add({
    id: 'fiber', icon: 'fiber', tone: 'sens', title: 'Можно добавить овощи к еде',
    text: goals.has('bloat')
      ? 'Добавляй клетчатку понемногу — так обычно меньше вздутия'
      : fiber == null ? 'Еды за сегодня пока нет в записях — овощи, цельные злаки, бобовые' : 'Клетчатки сегодня пока меньше ориентира ВОЗ'
  });
  const waterLow = (share) => water < waterGoal * share;
  const fiberLow = (share) => fiber == null || fiber < fiberGoal * share;

  // ---------- что видно в записях ----------

  // стул твёрже обычного (1–2) или его не было
  if (last === 1 || last === 2 || noStool) {
    if (waterLow(0.75)) waterTip('С клетчаткой и водой стул обычно мягче');
    if (fiberLow(0.6)) fiberTip();
    add({ id: 'walk', icon: 'walk', tone: 'mild', title: 'Если есть силы — прогулка', text: 'Движение помогает кишечнику работать ровнее' });
  }

  // стул жидкий (6–7)
  if (last === 6 || last === 7) {
    add({ id: 'sip', icon: 'water', tone: 'sens', title: 'Пей понемногу в течение дня', text: 'При жидком стуле важно восполнять жидкость' });
    add({ id: 'eat', icon: 'warm', tone: 'mild', title: 'Можно есть как обычно', text: 'Если это держится несколько дней или есть кровь — лучше показаться врачу' });
  }

  if (sym.has('Вздутие') || sym.has('Газы')) {
    add({ id: 'slow', icon: 'slow', tone: 'mild', title: 'Можно есть чуть медленнее', text: 'Регулярная еда без спешки помогает при вздутии' });
  }
  if (sym.has('Боль') || sym.has('Тяжесть')) {
    add({ id: 'pain', icon: 'calm', tone: 'mild', title: 'Прислушайся к боли', text: 'Если она сильная или повторяется — лучше показаться врачу' });
  }
  if (stress >= 6) {
    add({ id: 'calm', icon: 'calm', tone: 'mild', title: 'Найди время на отдых', text: 'Стресс часто отражается на кишечнике' });
  }

  // ---------- цели из онбординга ----------

  if (goals.has('food') && !day.meals.length) {
    add({ id: 'photo', icon: 'photo', tone: 'mild', title: 'Сфотографируй, что ешь', text: 'Так проще увидеть, как еда влияет на самочувствие' });
  }
  if (goals.has('bloat') && !sym.has('Вздутие') && day.meals.length) {
    add({ id: 'slow', icon: 'slow', tone: 'mild', title: 'Можно есть чуть медленнее', text: 'Регулярная еда без спешки помогает обойтись без вздутия' });
  }

  // ---------- вода и клетчатка к личному ориентиру ----------

  if (waterLow(goals.has('stool') ? 0.75 : 0.5)) waterTip('До ориентира на день ещё ' + litres(waterGoal - water) + ' л');
  if (fiber != null && fiberLow(0.6)) fiberTip();

  if (!out.length && sc && sc.idx >= 80) {
    add({ id: 'keep', icon: 'calm', tone: 'calm', title: 'День ровный — можно ничего не менять', text: 'Вода и привычная еда помогают держать этот ритм' });
  }
  return out;
}

/**
 * Подсказки на день, в котором ещё нет записей: по прошлым дням (до HISTORY_DAYS назад) и целям.
 * Тексты — те же правила и источники, что у suggestionsFor, но с оговоркой «в последние дни»: это наблюдение, а не вывод.
 * @param log  — все записи { 'YYYY-MM-DD': day }
 * @param k    — день, для которого подсказки (его записи не учитываются)
 * @param opts — { targets, goals, addDays } — addDays из domain/dates.js (передаётся, чтобы не тянуть даты сюда)
 */
export function suggestionsFromHistory(log, k, opts = {}) {
  const targets = opts.targets || dailyTargets(null);
  const goals = new Set(opts.goals || []);
  const days = [];
  for (let i = 1; i <= HISTORY_DAYS; i++) {
    const d = log[opts.addDays(k, -i)];
    if (d && ((d.gut && d.gut.length) || (d.meals && d.meals.length) || d.water)) days.push({ gut: [], meals: [], water: 0, ...d });
  }

  const out = [];
  const add = (s) => { if (out.length < MAX && !out.some((x) => x.id === s.id)) out.push(s); };
  const often = (pred) => days.filter(pred).length >= Math.max(2, Math.ceil(days.length / 3));

  if (days.length) {
    const typesOf = (d) => d.gut.filter((g) => g.type > 0).map((g) => g.type);
    const symsOf = (d) => new Set(d.gut.flatMap((g) => g.sym || []));
    const hard = often((d) => typesOf(d).some((t) => t <= 2) || (d.gut.some((g) => g.type === 0) && !typesOf(d).length));
    const loose = often((d) => typesOf(d).some((t) => t >= 6));
    const withWater = days.filter((d) => d.water > 0);
    const avgWater = withWater.length ? withWater.reduce((a, d) => a + d.water, 0) / withWater.length : 0;
    const withFood = days.map(fiberOf).filter((f) => f != null);
    const avgFiber = withFood.length ? withFood.reduce((a, f) => a + f, 0) / withFood.length : null;

    if (hard) {
      add({ id: 'water', icon: 'water', tone: 'sens', title: 'Начни день со стакана воды', text: 'В последние дни стул был твёрже обычного — вода и клетчатка обычно делают его мягче' });
      add({ id: 'walk', icon: 'walk', tone: 'mild', title: 'Если есть силы — прогулка', text: 'Движение помогает кишечнику работать ровнее' });
    }
    if (loose) {
      add({ id: 'sip', icon: 'water', tone: 'sens', title: 'Пей понемногу в течение дня', text: 'В последние дни стул бывал жидким — важно восполнять жидкость. Если это держится — лучше показаться врачу' });
    }
    if (often((d) => symsOf(d).has('Вздутие') || symsOf(d).has('Газы'))) {
      add({ id: 'slow', icon: 'slow', tone: 'mild', title: 'Можно есть чуть медленнее', text: 'В последние дни отмечалось вздутие — регулярная еда без спешки обычно помогает' });
    }
    if (often((d) => d.gut.some((g) => g.stress != null && g.stress >= 6))) {
      add({ id: 'calm', icon: 'calm', tone: 'mild', title: 'Найди время на отдых', text: 'В последние дни стресс был высоким — он часто отражается на кишечнике' });
    }
    if (withWater.length && avgWater < targets.waterMl * 0.75) {
      add({ id: 'water', icon: 'water', tone: 'sens', title: 'Держи воду под рукой', text: 'В последние дни выходило около ' + litres(avgWater) + ' л из ' + litres(targets.waterMl) + ' — можно начать со стакана утром' });
    }
    if (avgFiber != null && avgFiber < targets.fiberG * 0.6) {
      add({ id: 'fiber', icon: 'fiber', tone: 'sens', title: 'Можно добавить овощи к еде', text: 'В последние дни клетчатки было меньше ориентира ВОЗ — овощи, цельные злаки, бобовые' });
    }
  }

  // цели из онбординга — и когда прошлых записей нет
  if (goals.has('food')) add({ id: 'photo', icon: 'photo', tone: 'mild', title: 'Сфотографируй, что ешь', text: 'Так проще увидеть, как еда влияет на самочувствие' });
  if (goals.has('stool')) add({ id: 'water', icon: 'water', tone: 'sens', title: 'Начни день со стакана воды', text: 'Вода и клетчатка помогают стулу быть мягче и регулярнее' });
  if (goals.has('bloat')) add({ id: 'slow', icon: 'slow', tone: 'mild', title: 'Можно есть чуть медленнее', text: 'Регулярная еда без спешки помогает обойтись без вздутия' });
  return out;
}

const glassesWord = (n) => (n === 1 ? 'стакан' : n < 5 ? 'стакана' : 'стаканов');

/** 1200 → '1,2' */
export const litres = (ml) => (Math.round(ml / 100) / 10).toString().replace('.', ',');
