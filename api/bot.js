// Бот Telegram: вебхук. На /start присылает приветствие — зацикленное видео public/bot/welcome-loop.mp4 с текстом (дальше — по file_id из bot_settings, без повторной загрузки)
// и кнопку «Старт», которая открывает мини-апп. Остальные сообщения пока игнорируем.
//
// POST /api/bot — сюда Telegram шлёт обновления. Проверяем заголовок X-Telegram-Bot-Api-Secret-Token.
// GET  /api/bot?setup=<TELEGRAM_BOT_TOKEN> — один раз: подключает вебхук к этому адресу (открыть в браузере).
//
// Нужна переменная окружения TELEGRAM_BOT_TOKEN (уже есть — для входа по Telegram). MINIAPP_URL — по желанию (см. miniAppUrl).
// Текст приветствия — WELCOME ниже, видео — public/bot/welcome-loop.mp4 (без звука: так Telegram сам зацикливает его как GIF),
// запасная картинка, если видео не отправилось, — public/bot/welcome-3.jpg.
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
const WELCOME_VIDEO = '/bot/welcome-loop.mp4';
const WELCOME_PHOTO = '/bot/welcome-3.jpg';
/** Ключ в bot_settings: file_id привязан к файлу — поменяли файл, меняем и ключ */
const VIDEO_KEY = 'welcome_animation:' + WELCOME_VIDEO;

// ---------- file_id видео: по нему Telegram показывает его сразу, по ссылке — каждый раз скачивает ----------
// Храним в памяти функции (пока она «тёплая») и в Supabase (таблица bot_settings), чтобы переживать перезапуски.
let videoId = '';
const env = (k) => process.env[k] || process.env['VITE_' + k] || '';
const db = () => (env('SUPABASE_URL') && process.env.SUPABASE_SECRET_KEY
  ? createClient(env('SUPABASE_URL'), process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  : null);

async function readVideoId() {
  if (videoId) return videoId;
  try {
    const c = db(); if (!c) return '';
    const { data } = await c.from('bot_settings').select('value').eq('key', VIDEO_KEY).maybeSingle();
    videoId = (data && data.value) || '';
  } catch (_) { /* таблицы нет — отправим по ссылке */ }
  return videoId;
}

async function saveVideoId(id) {
  videoId = id;
  try { const c = db(); if (c) await c.from('bot_settings').upsert({ key: VIDEO_KEY, value: id, updated_at: new Date().toISOString() }); } catch (_) { /* не страшно */ }
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
      const message = { chat_id: msg.chat.id, caption: WELCOME, parse_mode: 'HTML', reply_markup: keyboard };
      const sendVideo = (animation) => tg(token, 'sendAnimation', { ...message, animation, width: 1280, height: 720, duration: 12 });
      const cached = await readVideoId();
      let result = cached ? await sendVideo(cached) : { ok: false };
      if (!result.ok) {
        result = await sendVideo(app + WELCOME_VIDEO);
        const video = result.ok && result.result && result.result.animation;
        if (video && video.file_id) await saveVideoId(video.file_id);
      }
      // видео не отправилось — шлём картинку
      if (!result.ok) result = await tg(token, 'sendPhoto', { ...message, photo: app + WELCOME_PHOTO });
      // и она не загрузилась — шлём хотя бы текст с кнопкой
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
