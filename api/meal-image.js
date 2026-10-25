// POST /api/meal-image — картинка блюда, когда пользователь описал его словами без фото.
// Тело: { name: string, note?: string }  →  { image: 'data:image/jpeg;base64,…' }
//   name — название блюда из разбора ИИ (api/food.js), note — описание пользователя.
// Модель — OPENAI_IMAGE_MODEL (по умолчанию gpt-image-1-mini, качество low — дёшево и быстро).
// Картинка — иллюстрация для дневника, на разбор КБЖУ она не влияет и в ИИ повторно не отправляется.
import { handler } from './_lib/openai.js';

export const config = { maxDuration: 60 };

const IMAGES_URL = 'https://api.openai.com/v1/images/generations';
const MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1-mini';
const QUALITY = process.env.OPENAI_IMAGE_QUALITY || 'low';

// Один стиль для всех картинок: тёмный фон приложения, спокойный свет, без текста и людей
const STYLE = [
  'Editorial food photograph, 45-degree angle, a single serving on a simple matte ceramic plate or bowl',
  'on a dark charcoal-violet stone surface, soft diffused window light from the side, gentle shadows',
  'shallow depth of field, natural appetizing colors, minimal styling, calm premium wellness aesthetic',
  'no text, no letters, no logos, no hands, no people, no cutlery clutter'
].join(', ');

const bad = (msg, status = 400) => Object.assign(new Error(msg), { status });
const clean = (v, max) => String(v || '').replace(/\s+/g, ' ').trim().slice(0, max);

export default handler(async (body) => {
  const name = clean(body.name, 80), note = clean(body.note, 300);
  if (!name && !note) throw bad('Нет описания блюда');
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw bad('OPENAI_API_KEY не задан', 500);

  const dish = [name && 'Dish: ' + name + '.', note && 'Description from the user (may be in Russian): ' + note + '.'].filter(Boolean).join(' ');
  const res = await fetch(IMAGES_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
    body: JSON.stringify({
      model: MODEL,
      prompt: dish + ' ' + STYLE + '.',
      n: 1,
      size: '1024x1024',
      quality: QUALITY,
      output_format: 'jpeg',
      output_compression: 75
    })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw bad((data.error && data.error.message) || 'OpenAI images HTTP ' + res.status, 502);
  const b64 = data.data && data.data[0] && data.data[0].b64_json;
  if (!b64) throw bad('Модель не вернула картинку', 502);
  return { image: 'data:image/jpeg;base64,' + b64 };
});
