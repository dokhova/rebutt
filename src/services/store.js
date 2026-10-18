// Хранение данных: локальный кэш (localStorage) + Supabase.
// Интерфейс одинаковый — если Supabase не настроен, всё работает только локально.
import { supabase, getUser } from './supabase.js';
import { IS_DEMO } from '../config.js';

const LS_KEY = 'gt_state_v1';

export const keyOf = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
export const parseKey = (k) => { const p = k.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); };
const addDays = (k, n) => { const d = parseKey(k); d.setDate(d.getDate() + n); return keyOf(d); };
const diffDays = (a, b) => Math.round((parseKey(a) - parseKey(b)) / 864e5);
export const newId = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));

// ---------- локальный кэш ----------
export function loadLocal() {
  if (IS_DEMO) return null;
  try { const raw = localStorage.getItem(LS_KEY); return raw ? JSON.parse(raw) : null; } catch (_) { return null; }
}
export function saveLocal(profile, log) {
  if (IS_DEMO) return;
  try {
    // фото еды (blob-ссылки) не сохраняем — они живут только в текущей сессии
    const clean = {};
    Object.keys(log).forEach((k) => { clean[k] = { ...log[k], meals: (log[k].meals || []).map((m) => ({ ...m, photo: '' })) }; });
    localStorage.setItem(LS_KEY, JSON.stringify({ profile, log: clean }));
  } catch (_) {}
}
export function clearLocal() {
  try {
    Object.keys(localStorage).filter((k) => k.indexOf('gt_') === 0).forEach((k) => localStorage.removeItem(k));
  } catch (_) {}
}

// ---------- маппинг профиля ----------
function profileToRow(p, todayK) {
  return {
    name: p.name || null,
    age: p.age || null,
    sex: p.sex || null,
    goals: p.goals || [],
    goal_other: p.other || null,
    cycle_enabled: !!p.cycle,
    cycle_last_start: p.cycle && !p.lastUnknown ? addDays(todayK, -p.lastAgo) : null,
    cycle_length: p.len || 28,
    reminder_am: !!p.am,
    reminder_pm: !!p.pm,
    onboarded_at: p.onboardedAt || null,
    updated_at: new Date().toISOString()
  };
}
function rowToProfile(r, todayK) {
  return {
    name: r.name || '', age: r.age || 28, sex: r.sex || '', goals: r.goals || [], other: r.goal_other || '',
    cycle: !!r.cycle_enabled, lastUnknown: r.cycle_enabled && !r.cycle_last_start,
    lastAgo: r.cycle_last_start ? Math.max(0, diffDays(todayK, r.cycle_last_start)) : 11,
    len: r.cycle_length || 28, am: !!r.reminder_am, pm: !!r.reminder_pm,
    onboardedAt: r.onboarded_at, since: (r.created_at || '').slice(0, 10)
  };
}

// ---------- загрузка ----------
export async function loadRemote(todayK, days = 90) {
  if (!supabase) return null;
  const u = await getUser();
  if (!u) return null;
  const from = addDays(todayK, -days);
  const [pr, gut, meals, per] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', u.id).maybeSingle(),
    supabase.from('gut_entries').select('*').gte('day', from).order('time'),
    supabase.from('meals').select('*').gte('day', from).order('time'),
    supabase.from('period_days').select('day').gte('day', from)
  ]);
  if (pr.error) { console.warn('[store] profile load:', pr.error.message); return null; }
  const log = {};
  const day = (k) => (log[k] = log[k] || { gut: [], meals: [], period: false });
  (gut.data || []).forEach((g) => day(g.day).gut.push({
    id: g.id, time: (g.time || '').slice(0, 5),
    type: g.stool === 'had' ? (g.bristol_type || 4) : g.stool === 'none' ? 0 : -1, sym: g.symptoms || []
  }));
  (meals.data || []).forEach((m) => day(m.day).meals.push({
    id: m.id, time: (m.time || '').slice(0, 5), name: m.name, kcal: m.kcal, fiber: Number(m.fiber) || 0,
    verdict: m.verdict, tone: m.tone, tip: m.tip, photo: ''
  }));
  (per.data || []).forEach((p) => { day(p.day).period = true; });
  return { profile: pr.data ? rowToProfile(pr.data, todayK) : null, log };
}

// ---------- запись ----------
async function run(label, q) {
  try { const { error } = await q; if (error) console.warn('[store] ' + label + ':', error.message); return !error; }
  catch (e) { console.warn('[store] ' + label, e); return false; }
}

export async function saveProfile(p, todayK) {
  if (!supabase) return;
  const u = await getUser(); if (!u) return;
  return run('profile', supabase.from('profiles').upsert({ id: u.id, ...profileToRow(p, todayK) }));
}

export async function saveConsents(docs, version) {
  if (!supabase) return;
  const u = await getUser(); if (!u) return;
  const ua = (navigator.userAgent || '').slice(0, 300);
  return run('consents', supabase.from('consents').insert(docs.map((d) => ({ user_id: u.id, document: d, version, user_agent: ua }))));
}

export async function addGut(dayK, g) {
  if (!supabase) return;
  const u = await getUser(); if (!u) return;
  return run('gut', supabase.from('gut_entries').insert({
    id: g.id, user_id: u.id, day: dayK, time: g.time,
    stool: g.type > 0 ? 'had' : g.type === 0 ? 'none' : null,
    bristol_type: g.type > 0 ? g.type : null, symptoms: g.sym
  }));
}

export async function addMeal(dayK, m) {
  if (!supabase) return;
  const u = await getUser(); if (!u) return;
  return run('meal', supabase.from('meals').insert({
    id: m.id, user_id: u.id, day: dayK, time: m.time, name: m.name, kcal: m.kcal, fiber: m.fiber,
    verdict: m.verdict, tone: m.tone, tip: m.tip, source: m.source || 'photo'
  }));
}

export async function setPeriod(dayK, on) {
  if (!supabase) return;
  const u = await getUser(); if (!u) return;
  if (on) return run('period', supabase.from('period_days').upsert({ user_id: u.id, day: dayK }));
  return run('period', supabase.from('period_days').delete().eq('user_id', u.id).eq('day', dayK));
}

// Полное удаление данных пользователя (записи, еда, цикл, профиль, согласия, аналитика)
export async function wipeAll() {
  clearLocal();
  if (!supabase) return true;
  const u = await getUser(); if (!u) return true;
  const tables = ['gut_entries', 'meals', 'period_days', 'analytics_events', 'consents'];
  const ok = await Promise.all(tables.map((t) => run('wipe ' + t, supabase.from(t).delete().eq('user_id', u.id))));
  const okP = await run('wipe profile', supabase.from('profiles').delete().eq('id', u.id));
  return ok.every(Boolean) && okP;
}
