// Черновик экрана «+» (state.form): что сохранять на устройстве и как восстанавливать после перезапуска.
// Чистая логика без браузера — хранение в services/draft.js, фото черновика — в IndexedDB (services/photos.js).

/** Сколько живёт черновик: дольше — скорее всего, забытый, и показывать его уже странно */
export const DRAFT_TTL_MS = 24 * 3600 * 1000;

/** Поля формы, которые переживают перезапуск. Остальное — состояние процесса (идёт разбор, рисуется картинка). */
const KEEP = ['section', 'water', 'stool', 'type', 'sym', 'color', 'stress', 'period', 'food', 'note', 'result', 'source', 'fix'];

/** Заполнено ли в разделах хоть что-то */
export function draftSections(f) {
  return {
    stool: !!(f.stool || (f.sym && f.sym.length) || f.stress != null || f.period),
    food: f.food === 'done' || !!f.photo || !!(f.note && f.note.trim()),
    water: !!f.water
  };
}

export const isDraftEmpty = (f) => !Object.values(draftSections(f)).some(Boolean);

/** Форма → объект для localStorage. null — сохранять нечего. Само фото хранится отдельно, здесь только флаг. */
export function draftForStorage(f, now = Date.now()) {
  if (isDraftEmpty(f)) return null;
  const out = { savedAt: now, hasPhoto: !!f.photo };
  for (const k of KEEP) out[k] = f[k];
  // разбор прервался (закрыли приложение) — вернёмся к фото и описанию, «Разобрать» можно нажать снова
  if (out.food === 'scan') out.food = 'pick';
  if (out.food === 'done' && !out.result) out.food = 'pick';
  return out;
}

/** Сохранённый черновик → форма (поверх пустой). null — черновика нет, он устарел или битый. */
export function restoreDraft(saved, blank, now = Date.now()) {
  if (!saved || typeof saved !== 'object' || !(saved.savedAt > 0)) return null;
  if (now - saved.savedAt > DRAFT_TTL_MS) return null;
  const f = { ...blank };
  for (const k of KEEP) if (k in saved && saved[k] !== undefined) f[k] = saved[k];
  if (!Array.isArray(f.sym)) f.sym = [];
  if (!['pick', 'done'].includes(f.food) || (f.food === 'done' && !f.result)) f.food = 'pick';
  if (typeof f.note !== 'string') f.note = '';
  if (typeof f.fix !== 'string') f.fix = '';
  if (typeof f.water !== 'number' || !isFinite(f.water)) f.water = 0;
  return isDraftEmpty(f) && !saved.hasPhoto ? null : f;
}
