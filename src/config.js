// Общие настройки приложения. Название пока плейсхолдер — поменяйте здесь и в public/legal/*.html
export const APP_NAME = '[название]';
export const APP_VERSION = '1.0.0';

// Поддержка
export const SUPPORT_URL = 'https://t.me/the_dokhova';

// Юридические документы. При изменении текста документа поднимите версию —
// новое согласие сохранится в Supabase (таблица consents) и в PostHog.
export const LEGAL_VERSION = '2026-10-18';
export const LEGAL_DOCS = {
  terms: { url: '/legal/terms.html', title: 'Пользовательское соглашение' },
  privacy: { url: '/legal/privacy.html', title: 'Политика конфиденциальности' },
  consent: { url: '/legal/consent.html', title: 'Согласие на обработку данных о здоровье' }
};

const env = import.meta.env;
export const POSTHOG_KEY = env.VITE_POSTHOG_KEY || '';
export const POSTHOG_HOST = env.VITE_POSTHOG_HOST || 'https://eu.i.posthog.com';
export const SUPABASE_URL = env.VITE_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY || '';
export const API_BASE = env.VITE_API_BASE || '';

// ?demo — демо-режим с тестовыми данными (для показа и юзер-тестов), ничего не сохраняет
export const IS_DEMO = typeof location !== 'undefined' && new URLSearchParams(location.search).has('demo');
