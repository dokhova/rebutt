// Клиент серверных функций /api/* (Vercel). Ключ OpenAI живёт только на сервере.
import { API_BASE } from '../config.js';
import { getAccessToken } from './supabase.js';
import { telegramInitData } from './telegram.js';

const TIMEOUT_MS = 45000;

async function post(path, body) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const token = await getAccessToken();
    const initData = telegramInitData();
    const res = await fetch(API_BASE + path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
        ...(initData ? { 'X-Telegram-Init-Data': initData } : {})
      },
      body: JSON.stringify(body),
      signal: ctrl.signal
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Сервер ответил ' + res.status);
    return data;
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('ИИ не ответил за 45 секунд');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/** Фото блюда (data URL) → { is_food, name, kcal, fiber, verdict, tone, tip } */
export const analyzeFood = (image, goals) => post('/api/food', { image, goals });

/** Вопрос + сводка записей → { answer } */
export const askAI = (question, context) => post('/api/ask', { question, context });

/** Сводка записей → { tip_title, tip_text, noticed } */
export const getInsights = (context) => post('/api/insights', { context });
