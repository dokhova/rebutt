// Общая обвязка для серверных функций: вызов OpenAI, проверка пользователя, лимиты.
// Файлы в папке api/_lib не становятся эндпоинтами на Vercel.

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
export const MODEL = process.env.OPENAI_MODEL || 'gpt-5-mini';
export const VISION_MODEL = process.env.OPENAI_VISION_MODEL || MODEL;

export const SAFETY = [
  'Ты — помощник в приложении-дневнике кишечника. Отвечаешь по-русски, коротко, тепло и по делу, без канцелярита и без эмодзи.',
  'Ты не врач и не ставишь диагнозы, не назначаешь лекарства и дозировки.',
  'Если в данных или вопросе есть тревожные признаки — кровь в стуле, чёрный стул, сильная или нарастающая боль, температура, рвота, резкая потеря веса, ночные поносы, изменения стула дольше 3 недель, — прямо посоветуй обратиться к врачу (гастроэнтерологу), а при острой боли — за неотложной помощью.',
  'Опирайся только на данные пользователя из контекста. Не выдумывай записи, которых нет.'
].join(' ');

export async function chatJSON({ model = MODEL, system, user, schema, schemaName = 'result', maxTokens = 1200 }) {
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
  const msg = data.choices && data.choices[0] && data.choices[0].message;
  if (!msg || msg.refusal) { const e = new Error('Модель отказалась отвечать'); e.status = 502; throw e; }
  try { return JSON.parse(msg.content); }
  catch (_) { const e = new Error('Некорректный ответ модели'); e.status = 502; throw e; }
}

// Проверка, что запрос пришёл от пользователя приложения (JWT Supabase).
// Если Supabase не настроен — пропускаем (локальная разработка).
export async function requireUser(req) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anon) return { id: 'anonymous' };
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) { const e = new Error('Нет авторизации'); e.status = 401; throw e; }
  const r = await fetch(url.replace(/\/$/, '') + '/auth/v1/user', { headers: { apikey: anon, Authorization: auth } });
  if (!r.ok) { const e = new Error('Сессия недействительна'); e.status = 401; throw e; }
  return r.json();
}

// Простейший лимит на инстанс: N запросов в минуту на пользователя
const hits = new Map();
export function rateLimit(id, perMinute = Number(process.env.AI_RATE_LIMIT_PER_MIN || 12)) {
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

export const ctxText = (context) => JSON.stringify(context || {}, null, 0).slice(0, 12000);
