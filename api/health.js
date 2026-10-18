// GET /api/health — что настроено на сервере (без значений ключей).
// GET /api/health?openai=1 — плюс пробный запрос к OpenAI: проверяет ключ и баланс.
// Открывать в браузере: https://www.rebutt.app/api/health?openai=1
const has = (k) => !!(process.env[k] || process.env['VITE_' + k]);

export default async function handler(req, res) {
  const out = {
    openai_api_key: has('OPENAI_API_KEY'),
    openai_model: process.env.OPENAI_MODEL || 'gpt-5-mini',
    supabase_url: has('SUPABASE_URL'),
    supabase_anon_key: has('SUPABASE_ANON_KEY'),
    supabase_secret_key: !!process.env.SUPABASE_SECRET_KEY,
    telegram_bot_token: !!process.env.TELEGRAM_BOT_TOKEN
  };

  if (req.query && req.query.openai && out.openai_api_key) {
    try {
      const r = await fetch('https://api.openai.com/v1/models/' + out.openai_model, {
        headers: { Authorization: 'Bearer ' + process.env.OPENAI_API_KEY }
      });
      const data = await r.json().catch(() => ({}));
      out.openai_check = r.ok ? 'ok' : ((data.error && data.error.message) || 'HTTP ' + r.status);
    } catch (e) {
      out.openai_check = 'error: ' + e.message;
    }
  }

  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json(out);
}
