// POST /api/food  { image: dataURL, context?: { goals } } → разбор блюда по фото
import { chatJSON, handler, SAFETY, VISION_MODEL } from './_lib/openai.js';

export const config = { maxDuration: 60 };

const schema = {
  type: 'object',
  additionalProperties: false,
  required: ['is_food', 'name', 'kcal', 'fiber', 'verdict', 'tone', 'tip'],
  properties: {
    is_food: { type: 'boolean', description: 'true, если на фото еда или напиток' },
    name: { type: 'string', description: 'Короткое название блюда по-русски, 1–4 слова' },
    kcal: { type: 'number', description: 'Оценка калорийности порции, ккал' },
    fiber: { type: 'number', description: 'Оценка клетчатки в порции, г' },
    verdict: { type: 'string', enum: ['Хорошо', 'Умеренно', 'Тяжело'] },
    tone: { type: 'string', enum: ['calm', 'mild', 'sens'], description: 'calm = Хорошо, mild = Умеренно, sens = Тяжело' },
    tip: { type: 'string', description: 'Совет для кишечника, одно предложение до 90 символов' }
  }
};

export default handler(async (body) => {
  const image = String(body.image || '');
  if (!/^data:image\/(jpeg|png|webp);base64,/.test(image)) { const e = new Error('Нужно фото в формате JPEG/PNG/WEBP'); e.status = 400; throw e; }
  if (image.length > 3_500_000) { const e = new Error('Фото слишком большое'); e.status = 413; throw e; }
  const goals = (body.context && body.context.goals) || [];
  return chatJSON({
    model: VISION_MODEL,
    schemaName: 'food',
    schema,
    maxTokens: 900,
    system: SAFETY + ' Оцени блюдо на фото с точки зрения комфорта кишечника: клетчатка, жирность, острота, газообразующие продукты. Калории и клетчатку оценивай для видимой порции, округляй. Если на фото не еда — is_food=false, остальные поля заполни нейтрально (name "Не еда", 0, 0, "Умеренно", "mild", пустой совет).',
    user: [
      { type: 'text', text: 'Разбери блюдо.' + (goals.length ? ' Цели пользователя: ' + goals.join(', ') + '.' : '') },
      { type: 'image_url', image_url: { url: image, detail: 'low' } }
    ]
  });
});
