// Проверка подписи Telegram initData (api/_lib/telegram.js)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { verifyInitData } from '../api/_lib/telegram.js';

const BOT = '123456:TEST-token';

function sign(fields, token = BOT) {
  const dcs = Object.entries(fields).map(([k, v]) => k + '=' + v).sort().join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(token).digest();
  const hash = crypto.createHmac('sha256', secret).update(dcs).digest('hex');
  return new URLSearchParams({ ...fields, hash }).toString();
}

const now = Date.now();
const fields = { auth_date: String(Math.floor(now / 1000)), query_id: 'AA1', user: JSON.stringify({ id: 42, first_name: 'Алиса' }) };

test('верная подпись → пользователь', () => {
  assert.equal(verifyInitData(sign(fields), BOT, now).id, 42);
});

test('чужой бот или подделка → null', () => {
  assert.equal(verifyInitData(sign(fields, '999:other'), BOT, now), null);
  assert.equal(verifyInitData(sign(fields).replace('42', '43'), BOT, now), null);
  assert.equal(verifyInitData('', BOT, now), null);
});

test('старше суток → null', () => {
  assert.equal(verifyInitData(sign(fields), BOT, now + 2 * 864e5), null);
});
