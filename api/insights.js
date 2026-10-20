// POST /api/insights  { context } → { tip_title, tip_text, noticed }
// «Совет на сегодня» на главной и блок «ИИ заметил» в инсайтах. Клиент кэширует ответ на день.
import { chatJSON, handler, SAFETY, ctxText } from './_lib/openai.js';

export const config = { maxDuration: 60 };

const schema = {
  type: 'object',
  additionalProperties: false,
  required: ['tip_title', 'tip_text', 'noticed'],
  properties: {
    tip_title: { type: 'string', description: 'Заголовок совета на сегодня, до 40 символов' },
    tip_text: { type: 'string', description: 'Конкретный совет на сегодня, 1–2 предложения, до 160 символов' },
    noticed: { type: 'string', description: 'Одна закономерность из данных (еда ↔ стул/симптомы, регулярность, цикл), 1–2 предложения, до 180 символов. Если данных мало — что стоит записывать, чтобы найти закономерности' }
  }
};

export default handler(async (body) => {
  return chatJSON({
    schemaName: 'insights',
    schema,
    system: SAFETY + ' По профилю и записям пользователя дай один практичный совет на сегодня и одно наблюдение-закономерность. Конкретика из данных (названия блюд, типы стула, дни, сколько воды и клетчатки относительно личного ориентира daily_targets) лучше общих слов. Совет должен работать на цели пользователя (goals, own_goal) и учитывать фазу цикла, если она есть. Для наблюдения используй и сводку за всё время (summary), а не только последние дни. Заголовок совета — тёплый и спокойный, без тревоги.',
    user: 'Данные пользователя (JSON): ' + ctxText(body.context)
  });
});
