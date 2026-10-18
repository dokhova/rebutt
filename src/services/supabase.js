// Supabase: клиент и вход.
// В Telegram — вход по Telegram-аккаунту (/api/auth/telegram): данные привязаны к аккаунту
// и не теряются при переустановке. В обычном браузере — анонимный аккаунт, сессия в браузере.
// Все таблицы защищены RLS по auth.uid() — см. supabase/migrations.

import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, IS_DEMO, API_BASE } from '../config.js';
import { telegramInitData, telegramUser } from './telegram.js';

/** null — Supabase не настроен или демо-режим; тогда данные живут только на устройстве */
export const supabase = !IS_DEMO && SUPABASE_URL && SUPABASE_ANON_KEY
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true } })
  : null;

let userPromise = null;

/** Текущий пользователь (создаётся при первом входе). null — Supabase недоступен. */
export function getUser() {
  if (!supabase) return Promise.resolve(null);
  if (!userPromise) {
    userPromise = signIn().catch((e) => { console.warn('[supabase]', e); return null; });
  }
  return userPromise;
}

async function signIn() {
  const { data } = await supabase.auth.getSession();
  const session = data && data.session;
  const tg = telegramUser();

  if (tg) {
    // Уже вошли этим же Telegram-аккаунтом — используем сессию
    if (session && String(session.user.user_metadata?.telegram_id) === String(tg.id)) return session.user;
    const user = await signInWithTelegram();
    if (user) return user;
    console.warn('[supabase] вход через Telegram не удался, пробую анонимный');
  } else if (session) {
    return session.user;
  }

  const res = await supabase.auth.signInAnonymously();
  if (res.error) { console.warn('[supabase] anonymous sign-in failed:', res.error.message); return null; }
  return res.data.user;
}

async function signInWithTelegram() {
  try {
    const r = await fetch(API_BASE + '/api/auth/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: telegramInitData() })
    });
    const tokens = await r.json().catch(() => ({}));
    if (!r.ok) { console.warn('[supabase] telegram auth:', tokens.error || r.status); return null; }
    const { data, error } = await supabase.auth.setSession(tokens);
    if (error) { console.warn('[supabase] setSession:', error.message); return null; }
    return data.user;
  } catch (e) {
    console.warn('[supabase] telegram auth', e);
    return null;
  }
}

/** JWT для запросов к /api */
export async function getAccessToken() {
  if (!supabase) return '';
  await getUser();
  const { data } = await supabase.auth.getSession();
  return (data && data.session && data.session.access_token) || '';
}

export async function signOut() {
  if (!supabase) return;
  try { await supabase.auth.signOut(); } catch (_) { /* сессия уже недействительна */ }
  userPromise = null;
}
