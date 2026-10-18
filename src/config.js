// Настройки приложения. Всё, что может понадобиться поменять без погружения в код, — здесь.

// Название приложения
export const APP_NAME = 'Rebutt';

// Версия берётся из package.json (см. vite.config.js → define)
export const APP_VERSION = __APP_VERSION__;

// Поддержка
export const SUPPORT_URL = 'https://t.me/the_dokhova';

// Юридические документы. При изменении текста документа поднимите версию —
// новое согласие сохранится в Supabase (таблица consents) и в PostHog.
export const LEGAL_VERSION = '2026-10-18.2';
export const LEGAL_DOCS = {
  terms: { url: '/legal/terms.html', title: 'Пользовательское соглашение' },
  privacy: { url: '/legal/privacy.html', title: 'Политика конфиденциальности' },
  consent: { url: '/legal/consent.html', title: 'Согласие на обработку данных о здоровье' }
};

// Переменные окружения (.env.local локально, Settings → Environment Variables на Vercel). Описание — .env.example
const env = import.meta.env;
export const POSTHOG_KEY = env.VITE_POSTHOG_KEY || '';
export const POSTHOG_HOST = env.VITE_POSTHOG_HOST || 'https://eu.i.posthog.com';
export const SUPABASE_URL = env.VITE_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY || '';
export const API_BASE = env.VITE_API_BASE || '';

// ?demo — демо-режим с тестовыми данными (для показа и юзер-тестов), ничего не сохраняет
export const IS_DEMO = typeof location !== 'undefined' && new URLSearchParams(location.search).has('demo');
