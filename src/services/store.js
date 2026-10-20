// Хранение данных: локальный кэш (localStorage) + Supabase.
// Если Supabase не настроен или это демо-режим — всё работает только на устройстве.
// Ошибки записи в Supabase не ломают интерфейс: пишутся в консоль, данные остаются в локальном кэше.

import { supabase, getUser } from './supabase.js';
import { IS_DEMO } from '../config.js';
import { addDays, diffDays } from '../domain/dates.js';
import { normalizeMeal } from '../domain/meal.js';
import { validHeight, validWeight } from '../domain/profile.js';

const LS_STATE = 'gt_state_v1';
const LS_PREFIX = 'gt_';
const HISTORY_DAYS = 90;

// ---------- локальный кэш ----------

export function loadLocal() {
  if (IS_DEMO) return null;
  try {
    const raw = localStorage.getItem(LS_STATE);
    return raw ? JSON.parse(raw) : null;
  } catch (_) { return null; }
}

export function saveLocal(profile, log) {
  if (IS_DEMO) return;
  try {
    // фото еды — blob-ссылки текущей сессии, их не сохраняем
    const clean = {};
    for (const k of Object.keys(log)) clean[k] = { ...log[k], meals: (log[k].meals || []).map((m) => ({ ...m, photo: '' })) };
    localStorage.setItem(LS_STATE, JSON.stringify({ profile, log: clean }));
  } catch (_) { /* переполнено или запрещено — не критично */ }
}

function clearLocal() {
  try {
    Object.keys(localStorage).filter((k) => k.startsWith(LS_PREFIX)).forEach((k) => localStorage.removeItem(k));
  } catch (_) { /* нет доступа к хранилищу */ }
}

/** Объединяет локальные и серверные записи без дублей (по id) */
export function mergeLogs(local, remote) {
  const out = {};
  const uniqueById = (arr) => {
    const seen = new Set();
    return arr.filter((e) => (e.id && seen.has(e.id) ? false : (e.id && seen.add(e.id), true)));
  };
  const byTime = (a, b) => a.time.localeCompare(b.time);
  for (const k of new Set([...Object.keys(local), ...Object.keys(remote)])) {
    const a = local[k] || {}, b = remote[k] || {};
    out[k] = {
      gut: uniqueById([...(b.gut || []), ...(a.gut || [])]).sort(byTime),
      meals: uniqueById([...(b.meals || []), ...(a.meals || [])]).sort(byTime),
      period: !!(a.period || b.period),
      // жидкость хранится одним числом за день; на устройстве — самое свежее, поэтому берём большее
      water: Math.max(a.water || 0, b.water || 0)
    };
  }
  return out;
}

// ---------- профиль: приложение ↔ таблица profiles ----------

function profileToRow(p, todayK) {
  return {
    name: p.name || null,
    age: p.age || null,
    sex: p.sex || null,
    height_cm: validHeight(p.height),
    weight_kg: validWeight(p.weight),
    goals: p.goals || [],
    goal_other: p.other || null,
    cycle_enabled: !!p.cycle,
    cycle_last_start: p.cycle && !p.lastUnknown ? addDays(todayK, -p.lastAgo) : null,
    cycle_length: p.len || 28,
    pregnant: !!p.pregnant,
    coc: !!p.coc,
    reminder_am: !!p.am,
    reminder_pm: !!p.pm,
    onboarded_at: p.onboardedAt || null,
    updated_at: new Date().toISOString()
  };
}

function rowToProfile(r, todayK) {
  return {
    name: r.name || '',
    age: r.age || 28,
    sex: r.sex || '',
    height: r.height_cm || null,
    weight: r.weight_kg || null,
    goals: r.goals || [],
    other: r.goal_other || '',
    cycle: !!r.cycle_enabled,
    lastUnknown: r.cycle_enabled && !r.cycle_last_start,
    lastAgo: r.cycle_last_start ? Math.max(0, diffDays(todayK, r.cycle_last_start)) : 11,
    len: r.cycle_length || 28,
    pregnant: !!r.pregnant,
    coc: !!r.coc,
    am: !!r.reminder_am,
    pm: !!r.reminder_pm,
    onboardedAt: r.onboarded_at,
    since: (r.created_at || '').slice(0, 10)
  };
}

// ---------- чтение ----------

/** Профиль и записи за последние 90 дней. null — Supabase недоступен. */
export async function loadRemote(todayK) {
  if (!supabase) return null;
  const user = await getUser();
  if (!user) return null;
  const from = addDays(todayK, -HISTORY_DAYS);
  const [pr, gut, meals, per, wat] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
    supabase.from('gut_entries').select('*').gte('day', from).order('time'),
    supabase.from('meals').select('*').gte('day', from).order('time'),
    supabase.from('period_days').select('day').gte('day', from),
    supabase.from('water_days').select('day, ml').gte('day', from)
  ]);
  if (wat.error) console.warn('[store] water load:', wat.error.message); // нет миграции water — приложение работает без неё
  if (pr.error) { console.warn('[store] profile load:', pr.error.message); return null; }

  const log = {};
  const day = (k) => (log[k] = log[k] || { gut: [], meals: [], period: false, water: 0 });
  for (const g of gut.data || []) {
    day(g.day).gut.push({
      id: g.id,
      time: (g.time || '').slice(0, 5),
      type: g.stool === 'had' ? (g.bristol_type || 4) : g.stool === 'none' ? 0 : -1,
      sym: g.symptoms || [],
      color: g.color || '',
      stress: g.stress == null ? null : g.stress
    });
  }
  for (const m of meals.data || []) {
    day(m.day).meals.push({
      id: m.id, time: (m.time || '').slice(0, 5), source: m.source, note: m.note || '', photo: '',
      ...normalizeMeal(m)
    });
  }
  for (const p of per.data || []) day(p.day).period = true;
  for (const w of wat.data || []) day(w.day).water = w.ml || 0;

  return { profile: pr.data ? rowToProfile(pr.data, todayK) : null, log };
}

// ---------- запись ----------

async function run(label, query) {
  try {
    const { error } = await query;
    if (error) console.warn('[store] ' + label + ':', error.message);
    return !error;
  } catch (e) {
    console.warn('[store] ' + label, e);
    return false;
  }
}

/** Выполняет fn(user), если Supabase настроен и пользователь есть */
async function withUser(fn) {
  if (!supabase) return true;
  const user = await getUser();
  return user ? fn(user) : true;
}

export const saveProfile = (p, todayK) =>
  withUser(async (u) => {
    const row = { id: u.id, ...profileToRow(p, todayK) };
    const { error } = await supabase.from('profiles').upsert(row);
    if (!error) return true;
    // миграция с ростом и весом ещё не применена — сохраняем остальное, чтобы профиль не терялся
    if (/height_cm|weight_kg/.test(error.message || '')) {
      console.warn('[store] нет колонок height_cm / weight_kg — примените миграцию 20261020100000_profile_body.sql');
      const { height_cm: _h, weight_kg: _w, ...rest } = row; // eslint-disable-line no-unused-vars
      return run('profile', supabase.from('profiles').upsert(rest));
    }
    console.warn('[store] profile:', error.message);
    return false;
  });

export const saveConsents = (documents, version) =>
  withUser((u) => {
    const ua = (navigator.userAgent || '').slice(0, 300);
    return run('consents', supabase.from('consents').insert(documents.map((d) => ({ user_id: u.id, document: d, version, user_agent: ua }))));
  });

const gutRow = (g) => ({
  stool: g.type > 0 ? 'had' : g.type === 0 ? 'none' : null,
  bristol_type: g.type > 0 ? g.type : null,
  symptoms: g.sym,
  color: g.type > 0 && g.color ? g.color : null,
  stress: g.stress == null ? null : g.stress
});

export const addGutEntry = (dayK, g) =>
  withUser((u) => run('gut', supabase.from('gut_entries').insert({ id: g.id, user_id: u.id, day: dayK, time: g.time, ...gutRow(g) })));

/** Правка записи о стуле или самочувствии */
export const updateGutEntry = (g) =>
  withUser(() => run('gut update', supabase.from('gut_entries').update(gutRow(g)).eq('id', g.id)));

export const deleteGutEntry = (id) =>
  withUser(() => run('gut delete', supabase.from('gut_entries').delete().eq('id', id)));

const mealRow = (m) => ({
  name: m.name, kcal: m.kcal, protein: m.protein, fat: m.fat, carbs: m.carbs, fiber: m.fiber,
  verdict: m.verdict, tone: m.tone, tip: m.tip, note: m.note || null
});

export const addMeal = (dayK, m) =>
  withUser((u) => run('meal', supabase.from('meals').insert({
    id: m.id, user_id: u.id, day: dayK, time: m.time, source: m.source || 'photo', ...mealRow(m)
  })));

/** Обновляет блюдо после уточнения */
export const updateMeal = (m) =>
  withUser(() => run('meal update', supabase.from('meals').update(mealRow(m)).eq('id', m.id)));

export const deleteMeal = (id) =>
  withUser(() => run('meal delete', supabase.from('meals').delete().eq('id', id)));

export const setPeriodDay = (dayK, on) =>
  withUser((u) => on
    ? run('period', supabase.from('period_days').upsert({ user_id: u.id, day: dayK }))
    : run('period', supabase.from('period_days').delete().eq('user_id', u.id).eq('day', dayK)));

/** Жидкость за день, мл: одна строка на день, перезаписывается */
export const setWaterDay = (dayK, ml) =>
  withUser((u) => run('water', supabase.from('water_days').upsert({ user_id: u.id, day: dayK, ml, updated_at: new Date().toISOString() })));

/** Удаляет всё по пользователю: записи, еду, цикл, согласия, аналитику, профиль. Плюс локальный кэш. */
export async function wipeAll() {
  clearLocal();
  return withUser(async (u) => {
    const tables = ['gut_entries', 'meals', 'period_days', 'water_days', 'analytics_events', 'consents'];
    const results = await Promise.all(tables.map((t) => run('wipe ' + t, supabase.from(t).delete().eq('user_id', u.id))));
    const profileOk = await run('wipe profiles', supabase.from('profiles').delete().eq('id', u.id));
    return results.every(Boolean) && profileOk;
  });
}
