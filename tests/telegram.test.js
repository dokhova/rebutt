import test from 'node:test';
import assert from 'node:assert/strict';
import { initTelegram, isTelegram, telegramAnalyticsProps, openTelegramLink, syncBackButton } from '../src/services/telegram.js';

test('Telegram integration keeps browser behavior and restricts user properties', () => {
  const calls = [];
  const original = globalThis.Telegram;
  const originalLocation = globalThis.location;
  try {
    globalThis.Telegram = { WebApp: { platform: 'unknown', initData: '' } };
    assert.equal(isTelegram(), false);
    initTelegram();
    openTelegramLink('/legal/terms.html', { preventDefault: () => calls.push('prevent') });
    assert.deepEqual(calls, []);
    assert.deepEqual(telegramAnalyticsProps(), { platform: 'web' });

    const app = {
      platform: 'android', initData: 'signed-data',
      initDataUnsafe: { user: { id: 123, username: 'private', language_code: 'ru', is_premium: true } },
      isVersionAtLeast: () => true,
      BackButton: Object.fromEntries(['onClick', 'offClick', 'show', 'hide'].map((key) => [key, (...args) => calls.push([key, ...args])]))
    };
    for (const key of ['ready', 'expand', 'disableVerticalSwipes', 'setHeaderColor', 'setBackgroundColor', 'openLink', 'openTelegramLink']) {
      app[key] = (...args) => calls.push([key, ...args]);
    }
    globalThis.Telegram.WebApp = app;
    globalThis.location = { href: 'https://rebutt.example/' };
    initTelegram();
    assert.deepEqual(calls.splice(0), [['ready'], ['expand'], ['disableVerticalSwipes'], ['setHeaderColor', '#2F2442'], ['setBackgroundColor', '#0F0C14']]);
    assert.deepEqual(telegramAnalyticsProps(), { platform: 'telegram', tg_language: 'ru', tg_is_premium: true });
    const event = { preventDefault: () => calls.push('prevent') };
    openTelegramLink('/legal/terms.html', event);
    openTelegramLink('https://t.me/support', event, true);
    assert.deepEqual(calls.splice(0), [['openLink', 'https://rebutt.example/legal/terms.html'], 'prevent', ['openTelegramLink', 'https://t.me/support'], 'prevent']);
    const back = () => {};
    syncBackButton(true, back);
    syncBackButton(false, back);
    assert.deepEqual(calls.splice(0), [['onClick', back], ['show'], ['offClick', back], ['hide']]);
    app.isVersionAtLeast = () => false;
    initTelegram();
    assert.deepEqual(calls, [['ready'], ['expand']]);
  } finally {
    if (original === undefined) delete globalThis.Telegram;
    else globalThis.Telegram = original;
    if (originalLocation === undefined) delete globalThis.location;
    else globalThis.location = originalLocation;
  }
});
