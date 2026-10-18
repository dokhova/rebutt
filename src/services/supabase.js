// Supabase: клиент + анонимная авторизация.
// Пользователь не регистрируется — при первом входе создаётся анонимный аккаунт,
// сессия хранится в браузере. Все таблицы защищены RLS по auth.uid().
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, IS_DEMO } from '../config.js';

export const supabase = (!IS_DEMO && SUPABASE_URL && SUPABASE_ANON_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true } })
  : null;

let userPromise = null;

export function getUser() {
  if (!supabase) return Promise.resolve(null);
  if (!userPromise) {
    userPromise = (async () => {
      const { data } = await supabase.auth.getSession();
      if (data && data.session) return data.session.user;
      const res = await supabase.auth.signInAnonymously();
      if (res.error) { console.warn('[supabase] anon sign-in failed:', res.error.message); return null; }
      return res.data.user;
    })().catch((e) => { console.warn('[supabase]', e); return null; });
  }
  return userPromise;
}

export async function getAccessToken() {
  if (!supabase) return '';
  await getUser();
  const { data } = await supabase.auth.getSession();
  return (data && data.session && data.session.access_token) || '';
}

export async function signOutAndReset() {
  if (!supabase) return;
  try { await supabase.auth.signOut(); } catch (_) {}
  userPromise = null;
}
