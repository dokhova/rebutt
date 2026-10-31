// Telegram SDK существует и в браузере: одного window.Telegram недостаточно.
export function getTelegram() {
  const app = globalThis.Telegram?.WebApp;
  return app && (app.initData || (app.platform && app.platform !== 'unknown')) ? app : null;
}

export function isTelegram() { return !!getTelegram(); }

export function initTelegram() {
  const app = getTelegram();
  if (!app) return;
  app.ready();
  app.expand();
  if (app.isVersionAtLeast('7.7')) app.disableVerticalSwipes();
  // На телефоне — на весь экран (Bot API 8.0). Кнопки Telegram «Закрыть» и «⋯» остаются поверх сверху,
  // отступ под них — --safe-top (tokens.css, переменные --tg-*-safe-area-inset-* ставит сам Telegram).
  // На компьютере полный экран неудобен — там обычное окно.
  if (app.isVersionAtLeast('8.0') && typeof app.requestFullscreen === 'function' && /^(ios|android)/.test(app.platform || '')) {
    try { app.requestFullscreen(); } catch (_) { /* клиент не поддерживает — остаёмся в обычном режиме */ }
  }
  if (app.isVersionAtLeast('6.1')) {
    app.setHeaderColor(app.isVersionAtLeast('6.9') ? '#2F2442' : 'bg_color'); // верх фона (--bg-top)
    app.setBackgroundColor('#0F0C14'); // низ фона (--bg) — под меню и при перетягивании
  }
}

/** Лёгкий «щелчок» при выборе (шаг ползунка). Вне Telegram и на старых клиентах — ничего. */
export function hapticSelection() {
  const app = getTelegram();
  if (app && app.isVersionAtLeast('6.1') && app.HapticFeedback) app.HapticFeedback.selectionChanged();
}

/** В браузере сохраняем стандартное поведение ссылки, включая модификаторы клика. */
export function openTelegramLink(url, event, support = false) {
  const app = getTelegram();
  if (!app || !app.isVersionAtLeast('6.1')) return;
  const absoluteUrl = new URL(url, location.href).href;
  if (support) app.openTelegramLink(absoluteUrl);
  else app.openLink(absoluteUrl);
  event?.preventDefault();
}

let backHandler = null;

export function syncBackButton(visible, onBack) {
  const app = getTelegram();
  if (!app || !app.isVersionAtLeast('6.1')) return;
  if (backHandler) app.BackButton.offClick(backHandler);
  backHandler = visible ? onBack : null;
  if (backHandler) {
    app.BackButton.onClick(backHandler);
    app.BackButton.show();
  } else app.BackButton.hide();
}

/** Только разрешённые свойства: Telegram id, имя и username не передаём. */
export function telegramAnalyticsProps() {
  const app = getTelegram();
  const user = app?.initDataUnsafe?.user;
  return {
    platform: app ? 'telegram' : 'web',
    ...(user ? { tg_language: user.language_code || '', tg_is_premium: !!user.is_premium } : {})
  };
}

/** Подписанные данные запуска — отправляем на сервер для входа и запросов к ИИ */
export function telegramInitData() {
  const app = getTelegram();
  return (app && app.initData) || '';
}

/** Пользователь Telegram: { id, first_name, photo_url, … } или null */
export function telegramUser() {
  const app = getTelegram();
  return (app && app.initDataUnsafe && app.initDataUnsafe.user) || null;
}

// ---------- «На главный экран» (Bot API 8.0) ----------

/** 'ios' | 'android' — только на телефоне ярлык имеет смысл; иначе '' */
export function homeScreenPlatform() {
  const p = (getTelegram() || {}).platform || '';
  return p === 'ios' ? 'ios' : p.startsWith('android') ? 'android' : '';
}

/** Android: в Telegram по платформе мини-аппа, в браузере — по user agent. Камеру из мини-аппа на Android не вызвать — только выбор файла. */
export function isAndroid() {
  const p = (getTelegram() || {}).platform || '';
  if (p) return p.startsWith('android');
  return typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent || '');
}

export function canAddToHomeScreen() {
  const app = getTelegram();
  return !!(app && homeScreenPlatform() && app.isVersionAtLeast('8.0') &&
    typeof app.addToHomeScreen === 'function' && typeof app.checkHomeScreenStatus === 'function');
}

/** 'added' | 'missed' | 'unknown' | 'unsupported'. Не ждём ответа дольше 3 с. */
export function checkHomeScreenStatus() {
  return new Promise((resolve) => {
    if (!canAddToHomeScreen()) { resolve('unsupported'); return; }
    let done = false;
    const finish = (status) => { if (!done) { done = true; clearTimeout(timer); resolve(status || 'unknown'); } };
    const timer = setTimeout(() => finish('unknown'), 3000);
    try { getTelegram().checkHomeScreenStatus(finish); } catch (_) { finish('unsupported'); }
  });
}

/** Android добавляет ярлык сразу, iOS показывает подтверждение Telegram. false — не поддерживается. */
export function addToHomeScreen() {
  if (!canAddToHomeScreen()) return false;
  getTelegram().addToHomeScreen();
  return true;
}

/** Telegram сообщает, что ярлык добавлен */
export function onHomeScreenAdded(callback) {
  const app = getTelegram();
  if (app && typeof app.onEvent === 'function') app.onEvent('homeScreenAdded', callback);
}
