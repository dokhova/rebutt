// Аналитика: каждое событие уходит в PostHog и дублируется в Supabase (таблица analytics_events).
// Словарь событий — docs/ANALYTICS.md. Добавляя событие, допишите его туда.

import posthog from 'posthog-js';
import { POSTHOG_KEY, POSTHOG_HOST, APP_VERSION, IS_DEMO } from '../config.js';
import { supabase, getUser } from './supabase.js';
import { telegramAnalyticsProps } from './telegram.js';
import { newId } from '../core/id.js';

const BATCH_SIZE = 20;
const FLUSH_DELAY_MS = 4000;

let posthogReady = false;
let currentScreen = '';
let flushTimer = null;
const queue = [];

const sessionId = (() => {
  try {
    let id = sessionStorage.getItem('gt_sid');
    if (!id) { id = newId(); sessionStorage.setItem('gt_sid', id); }
    return id;
  } catch (_) { return newId(); }
})();

/** Постоянный id устройства — если нет Supabase */
function deviceId() {
  try {
    let id = localStorage.getItem('gt_device_id');
    if (!id) { id = newId(); localStorage.setItem('gt_device_id', id); }
    return id;
  } catch (_) { return newId(); }
}

function stripTelegramUrls(value) {
  if (typeof value === 'string' && value.includes('tgWebApp')) {
    try {
      const url = new URL(value);
      for (const key of [...url.searchParams.keys()]) {
        if (key.startsWith('tgWebApp')) url.searchParams.delete(key);
      }
      if (url.hash.includes('tgWebApp')) url.hash = '';
      return url.href;
    } catch (_) { return ''; }
  }
  if (Array.isArray(value)) return value.map(stripTelegramUrls);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, stripTelegramUrls(item)]));
  }
  return value;
}

export function initAnalytics() {
  if (POSTHOG_KEY) {
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      // Telegram передаёт initData в URL: удаляем параметры SDK до отправки в PostHog.
      before_send: (event) => {
        if (event) event.properties = stripTelegramUrls(event.properties);
        return event;
      },
      person_profiles: 'identified_only',
      capture_pageview: false, // экраны SPA отправляем сами через pageview()
      capture_pageleave: true,
      autocapture: true,
      session_recording: { maskAllInputs: true },
      persistence: 'localStorage+cookie'
    });
    posthog.register({ app_version: APP_VERSION, is_demo: IS_DEMO, ...telegramAnalyticsProps() });
    posthogReady = true;
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
}

/** Привязывает события к пользователю: id из Supabase или id устройства */
export async function identifyUser(traits) {
  const user = await getUser();
  const id = user ? user.id : deviceId();
  if (posthogReady && !IS_DEMO) posthog.identify(id, traits || {});
  return id;
}

export function setPersonProps(traits) {
  if (posthogReady && !IS_DEMO) posthog.setPersonProperties(traits);
}

/** Текущий экран: добавляется ко всем событиям и шлётся как $pageview */
export function setScreen(screen) {
  currentScreen = screen;
  if (posthogReady) posthog.capture('$pageview', { $current_url: location.origin + location.pathname + '#' + screen, screen });
}

export function track(event, props) {
  const properties = { screen: currentScreen, ...(props || {}) };
  if (posthogReady) posthog.capture(event, properties);
  if (import.meta.env.DEV) console.debug('[track]', event, properties);
  if (!supabase || IS_DEMO) return;
  queue.push({ event, properties, screen: currentScreen, session_id: sessionId, client_ts: new Date().toISOString(), app_version: APP_VERSION });
  if (queue.length >= BATCH_SIZE) flush();
  else if (!flushTimer) flushTimer = setTimeout(flush, FLUSH_DELAY_MS);
}

/** Отправляет накопленные события в Supabase */
export async function flush() {
  clearTimeout(flushTimer);
  flushTimer = null;
  if (!supabase || !queue.length) return;
  const user = await getUser();
  if (!user) return;
  const batch = queue.splice(0).map((r) => ({ ...r, user_id: user.id }));
  const { error } = await supabase.from('analytics_events').insert(batch);
  if (error) console.warn('[analytics] supabase insert failed:', error.message);
}

/** После удаления данных: очередь очищается, PostHog начинает нового анонимного пользователя */
export function resetAnalytics() {
  queue.length = 0;
  if (posthogReady) posthog.reset();
}
