// Бот Telegram: вебхук. На /start присылает приветствие — картинку public/bot/welcome-2.jpg с текстом (дальше — по file_id из bot_settings, без повторной загрузки)
// и кнопку «Старт», которая открывает мини-апп. Остальные сообщения пока игнорируем.
//
// POST /api/bot — сюда Telegram шлёт обновления. Проверяем заголовок X-Telegram-Bot-Api-Secret-Token.
// GET  /api/bot?setup=<TELEGRAM_BOT_TOKEN> — один раз: подключает вебхук к этому адресу (открыть в браузере).
//
// Нужна переменная окружения TELEGRAM_BOT_TOKEN (уже есть — для входа по Telegram). MINIAPP_URL — по желанию (см. miniAppUrl).
// Текст приветствия — WELCOME ниже, картинка — public/bot/welcome-2.jpg.
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

export const config = { maxDuration: 15 };

const WELCOME = [
  '<b>Добро пожаловать в rebutt!</b>',
  '',
  'О кишечнике принято молчать. Мы предпочитаем его понимать.',
  'Ведь он влияет на энергию, кожу, настроение и лёгкость каждый день. Пора узнать его лучше.',
  '',
  'За 14 дней ты увидишь, как твой организм реагирует на питание, стресс и цикл. Без догадок и общих советов, только твои данные.'
].join('\n');

const START_BUTTON = 'Старт';
const WELCOME_PHOTO = '/bot/welcome-2.jpg';
/** Ключ в bot_settings: file_id привязан к картинке — поменяли файл, меняем и ключ */
const PHOTO_KEY = 'welcome_photo:' + WELCOME_PHOTO;

// ---------- file_id картинки: по нему Telegram показывает фото сразу, по ссылке — каждый раз скачивает ----------
// Храним в памяти функции (пока она «тёплая») и в Supabase (таблица bot_settings), чтобы переживать перезапуски.
let photoId = process.env.TELEGRAM_WELCOME_FILE_ID || '';
const env = (k) => process.env[k] || process.env['VITE_' + k] || '';
const db = () => (env('SUPABASE_URL') && process.env.SUPABASE_SECRET_KEY
  ? createClient(env('SUPABASE_URL'), process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  : null);

async function readPhotoId() {
  if (photoId) return photoId;
  try {
    const c = db(); if (!c) return '';
    const { data } = await c.from('bot_settings').select('value').eq('key', PHOTO_KEY).maybeSingle();
    photoId = (data && data.value) || '';
  } catch (_) { /* таблицы нет — отправим по ссылке */ }
  return photoId;
}

async function savePhotoId(id) {
  photoId = id;
  try { const c = db(); if (c) await c.from('bot_settings').upsert({ key: PHOTO_KEY, value: id, updated_at: new Date().toISOString() }); } catch (_) { /* не страшно */ }
}

/** Секрет вебхука — из токена бота, отдельная переменная не нужна */
const webhookSecret = (token) => crypto.createHmac('sha256', token).update('rebutt-webhook').digest('hex').slice(0, 48);

const sameString = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

/** Адрес мини-аппа для кнопки «Старт». MINIAPP_URL — если приложение открывают с другого адреса,
 *  например с *.vercel.app (свой домен на Vercel из России часто не грузится без VPN). Иначе — домен этой функции. */
const miniAppUrl = (req) => (process.env.MINIAPP_URL || origin(req)).replace(/\/+$/, '') + '/';

/** https://www.rebutt.app — адрес, на котором открыли функцию */
function origin(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return 'https://' + host;
}

async function tg(token, method, body) {
  const r = await fetch('https://api.telegram.org/bot' + token + '/' + method, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return r.json().catch(() => ({ ok: false, description: 'HTTP ' + r.status }));
}

export default async function handler(req, res) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return res.status(500).json({ error: 'Нет TELEGRAM_BOT_TOKEN' });
  res.setHeader('Cache-Control', 'no-store');

  // ---------- подключение вебхука (один раз) ----------
  if (req.method === 'GET') {
    if (!req.query || !req.query.setup || !sameString(req.query.setup, token)) return res.status(404).json({ error: 'Not found' });
    const result = await tg(token, 'setWebhook', {
      url: origin(req) + '/api/bot',
      secret_token: webhookSecret(token),
      allowed_updates: ['message'],
      drop_pending_updates: true
    });
    return res.status(result.ok ? 200 : 500).json({ webhook: origin(req) + '/api/bot', ok: !!result.ok, telegram: result.description || '' });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!sameString(req.headers['x-telegram-bot-api-secret-token'] || '', webhookSecret(token))) return res.status(401).end();

  const update = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const msg = update.message;
  const text = (msg && msg.text) || '';

  try {
    if (msg && msg.chat && /^\/start(\s|@|$)/.test(text)) {
      const app = origin(req);
      const keyboard = { inline_keyboard: [[{ text: START_BUTTON, web_app: { url: miniAppUrl(req) } }]] };
      const send = (photo) => tg(token, 'sendPhoto', { chat_id: msg.chat.id, photo, caption: WELCOME, parse_mode: 'HTML', reply_markup: keyboard });
      const cached = await readPhotoId();
      let result = cached ? await send(cached) : { ok: false };
      if (!result.ok) {
        result = await send(app + WELCOME_PHOTO);
        const sizes = result.ok && result.result && result.result.photo;
        if (sizes && sizes.length) await savePhotoId(sizes[sizes.length - 1].file_id);
      }
      // картинка не загрузилась — шлём хотя бы текст с кнопкой
      if (!result.ok) {
        await tg(token, 'sendMessage', {
          chat_id: msg.chat.id,
          text: WELCOME,
          parse_mode: 'HTML',
          reply_markup: keyboard
        });
      }
    }
  } catch (e) {
    console.error('bot', e);
  }
  // Telegram ждёт 200, иначе будет повторять обновление
  return res.status(200).json({ ok: true });
}
