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
const FALLBACK_MODEL = 'dall-e-3';

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
  const prompt = dish + ' ' + STYLE + '.';
  try {
    return await generate(key, { model: MODEL, prompt, n: 1, size: '1024x1024', quality: QUALITY, output_format: 'jpeg', output_compression: 75 });
  } catch (e) {
    // gpt-image-модели требуют верификации организации в OpenAI; пока её нет — пробуем dall-e-3
    if (MODEL === FALLBACK_MODEL) throw e;
    console.error('[meal-image] ' + MODEL + ' failed, fallback to ' + FALLBACK_MODEL + ':', e.message);
    try {
      return await generate(key, { model: FALLBACK_MODEL, prompt, n: 1, size: '1024x1024', response_format: 'b64_json' });
    } catch (e2) {
      throw bad(MODEL + ': ' + e.message + ' | ' + FALLBACK_MODEL + ': ' + e2.message, 502);
    }
  }
});

async function generate(key, body) {
  const res = await fetch(IMAGES_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw bad((data.error && data.error.message) || 'OpenAI images HTTP ' + res.status, 502);
  const b64 = data.data && data.data[0] && data.data[0].b64_json;
  if (!b64) throw bad('Модель не вернула картинку', 502);
  const type = body.output_format === 'jpeg' ? 'jpeg' : 'png';
  return { image: 'data:image/' + type + ';base64,' + b64 };
}
