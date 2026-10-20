// «Что может помочь» на главной: 1–3 мягкие подсказки по записям дня, личным ориентирам и целям пользователя.
// Мы не ставим диагнозов и не говорим «надо»: только предлагаем простой шаг и объясняем, почему он может помочь.
// Правила идут по приоритету, повторы по id отбрасываются.
//
// Порядок: что видно в записях сегодня (форма стула, симптомы, стресс) → цели из онбординга → вода и клетчатка к ориентиру.
// Цель «Похудеть» намеренно не даёт подсказок про еду и калории — только общие (вода, клетчатка, движение).

import { FIBER_GOAL_G, WATER_GOAL_ML, SYMPTOM_OK } from './catalog.js';
import { fiberOf, waterOf } from './score.js';

const MAX = 3;
const GLASS_ML = 250;

/**
 * @param day  — запись дня (score.js)
 * @param sc   — результат gutScore(day) или null
 * @param opts — { targets: { waterMl, fiberG } из domain/targets.js, goals: id целей из профиля }
 * @returns [{ id, icon, tone, title, text }]; icon: water | fiber | walk | slow | warm | calm | photo; tone: calm | mild | sens
 */
export function suggestionsFor(day, sc, opts = {}) {
  if (!day) return [];
  const waterGoal = (opts.targets && opts.targets.waterMl) || WATER_GOAL_ML;
  const fiberGoal = (opts.targets && opts.targets.fiberG) || FIBER_GOAL_G;
  const goals = new Set(opts.goals || []);

  const water = waterOf(day), fiber = fiberOf(day);
  const typed = day.gut.filter((g) => g.type > 0);
  const last = typed.length ? typed[typed.length - 1].type : 0;
  const noStool = day.gut.some((g) => g.type === 0) && !typed.length;
  const sym = new Set(day.gut.flatMap((g) => g.sym).filter((s) => s !== SYMPTOM_OK));
  const stress = Math.max(-1, ...day.gut.map((g) => (g.stress == null ? -1 : g.stress)));
  const glassesLeft = Math.max(1, Math.min(4, Math.ceil((waterGoal - water) / GLASS_ML)));

  const out = [];
  const add = (s) => { if (out.length < MAX && !out.some((x) => x.id === s.id)) out.push(s); };

  const waterTip = (text) => add({ id: 'water', icon: 'water', tone: 'sens', title: 'Попробуй ещё ' + glassesLeft + ' ' + glassesWord(glassesLeft) + ' воды', text });
  const fiberTip = () => add({
    id: 'fiber', icon: 'fiber', tone: 'sens', title: 'Можно добавить овощи к еде',
    text: goals.has('bloat')
      ? 'Добавляй клетчатку понемногу — так обычно меньше вздутия'
      : fiber == null ? 'Еды за сегодня пока нет в записях — овощи или каша подойдут' : 'Клетчатки сегодня пока меньше твоего ориентира'
  });
  const waterLow = (share) => water < waterGoal * share;
  const fiberLow = (share) => fiber == null || fiber < fiberGoal * share;

  // ---------- что видно в записях ----------

  // стул твёрже обычного (1–2) или его не было
  if (last === 1 || last === 2 || noStool) {
    if (waterLow(0.75)) waterTip('Жидкость часто делает стул мягче');
    if (fiberLow(0.6)) fiberTip();
    if (noStool && goals.has('stool')) add({ id: 'morning', icon: 'warm', tone: 'mild', title: 'Тёплый напиток утром', text: 'Многим он помогает кишечнику проснуться' });
    add({ id: 'walk', icon: 'walk', tone: 'mild', title: 'Если есть силы — прогулка', text: 'Лёгкое движение многим помогает кишечнику' });
  }

  // стул жидкий (6–7)
  if (last === 6 || last === 7) {
    add({ id: 'sip', icon: 'water', tone: 'sens', title: 'Пей понемногу в течение дня', text: 'Так проще восполнить жидкость' });
    add({ id: 'warm', icon: 'warm', tone: 'mild', title: 'Подойдёт простая тёплая еда', text: 'Рис, бананы, суп — многим так спокойнее' });
  }

  if (sym.has('Вздутие') || sym.has('Газы')) {
    add({ id: 'slow', icon: 'slow', tone: 'mild', title: 'Можно есть чуть медленнее', text: 'Спокойный темп иногда уменьшает вздутие' });
  }
  if (sym.has('Боль') || sym.has('Тяжесть')) {
    add({ id: 'rest', icon: 'warm', tone: 'mild', title: 'Тёплое питьё и отдых', text: 'Если боль сильная или повторяется — лучше обсудить с врачом' });
  }
  if (stress >= 6) {
    add({ id: 'calm', icon: 'calm', tone: 'mild', title: 'Пара минут спокойного дыхания', text: 'Стресс часто отражается на кишечнике' });
  }

  // ---------- цели из онбординга ----------

  if (goals.has('food') && !day.meals.length) {
    add({ id: 'photo', icon: 'photo', tone: 'mild', title: 'Сфотографируй, что ешь', text: 'Так проще увидеть, как еда влияет на самочувствие' });
  }
  if (goals.has('bloat') && !sym.has('Вздутие') && day.meals.length) {
    add({ id: 'slow', icon: 'slow', tone: 'mild', title: 'Можно есть чуть медленнее', text: 'Спокойный темп часто помогает обойтись без вздутия' });
  }

  // ---------- вода и клетчатка к личному ориентиру ----------

  if (waterLow(goals.has('stool') ? 0.75 : 0.5)) waterTip('До твоего ориентира ещё ' + litres(waterGoal - water) + ' л');
  if (fiber != null && fiberLow(0.6)) fiberTip();

  if (!out.length && sc && sc.idx >= 80) {
    add({ id: 'keep', icon: 'calm', tone: 'calm', title: 'День ровный — можно ничего не менять', text: 'Вода и привычная еда помогают держать этот ритм' });
  }
  return out;
}

const glassesWord = (n) => (n === 1 ? 'стакан' : n < 5 ? 'стакана' : 'стаканов');

/** 1200 → '1,2' */
export const litres = (ml) => (Math.round(ml / 100) / 10).toString().replace('.', ',');
