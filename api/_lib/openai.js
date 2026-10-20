// Общая обвязка для серверных функций: вызов OpenAI, проверка пользователя, лимиты.
// Файлы в папке api/_lib не становятся эндпоинтами на Vercel.
import { verifyInitData } from './telegram.js';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = process.env.OPENAI_MODEL || 'gpt-5-mini';
export const VISION_MODEL = process.env.OPENAI_VISION_MODEL || MODEL;

export const SAFETY = [
  'Ты — бережный помощник в приложении-дневнике кишечника. Отвечаешь по-русски, коротко, тепло и по делу, без канцелярита и без эмодзи.',
  'Принцип — не навредить, а помочь. Не пугай: не используй слова «опасно», «срочно», «тревожно», «вредно», «плохо», не стыди за еду и привычки, не ставь оценок человеку. Сначала поддержи, потом дай один-два простых шага.',
  'Ты не врач: не ставишь диагнозы, не называешь болезни, не назначаешь лекарства и дозировки.',
  'Советуй только то, что подтверждено научными данными и есть в официальных рекомендациях: ВОЗ, EFSA, NICE и NHS, клинические рекомендации гастроэнтерологических обществ. Нормы клетчатки и воды — только из daily_targets (ВОЗ: от 25 г клетчатки; EFSA: 2,0 л воды женщинам и 2,5 л мужчинам). Не советуй то, у чего нет доказательной базы: детоксы и «чистки», голодание и монодиеты, клизмы, травы, БАДы и пробиотики (это решает врач), «ощелачивание», исключение продуктов без причины. Не выдавай частные мнения и популярные мифы за факты; если данных мало или наука не даёт однозначного ответа — так и скажи.',
  'Если в данных или вопросе есть признаки, которые стоит показать врачу (кровь или чёрный цвет стула, сильная или нарастающая боль, температура, рвота, заметная потеря веса, изменения стула дольше 3 недель), скажи спокойно: «это стоит показать врачу, чтобы спокойно разобраться». При сильной острой боли мягко, но ясно посоветуй не ждать и обратиться за помощью сразу.',
  'Опирайся только на данные пользователя из контекста. Не выдумывай записи, которых нет.',
  'Если в профиле указана беременность — не предлагай БАДы, травы, слабительные и диеты, изменения советуй согласовать с врачом, который ведёт беременность.',
  'Если указан приём КОК — учитывай, что фазы цикла сглажены, а кровотечение в перерыве — это кровотечение отмены.',
  'Учитывай всё, что человек о себе отметил: возраст, пол, рост и вес, цели и то, что его волнует (goals, own_goal), беременность, цикл, личные дневные ориентиры воды и клетчатки (daily_targets), общую сводку (summary) и записи по дням. Связывай совет с целью человека, но не повторяй его данные списком.',
  'Рост и вес нужны только для ориентиров. Не оценивай вес и фигуру, не называй ИМТ, не предлагай похудеть, если человек сам об этом не спросил. Если среди целей «Похудеть» — поддерживай через бережные привычки (вода, клетчатка, овощи, регулярная еда, движение), без жёстких диет, подсчёта калорий, запретов и голодания.'
].join(' ');

// У моделей gpt-5 часть лимита уходит на рассуждения, поэтому запас токенов большой
export async function chatJSON({ model, system, user, schema, schemaName = 'result', maxTokens = 4000 }) {
  model = model || MODEL;
  const key = process.env.OPENAI_API_KEY;
  if (!key) { const e = new Error('OPENAI_API_KEY не задан'); e.status = 500; throw e; }
  const body = {
    model,
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    response_format: { type: 'json_schema', json_schema: { name: schemaName, strict: true, schema } },
    max_completion_tokens: maxTokens
  };
  if (/^(gpt-5|o\d)/.test(model)) body.reasoning_effort = process.env.OPENAI_REASONING_EFFORT || 'low';
  else body.temperature = 0.4;

  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error((data.error && data.error.message) || ('OpenAI HTTP ' + res.status));
    e.status = 502; throw e;
  }
  const choice = data.choices && data.choices[0], msg = choice && choice.message;
  if (choice && choice.finish_reason === 'length' && !(msg && msg.content)) { const e = new Error('Модель не уложилась в лимит токенов'); e.status = 502; throw e; }
  if (!msg || msg.refusal) { const e = new Error('Модель отказалась отвечать'); e.status = 502; throw e; }
  try { return JSON.parse(msg.content); }
  catch (_) { const e = new Error('Некорректный ответ модели'); e.status = 502; throw e; }
}

// Проверка, что запрос пришёл от пользователя приложения. Подходит любое из:
//   1) подпись Telegram Mini App в заголовке X-Telegram-Init-Data (нужен TELEGRAM_BOT_TOKEN);
//   2) JWT сессии Supabase в заголовке Authorization.
// Если не настроено ни то ни другое — пропускаем (локальная разработка).
async function requireUser(req) {
  const tg = verifyInitData(req.headers['x-telegram-init-data'] || '', process.env.TELEGRAM_BOT_TOKEN);
  if (tg) return { id: 'tg:' + tg.id };

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anon) return { id: 'anonymous' };
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) { const e = new Error('Нет авторизации: откройте приложение через Telegram-бота'); e.status = 401; throw e; }
  const r = await fetch(url.replace(/\/$/, '') + '/auth/v1/user', { headers: { apikey: anon, Authorization: auth } });
  if (!r.ok) { const e = new Error('Сессия недействительна, перезапустите приложение'); e.status = 401; throw e; }
  return r.json();
}

// Простейший лимит на инстанс: N запросов в минуту на пользователя
const hits = new Map();
function rateLimit(id, perMinute = Number(process.env.AI_RATE_LIMIT_PER_MIN || 12)) {
  const now = Date.now(), win = 60000;
  const arr = (hits.get(id) || []).filter((t) => now - t < win);
  if (arr.length >= perMinute) { const e = new Error('Слишком много запросов, попробуйте через минуту'); e.status = 429; throw e; }
  arr.push(now); hits.set(id, arr);
}

export function handler(fn) {
  return async (req, res) => {
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    try {
      const user = await requireUser(req);
      rateLimit(user.id || 'anonymous');
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const out = await fn(body, user);
      res.status(200).json(out);
    } catch (e) {
      console.error('[api]', e.message);
      res.status(e.status || 500).json({ error: e.message || 'Ошибка сервера' });
    }
  };
}

// Контекст: профиль, сводка за всё время и до 30 дней записей. Клиент сам держит размер разумным; обрезка — страховка.
export const ctxText = (context) => JSON.stringify(context || {}, null, 0).slice(0, 30000);
