// Черновик экрана «+» на устройстве: поля формы — localStorage (gt_add_draft), фото — IndexedDB под ключом DRAFT_PHOTO_ID.
// Что именно сохраняется и как восстанавливается — src/domain/draft.js.
// Ключ с префиксом gt_, поэтому «Удалить все данные» (store.wipeAll) стирает и черновик, и его фото.

import { IS_DEMO } from '../config.js';
import { compressImage } from './image.js';
import { putPhoto, deletePhoto, getPhotos } from './photos.js';

const LS_DRAFT = 'gt_add_draft';
/** Ключ фото черновика в IndexedDB; id блюд — случайные строки (core/id.js), не пересекаются */
export const DRAFT_PHOTO_ID = 'add-draft';

export function readDraft() {
  if (IS_DEMO) return null;
  try { return JSON.parse(localStorage.getItem(LS_DRAFT) || 'null'); } catch (_) { return null; }
}

/** data — результат draftForStorage; null — стереть */
export function writeDraft(data) {
  if (IS_DEMO) return;
  try {
    if (data) localStorage.setItem(LS_DRAFT, JSON.stringify(data));
    else localStorage.removeItem(LS_DRAFT);
  } catch (_) { /* переполнено или запрещено — черновик просто не переживёт перезапуск */ }
}

/** Фото черновика (data URL) или '' */
export async function readDraftPhoto() {
  if (IS_DEMO) return '';
  const map = await getPhotos([DRAFT_PHOTO_ID]);
  return map[DRAFT_PHOTO_ID] || '';
}

/**
 * Кладёт фото черновика в IndexedDB. blob-ссылка живёт только до перезапуска, поэтому храним уменьшенный JPEG
 * того же размера, что уходит в ИИ (1024 px), — после восстановления разбор будет таким же.
 * Возвращает сохранённый data URL ('' — не вышло).
 */
export async function writeDraftPhoto(src) {
  if (IS_DEMO) return '';
  if (!src) { await deletePhoto(DRAFT_PHOTO_ID); return ''; }
  let data = src;
  try {
    if (!src.startsWith('data:')) data = await compressImage(await (await fetch(src)).blob());
  } catch (_) { return ''; }
  await putPhoto(DRAFT_PHOTO_ID, data);
  return data;
}
