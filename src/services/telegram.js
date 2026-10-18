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
  if (app.isVersionAtLeast('6.1')) {
    app.setHeaderColor(app.isVersionAtLeast('6.9') ? '#141318' : 'bg_color');
    app.setBackgroundColor('#141318');
  }
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
