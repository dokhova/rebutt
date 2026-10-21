import test from 'node:test';
import assert from 'node:assert/strict';
import { homePromptSnoozed } from '../src/domain/home-prompt.js';
import { homeScreenPlatform, canAddToHomeScreen, checkHomeScreenStatus, addToHomeScreen } from '../src/services/telegram.js';

const DAY = 864e5;

test('модалка «На главный экран»: когда спросить снова', () => {
  const now = 100 * DAY;
  assert.equal(homePromptSnoozed(null, now), false);
  assert.equal(homePromptSnoozed({ state: 'added', at: 0 }, now), true);
  assert.equal(homePromptSnoozed({ state: 'later', at: now - 2 * DAY }, now), true);
  assert.equal(homePromptSnoozed({ state: 'later', at: now - 4 * DAY }, now), false);
  assert.equal(homePromptSnoozed({ state: 'close', at: now - 10 * DAY }, now), true);
  assert.equal(homePromptSnoozed({ state: 'close', at: now - 15 * DAY }, now), false);
  assert.equal(homePromptSnoozed({ state: 'чужое', at: now }, now), false);
});

test('Telegram: ярлык только на телефоне и в Bot API 8.0+', async () => {
  const original = globalThis.Telegram;
  const calls = [];
  try {
    const app = {
      platform: 'tdesktop', initData: 'signed',
      isVersionAtLeast: (v) => v !== '8.0' || app.v8,
      v8: true,
      addToHomeScreen: () => calls.push('add'),
      checkHomeScreenStatus: (cb) => cb('missed')
    };
    globalThis.Telegram = { WebApp: app };

    assert.equal(homeScreenPlatform(), '');
    assert.equal(canAddToHomeScreen(), false);
    assert.equal(await checkHomeScreenStatus(), 'unsupported');
    assert.equal(addToHomeScreen(), false);

    app.platform = 'android_x';
    assert.equal(homeScreenPlatform(), 'android');
    app.platform = 'ios';
    assert.equal(homeScreenPlatform(), 'ios');
    assert.equal(canAddToHomeScreen(), true);
    assert.equal(await checkHomeScreenStatus(), 'missed');
    assert.equal(addToHomeScreen(), true);
    assert.deepEqual(calls, ['add']);

    app.v8 = false;
    assert.equal(canAddToHomeScreen(), false);
  } finally {
    globalThis.Telegram = original;
  }
});
