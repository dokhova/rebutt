// POST /api/ask  { question, image?, history?, context } → { answer }
// image — фото (data URL), например блюда, упаковки или анализа; помощник учтёт его в ответе.
// history — последние сообщения диалога [{ role: 'user' | 'ai', text }], чтобы помощник помнил контекст разговора.
import { chatJSON, handler, SAFETY, ctxText, VISION_MODEL } from './_lib/openai.js';

export const config = { maxDuration: 60 };

const schema = {
  type: 'object',
  additionalProperties: false,
  required: ['answer'],
  properties: { answer: { type: 'string', description: 'Ответ, 2–5 коротких предложений' } }
};

export default handler(async (body) => {
  const image = body.image ? String(body.image) : '';
  if (image && !/^data:image\/(jpeg|png|webp);base64,/.test(image)) throw Object.assign(new Error('Нужно фото в формате JPEG/PNG/WEBP'), { status: 400 });
  if (image.length > 3_500_000) throw Object.assign(new Error('Фото слишком большое'), { status: 413 });
  const q = String(body.question || '').trim().slice(0, 500) || (image ? 'Что скажешь по этому фото?' : '');
  if (!q) throw Object.assign(new Error('Пустой вопрос'), { status: 400 });
  const history = (Array.isArray(body.history) ? body.history : [])
    .slice(-6)
    .map((m) => (m.role === 'user' ? 'Пользователь: ' : 'Ты: ') + String(m.text || '').slice(0, 600))
    .join('\n');

  const text = 'Данные пользователя (JSON): ' + ctxText(body.context) + (history ? '\n\nНачало разговора:\n' + history : '') + '\n\nВопрос: ' + q;
  return chatJSON({
    model: image ? VISION_MODEL : undefined,
    schemaName: 'answer',
    schema,
    system: SAFETY + ' Отвечай на вопрос с опорой на профиль и записи пользователя: стул по Бристольской шкале (3–4 — норма), цвет стула, стресс, симптомы, еда с КБЖУ, жидкость, фаза цикла — за последние 30 дней (days) и за всё время (summary). Если вопрос про воду или клетчатку — опирайся на личные ориентиры daily_targets. Если приложено фото — опиши, что видишь, и свяжи с вопросом. Если данных мало — так и скажи и дай общий практичный совет. 2–5 коротких законченных предложений, обычным текстом, без списков и заголовков.',
    user: image ? [{ type: 'text', text }, { type: 'image_url', image_url: { url: image, detail: 'low' } }] : text
  });
});
