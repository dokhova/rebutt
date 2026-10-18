// POST /api/ask  { question, history?, context } → { answer }
// history — последние сообщения диалога [{ role: 'user' | 'ai', text }], чтобы помощник помнил контекст разговора.
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
  if (!q) throw Object.assign(new Error('Пустой вопрос'), { status: 400 });
  const history = (Array.isArray(body.history) ? body.history : [])
    .slice(-6)
    .map((m) => (m.role === 'user' ? 'Пользователь: ' : 'Ты: ') + String(m.text || '').slice(0, 600))
    .join('\n');

  return chatJSON({
    schemaName: 'answer',
    schema,
    system: SAFETY + ' Отвечай на вопрос с опорой на записи пользователя за последние 2 недели: стул по Бристольской шкале (3–4 — норма), симптомы, еда с КБЖУ, фаза цикла. Если данных мало — так и скажи и дай общий практичный совет. Не больше 5 предложений, обычным текстом, без списков и заголовков.',
    user: 'Данные пользователя (JSON): ' + ctxText(body.context) + (history ? '\n\nНачало разговора:\n' + history : '') + '\n\nВопрос: ' + q
  });
});
