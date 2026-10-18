// POST /api/auth/telegram  { initData } → { access_token, refresh_token }
// Вход через Telegram: проверяем подпись initData, находим или создаём пользователя Supabase
// и выдаём ему сессию. Пользователь привязан к Telegram-аккаунту — данные не теряются
// при переустановке Telegram и доступны с любого устройства.
//
// Нужны переменные окружения: TELEGRAM_BOT_TOKEN, SUPABASE_SECRET_KEY,
// VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY.
import { createClient } from '@supabase/supabase-js';
import { verifyInitData } from '../_lib/telegram.js';

export const config = { maxDuration: 30 };

const env = (k) => process.env[k] || process.env['VITE_' + k] || '';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const url = env('SUPABASE_URL'), anonKey = env('SUPABASE_ANON_KEY');
  const secretKey = process.env.SUPABASE_SECRET_KEY, botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!url || !anonKey || !secretKey || !botToken) {
    return res.status(500).json({ error: 'Вход через Telegram не настроен: нужны TELEGRAM_BOT_TOKEN и SUPABASE_SECRET_KEY' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const tgUser = verifyInitData(String(body.initData || ''), botToken);
  if (!tgUser) return res.status(401).json({ error: 'Подпись Telegram не прошла проверку' });

  try {
    const admin = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
    // Технический email: письма на него не отправляются, нужен только как логин в Supabase
    const email = 'tg' + tgUser.id + '@users.rebutt.app';
    const metadata = { telegram_id: tgUser.id, first_name: tgUser.first_name || '', photo_url: tgUser.photo_url || '' };

    const created = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: metadata });
    if (created.error && !/already|exists|registered/i.test(created.error.message)) throw created.error;

    const link = await admin.auth.admin.generateLink({ type: 'magiclink', email });
    if (link.error) throw link.error;

    const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const verified = await client.auth.verifyOtp({ token_hash: link.data.properties.hashed_token, type: 'email' });
    if (verified.error || !verified.data.session) throw verified.error || new Error('Нет сессии');

    const { access_token, refresh_token } = verified.data.session;
    res.status(200).json({ access_token, refresh_token });
  } catch (e) {
    console.error('[auth/telegram]', e.message);
    res.status(500).json({ error: 'Не получилось войти: ' + e.message });
  }
}
