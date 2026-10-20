// POST /api/food — разбор блюда: КБЖУ, клетчатка, оценка для кишечника, мягкий совет.
// Тело: { image?: dataURL, note?: string, previous?: прошлый разбор, context?: { profile, today_so_far } }
//   image          — фото блюда (JPEG/PNG/WEBP)
//   note           — комментарий пользователя: что на тарелке, размер порции, или уточнение к разбору
//   previous       — прошлый разбор, если пользователь его уточняет
//   context        — профиль (возраст, пол, рост, вес, цели, ориентиры) и что уже съедено и выпито сегодня (domain/ai-context.js → foodContext)
// Нужно хотя бы фото или текст.
import { chatJSON, handler, SAFETY, VISION_MODEL, ctxText } from './_lib/openai.js';

export const config = { maxDuration: 60 };

const schema = {
  type: 'object',
  additionalProperties: false,
  required: ['is_food', 'name', 'kcal', 'protein', 'fat', 'carbs', 'fiber', 'tone', 'tip'],
  properties: {
    is_food: { type: 'boolean', description: 'true, если на фото или в описании еда или напиток' },
    name: { type: 'string', description: 'Короткое название блюда по-русски, 1–4 слова' },
    kcal: { type: 'number', description: 'Калории всей порции, ккал' },
    protein: { type: 'number', description: 'Белки, г' },
    fat: { type: 'number', description: 'Жиры, г' },
    carbs: { type: 'number', description: 'Углеводы, г' },
    fiber: { type: 'number', description: 'Клетчатка, г' },
    tone: { type: 'string', enum: ['calm', 'mild', 'sens'], description: 'Насколько мягко блюдо для кишечника: calm — мягко, mild — нормально, sens — лучше в меру' },
    tip: { type: 'string', description: 'Один бережный совет до 100 символов, без запретов и оценок' }
  }
};

const bad = (msg, status = 400) => Object.assign(new Error(msg), { status });

export default handler(async (body) => {
  const image = body.image ? String(body.image) : '';
  const note = String(body.note || '').trim().slice(0, 500);
  const context = body.context && typeof body.context === 'object' ? body.context : null;
  // старые клиенты присылали только goals
  const goals = Array.isArray(body.goals) ? body.goals.slice(0, 10).map(String) : [];
  const previous = body.previous && typeof body.previous === 'object' ? body.previous : null;

  if (!image && !note) throw bad('Добавьте фото или опишите блюдо');
  if (image && !/^data:image\/(jpeg|png|webp);base64,/.test(image)) throw bad('Нужно фото в формате JPEG/PNG/WEBP');
  if (image.length > 3_500_000) throw bad('Фото слишком большое', 413);

  const parts = [image ? 'Разбери блюдо на фото.' : 'Разбери блюдо по описанию.'];
  if (previous) {
    parts.push('Прошлый разбор: ' + JSON.stringify({
      name: previous.name, kcal: previous.kcal, protein: previous.protein, fat: previous.fat, carbs: previous.carbs, fiber: previous.fiber
    }) + '. Пользователь уточняет — пересчитай с учётом уточнения.');
  }
  if (note) parts.push((previous ? 'Уточнение пользователя: ' : 'Комментарий пользователя: ') + note);
  if (context) parts.push('О пользователе и его дне (JSON): ' + ctxText(context));
  else if (goals.length) parts.push('Цели пользователя: ' + goals.join(', ') + '.');

  const content = [{ type: 'text', text: parts.join('\n') }];
  if (image) content.push({ type: 'image_url', image_url: { url: image, detail: 'low' } });

  return chatJSON({
    model: VISION_MODEL,
    schemaName: 'food',
    schema,
    system: SAFETY + ' Оцени блюдо: калории, белки, жиры, углеводы и клетчатку для видимой или описанной порции, числа округляй. Комментарий и уточнения пользователя важнее того, что видно на фото. Оценка tone — про комфорт кишечника (клетчатка, жирность, острота, газообразующие продукты), а не про «полезно/вредно». Совет — один, мягкий, без запретов; если есть данные о человеке — свяжи совет с его целями и с тем, сколько клетчатки и воды он уже набрал сегодня относительно своего ориентира. Если это не еда — is_food=false, числа 0, name "Не еда", tone "mild", tip пустой.',
    user: content
  });
});
