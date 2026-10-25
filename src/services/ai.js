// Клиент серверных функций /api/* (Vercel). Ключ OpenAI живёт только на сервере.
import { API_BASE } from '../config.js';
import { getAccessToken } from './supabase.js';
import { telegramInitData } from './telegram.js';

const TIMEOUT_MS = 45000;

async function post(path, body, timeoutMs = TIMEOUT_MS) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
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
    if (e.name === 'AbortError') throw new Error('ИИ не ответил за ' + Math.round(timeoutMs / 1000) + ' секунд');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Разбор блюда → { is_food, name, kcal, protein, fat, carbs, fiber, tone, tip }
 * @param {{ image?: string, note?: string, previous?: object, context?: object }} input — context из domain/ai-context.js → foodContext
 */
export const analyzeFood = (input) => post('/api/food', input);

/** Вопрос (+ фото) + начало разговора + сводка записей → { answer } */
export const askAI = ({ question, image, history, context }) => post('/api/ask', { question, image, history, context });

/** Сводка записей → { tip_title, tip_text, noticed } */
export const getInsights = (context) => post('/api/insights', { context });

/** Картинка блюда по описанию (когда нет фото) → { image: data URL }. Генерация дольше обычного ответа — ждём до 70 с. */
export const generateMealImage = ({ name, note }) => post('/api/meal-image', { name, note }, 70000);
