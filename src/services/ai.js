// Клиент к серверным функциям /api/* (Vercel). Токен OpenAI живёт только на сервере.
import { API_BASE } from '../config.js';
import { getAccessToken } from './supabase.js';

async function call(path, body, timeoutMs = 45000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const token = await getAccessToken();
    const res = await fetch(API_BASE + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      body: JSON.stringify(body),
      signal: ctrl.signal
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
    return data;
  } finally { clearTimeout(t); }
}

// Фото блюда → { name, kcal, fiber, verdict, tone, tip }
export const analyzeFood = (image, context) => call('/api/food', { image, context });
// Вопрос → { answer }
export const askAI = (question, context) => call('/api/ask', { question, context });
// Совет на сегодня + наблюдение за неделю → { tip_title, tip_text, noticed }
export const getInsights = (context) => call('/api/insights', { context });
