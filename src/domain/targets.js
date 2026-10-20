// Дневные ориентиры воды и клетчатки — для плиток на главной, «+» → «Жидкости», подсказок и ИИ.
// Только по официальным рекомендациям (источники и ссылки — domain/sources.js, их же видит пользователь по «?»):
//
// Клетчатка: ВОЗ, 2023 — взрослым не меньше 25 г в день. Отдельных значений по полу, возрасту и весу ВОЗ не даёт.
// Вода:      EFSA, 2010 — достаточное потребление всей воды за день (напитки + вода из еды):
//            женщины 2,0 л, мужчины 2,5 л, при беременности +0,3 л. Пол не указан — 2,0 л.
//
// Рост и вес в формулах не участвуют: у ВОЗ и EFSA нет норм по весу. Они уходят в контекст ИИ.

export const FIBER_WHO_G = 25;
export const WATER_EFSA_ML = { f: 2000, m: 2500, unknown: 2000, pregnancy: 300 };

/** → { waterMl, fiberG } */
export function dailyTargets(profile) {
  const p = profile || {};
  let waterMl = p.sex === 'm' ? WATER_EFSA_ML.m : p.sex === 'f' ? WATER_EFSA_ML.f : WATER_EFSA_ML.unknown;
  if (p.sex === 'f' && p.pregnant) waterMl += WATER_EFSA_ML.pregnancy;
  return { waterMl, fiberG: FIBER_WHO_G };
}
