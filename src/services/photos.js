// Фото блюд на устройстве: IndexedDB, ключ — id блюда, значение — уменьшенный JPEG (data URL, ~30–60 КБ).
// localStorage для фото не подходит — там всего ~5 МБ на всё приложение.
// Копия на сервере — Supabase Storage (services/store.js → uploadMealPhoto), сюда кладём для мгновенного показа и работы без сети.
// Любая ошибка (приватный режим, нет IndexedDB) — просто нет локального фото, интерфейс не ломается.

const DB_NAME = 'gt_photos';
const STORE = 'meals';

let dbPromise = null;

function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      try {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      } catch (_) { resolve(null); }
    });
  }
  return dbPromise;
}

async function tx(mode, fn) {
  const db = await open();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const t = db.transaction(STORE, mode), st = t.objectStore(STORE);
      const out = fn(st);
      t.oncomplete = () => resolve(out && 'result' in out ? out.result : true);
      t.onerror = t.onabort = () => resolve(null);
    } catch (_) { resolve(null); }
  });
}

/** Сохраняет фото блюда */
export const putPhoto = (id, dataUrl) => tx('readwrite', (st) => st.put(dataUrl, id));

export const deletePhoto = (id) => tx('readwrite', (st) => st.delete(id));

export const clearPhotos = () => tx('readwrite', (st) => st.clear());

/** Фото для списка id → { [id]: dataUrl } (только те, что есть) */
export async function getPhotos(ids) {
  const db = await open();
  if (!db || !ids.length) return {};
  return new Promise((resolve) => {
    const out = {};
    try {
      const t = db.transaction(STORE, 'readonly'), st = t.objectStore(STORE);
      for (const id of ids) {
        const r = st.get(id);
        r.onsuccess = () => { if (r.result) out[id] = r.result; };
      }
      t.oncomplete = () => resolve(out);
      t.onerror = t.onabort = () => resolve(out);
    } catch (_) { resolve(out); }
  });
}

/** Подставляет фото в записи: meals[i].photo — из map по id, если у блюда ещё нет своего */
export function withPhotos(log, map) {
  if (!Object.keys(map).length) return log;
  const out = {};
  for (const k of Object.keys(log)) {
    const d = log[k];
    out[k] = d.meals && d.meals.some((m) => map[m.id] && !m.photo)
      ? { ...d, meals: d.meals.map((m) => (map[m.id] && !m.photo ? { ...m, photo: map[m.id] } : m)) }
      : d;
  }
  return out;
}

/** id всех блюд в записях */
export const mealIds = (log) => Object.values(log).flatMap((d) => (d.meals || []).map((m) => m.id)).filter(Boolean);
