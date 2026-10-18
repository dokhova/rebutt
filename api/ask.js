// POST /api/ask  { question, context } → { answer }
import { chatJSON, handler, SAFETY, ctxText } from './_lib/openai.js';

export const config = { maxDuration: 60 };

const schema = {
  type: 'object',
  additionalProperties: false,
  required: ['answer'],
  properties: { answer: { type: 'string', description: 'Ответ, 2–5 коротких предложений' } }
};

export default handler(async (body) => {
  const q = String(body.question || '').trim().slice(0, 500);
  if (!q) { const e = new Error('Пустой вопрос'); e.status = 400; throw e; }
  return chatJSON({
    schemaName: 'answer',
    schema,
    maxTokens: 1200,
    system: SAFETY + ' Отвечай на вопрос пользователя с опорой на его записи за последние 2 недели: стул по Бристольской шкале (3–4 — норма), симптомы, еда, фаза цикла. Если данных мало — так и скажи и дай общий практичный совет. Не больше 5 предложений, без списков и заголовков.',
    user: 'Данные пользователя (JSON): ' + ctxText(body.context) + '\n\nВопрос: ' + q
  });
});
