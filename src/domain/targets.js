// Личные дневные ориентиры воды и клетчатки — для плиток на главной, «+» → «Жидкости», подсказок и ИИ.
// Это ориентиры, а не медицинские нормы: показываем их как «из N», без оценок.
//
// Вода:      30 мл на кг веса, округление до 100 мл, в пределах 1,5–3,5 л. Без веса — 2 л.
//            Беременность +300 мл. Цель «Наладить стул» +250 мл: жидкость помогает стулу быть мягче.
// Клетчатка: по полу и возрасту (как в рекомендациях DRI, слегка округлено):
//            женщины 25 г (старше 50 — 21 г), мужчины 30 г (старше 50 — 28 г), пол не указан — 25 г.
//            Беременность — 28 г.
// Рост в формулах не участвует — он уходит в контекст ИИ.

import { FIBER_GOAL_G, WATER_GOAL_ML } from './catalog.js';
import { validWeight } from './profile.js';

const WATER_ML_PER_KG = 30;
const WATER_MIN = 1500;
const WATER_MAX = 3500;
const WATER_PREGNANT = 300;
const WATER_STOOL_GOAL = 250;

/** → { waterMl, fiberG, personal } ; personal — ориентир посчитан по данным профиля, а не по умолчанию */
export function dailyTargets(profile) {
  const p = profile || {};
  const weight = validWeight(p.weight);
  const pregnant = p.sex === 'f' && !!p.pregnant;
  const goals = Array.isArray(p.goals) ? p.goals : [];

  let waterMl = weight ? Math.round(weight * WATER_ML_PER_KG / 100) * 100 : WATER_GOAL_ML;
  if (pregnant) waterMl += WATER_PREGNANT;
  if (goals.includes('stool')) waterMl += WATER_STOOL_GOAL;
  waterMl = Math.min(WATER_MAX, Math.max(WATER_MIN, waterMl));

  let fiberG = FIBER_GOAL_G;
  if (p.sex === 'f') fiberG = p.age > 50 ? 21 : 25;
  if (p.sex === 'm') fiberG = p.age > 50 ? 28 : 30;
  if (pregnant) fiberG = 28;

  return { waterMl, fiberG, personal: !!(weight || p.sex) };
}
