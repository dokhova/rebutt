// «Что может помочь» на главной: 1–3 мягкие подсказки по записям дня.
// Мы не ставим диагнозов и не говорим «надо»: только предлагаем простой шаг и объясняем, почему он может помочь.
// Правила идут по приоритету, повторы по id отбрасываются.

import { FIBER_GOAL_G, WATER_GOAL_ML, SYMPTOM_OK } from './catalog.js';
import { fiberOf, waterOf } from './score.js';

const MAX = 3;
const GLASS_ML = 250;

/**
 * @param day — запись дня (score.js)
 * @param sc  — результат gutScore(day) или null
 * @returns [{ id, icon, tone, title, text }]; icon: water | fiber | walk | slow | warm | calm; tone: calm | mild | sens
 */
export function suggestionsFor(day, sc) {
  if (!day) return [];
  const water = waterOf(day), fiber = fiberOf(day);
  const typed = day.gut.filter((g) => g.type > 0);
  const last = typed.length ? typed[typed.length - 1].type : 0;
  const sym = new Set(day.gut.flatMap((g) => g.sym).filter((s) => s !== SYMPTOM_OK));
  const stress = Math.max(-1, ...day.gut.map((g) => (g.stress == null ? -1 : g.stress)));
  const glassesLeft = Math.min(4, Math.ceil((WATER_GOAL_ML - water) / GLASS_ML));

  const out = [];
  const add = (s) => { if (out.length < MAX && !out.some((x) => x.id === s.id)) out.push(s); };

  const waterTip = (text) => add({ id: 'water', icon: 'water', tone: 'sens', title: 'Попробуй ещё ' + glassesLeft + ' ' + glassesWord(glassesLeft) + ' воды', text });
  const fiberTip = () => add({
    id: 'fiber', icon: 'fiber', tone: 'sens', title: 'Можно добавить овощи к еде',
    text: fiber == null ? 'Еды за сегодня пока нет в записях — овощи или каша подойдут' : 'Клетчатки сегодня пока меньше обычного ориентира'
  });

  // стул твёрже обычного (1–2)
  if (last === 1 || last === 2) {
    if (water < WATER_GOAL_ML * 0.75) waterTip('Жидкость часто делает стул мягче');
    if (fiber == null || fiber < FIBER_GOAL_G * 0.6) fiberTip();
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

  // общее: жидкость и клетчатка
  if (water < WATER_GOAL_ML * 0.5) waterTip('До дневного ориентира ещё ' + litres(WATER_GOAL_ML - water) + ' л');
  if (fiber != null && fiber < FIBER_GOAL_G * 0.6) fiberTip();

  if (!out.length && sc && sc.idx >= 80) {
    add({ id: 'keep', icon: 'calm', tone: 'calm', title: 'День ровный — можно ничего не менять', text: 'Вода и привычная еда помогают держать этот ритм' });
  }
  return out;
}

const glassesWord = (n) => (n === 1 ? 'стакан' : n < 5 ? 'стакана' : 'стаканов');

/** 1200 → '1,2' */
export const litres = (ml) => (Math.round(ml / 100) / 10).toString().replace('.', ',');
