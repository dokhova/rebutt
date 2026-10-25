/** Уменьшает фото до max px по длинной стороне и возвращает JPEG data URL (для отправки в ИИ) */
export function compressImage(file, max = 1024, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * k);
      canvas.height = Math.round(img.height * k);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image_decode_failed')); };
    img.src = url;
  });
}

/** Размер фото блюда для хранения (IndexedDB, Supabase Storage): хватает и для карточки, и для миниатюры */
export const STORED_PHOTO_PX = 720;

/** Любой источник (blob:, data:, https:) → уменьшенный JPEG data URL для хранения */
export async function photoForStorage(src) {
  const blob = await (await fetch(src)).blob();
  return compressImage(blob, STORED_PHOTO_PX, 0.78);
}
