// Картинки, которые должны появляться вместе с экраном, а не догружаться после перехода:
// фон «Комфорт за 7 дней» на главной и фото первого экрана онбординга. Грузим и декодируем при старте (сначала текущую тему) и держим ссылки —
// иначе WebView в Telegram выкидывает декодированную картинку, и при возврате на главную она «прыгает».
import gutLight from '../assets/hero/gut.webp';
import gutDark from '../assets/hero/gut-dark.webp';

const keep = [];

/** onboarding — профиля на устройстве нет: первым грузим фото первого экрана */
export function preloadImages(theme, onboarding = false) {
  if (typeof Image === 'undefined') return;
  const order = theme === 'dark' ? [gutDark, gutLight] : [gutLight, gutDark];
  if (onboarding) order.unshift('/brand/welcome-cover.webp');
  order.forEach((src, i) => {
    const img = new Image();
    img.decoding = 'async';
    if (i === 0) img.fetchPriority = 'high';
    img.src = src;
    if (img.decode) img.decode().catch(() => { /* не страшно: покажется по мере загрузки */ });
    keep.push(img);
  });
}
