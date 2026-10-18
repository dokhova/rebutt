// Аналитика: каждое событие уходит в PostHog и дублируется в Supabase (таблица analytics_events).
// Словарь событий — docs/ANALYTICS.md
import posthog from 'posthog-js';
import { POSTHOG_KEY, POSTHOG_HOST, APP_VERSION, IS_DEMO } from '../config.js';
import { supabase, getUser } from './supabase.js';

let phReady = false;
let userId = null;
let currentScreen = '';
const queue = [];
let flushTimer = null;
const sessionId = (() => {
  try {
    let s = sessionStorage.getItem('gt_sid');
    if (!s) { s = uid(); sessionStorage.setItem('gt_sid', s); }
    return s;
  } catch (_) { return uid(); }
})();

function uid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16); });
}

export function localId() {
  try {
    let id = localStorage.getItem('gt_local_id');
    if (!id) { id = uid(); localStorage.setItem('gt_local_id', id); }
    return id;
  } catch (_) { return uid(); }
}

export function initAnalytics() {
  if (POSTHOG_KEY) {
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      person_profiles: 'identified_only',
      capture_pageview: false,          // экраны шлём сами (SPA)
      capture_pageleave: true,
      autocapture: true,
      session_recording: { maskAllInputs: true, maskTextSelector: '[data-ph-mask]' },
      persistence: 'localStorage+cookie'
    });
    posthog.register({ app_version: APP_VERSION, is_demo: IS_DEMO, platform: 'web' });
    phReady = true;
  }
  // flush в Supabase при уходе со страницы
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
}

// Привязываем события к пользователю (id из Supabase или локальный id)
export async function identifyUser(extraProps) {
  const u = await getUser();
  userId = u ? u.id : localId();
  if (phReady && !IS_DEMO) posthog.identify(userId, extraProps || {});
  return userId;
}

export function setPersonProps(props) {
  if (phReady && !IS_DEMO) posthog.setPersonProperties(props);
}

export function setScreen(screen) { currentScreen = screen; }

// Виртуальный pageview для веб-аналитики PostHog (экраны SPA)
export function pageview(screen) {
  if (!phReady) return;
  posthog.capture('$pageview', { $current_url: location.origin + location.pathname + '#' + screen, screen });
}

export function track(event, props) {
  const p = Object.assign({ screen: currentScreen }, props || {});
  if (phReady) posthog.capture(event, p);
  if (import.meta.env.DEV) console.debug('[track]', event, p);
  if (!supabase || IS_DEMO) return;
  queue.push({ event, properties: p, screen: currentScreen, session_id: sessionId, client_ts: new Date().toISOString(), app_version: APP_VERSION });
  if (queue.length >= 20) flush();
  else if (!flushTimer) flushTimer = setTimeout(flush, 4000);
}

export async function flush() {
  clearTimeout(flushTimer); flushTimer = null;
  if (!supabase || !queue.length) return;
  const u = await getUser();
  if (!u) return;
  const batch = queue.splice(0, queue.length).map((r) => ({ ...r, user_id: u.id }));
  const { error } = await supabase.from('analytics_events').insert(batch);
  if (error) console.warn('[analytics] supabase insert failed:', error.message);
}

export function resetAnalytics() {
  queue.length = 0;
  if (phReady) posthog.reset();
}
