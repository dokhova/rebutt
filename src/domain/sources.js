// Откуда наши нормы и советы. Это показывается по «?» рядом с каждой нормой (partials/info-card.html).
// Правило: в приложении нет чисел и советов без источника из этого файла. Добавляешь норму — добавь сюда источник.

import { FIBER_WHO_G, WATER_EFSA_ML } from './targets.js';

const L = (ml) => (Math.round(ml / 100) / 10).toString().replace('.', ',') + ' л';

export const SOURCES = {
  who_fiber: { label: 'ВОЗ. Carbohydrate intake for adults and children, 2023', url: 'https://www.who.int/publications/i/item/9789240073593' },
  efsa_water: { label: 'EFSA. Dietary reference values for water, 2010', url: 'https://doi.org/10.2903/j.efsa.2010.1459' },
  heaton: { label: 'Heaton K. W. и др. Defecation frequency and timing, and stool form in the general population. Gut, 1992', url: 'https://gut.bmj.com/content/33/6/818' },
  nice_ibs: { label: 'NICE. Irritable bowel syndrome in adults, QS114: питание и образ жизни', url: 'https://www.nice.org.uk/guidance/qs114/chapter/Quality-statement-3-Dietary-management' },
  nhs_bowel: { label: 'NHS. Когда показаться врачу: изменения стула, кровь, похудание', url: 'https://www.nhs.uk/conditions/bowel-cancer/symptoms/' }
};

/**
 * Карточки «?»: { title, text, sources: id[] }. title и text могут зависеть от ориентиров пользователя.
 * @param {{ waterMl: number, fiberG: number }} t — dailyTargets(profile)
 */
export function infoCards(t) {
  const fiber = {
    title: 'Клетчатка — ' + t.fiberG + ' г в день',
    text: 'ВОЗ советует взрослым не меньше ' + FIBER_WHO_G + ' г клетчатки в день: цельные злаки, овощи, фрукты, бобовые. Добавлять лучше постепенно — так меньше вздутия.',
    sources: ['who_fiber']
  };
  const water = {
    title: 'Вода — ' + L(t.waterMl) + ' в день',
    text: 'EFSA считает достаточным ' + L(WATER_EFSA_ML.f) + ' воды в день для женщин и ' + L(WATER_EFSA_ML.m) + ' для мужчин, при беременности — на ' + (WATER_EFSA_ML.pregnancy / 1000).toString().replace('.', ',') + ' л больше. Это вся вода за день: примерно пятая часть приходит с едой. В жару и при нагрузке нужно больше.',
    sources: ['efsa_water']
  };
  return {
    fiber: [fiber],
    water: [water],
    targets: [water, fiber],
    bristol: [{
      title: 'Форма стула: типы 3–4',
      text: 'Бристольская шкала делит стул на 7 типов. Типы 3–4 — самые обычные: мягкий, оформленный. 1–2 — твёрже и реже, 6–7 — жидкий. В исследовании в Бристоле «типичной» была форма лишь около 60% стулов, так что разовое отклонение — нормально.',
      sources: ['heaton']
    }],
    tips: [{
      title: 'Откуда подсказки',
      text: 'Подсказки строятся по твоим записям и опираются на рекомендации ВОЗ, EFSA и NICE: клетчатка, жидкость, движение, регулярная еда без спешки, время на отдых. Это не диагноз. Кровь или чёрный цвет стула, сильная боль, похудание без причины, изменения стула, которые не проходят, — повод показаться врачу.',
      sources: ['nice_ibs', 'nhs_bowel']
    }]
  };
}
