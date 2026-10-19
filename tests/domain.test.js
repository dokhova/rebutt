// Тесты чистой логики (без браузера): npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keyOf, parseKey, addDays, diffDays, mondayOf, yearsWord } from '../src/domain/dates.js';
import { gutScore, toneOf, symptomsOf } from '../src/domain/score.js';
import { cycleDay, cyclePhase, isPeriodDay } from '../src/domain/cycle.js';
import { blankProfile, onboardingFlow } from '../src/domain/profile.js';
import { buildAiContext } from '../src/domain/ai-context.js';

const day = (gut, meals = [], period = false) => ({ gut, meals, period });
const g = (type, sym = []) => ({ id: String(Math.random()), time: '09:00', type, sym });

test('даты: ключи, сдвиги, понедельник', () => {
  assert.equal(keyOf(parseKey('2026-10-18')), '2026-10-18');
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
  assert.equal(diffDays('2026-10-18', '2026-10-11'), 7);
  assert.equal(mondayOf('2026-10-18'), '2026-10-12'); // 18.10.2026 — воскресенье
  assert.deepEqual([1, 2, 5, 11, 21, 22].map(yearsWord), ['год', 'года', 'лет', 'лет', 'год', 'года']);
});

test('показатель: нет записей → null', () => {
  assert.equal(gutScore(day([])), null);
});

test('показатель: тип 4 без симптомов — хорошо', () => {
  const s = gutScore(day([g(4)]));
  assert.equal(s.idx, 91);
  assert.equal(toneOf(s.idx), 'calm');
});

test('показатель: симптомы снижают комфорт, «Всё хорошо» не считается', () => {
  assert.deepEqual(symptomsOf(day([g(4, ['Всё хорошо'])])), []);
  const s = gutScore(day([g(2, ['Вздутие', 'Тяжесть'])]));
  assert.equal(s.comfort, 44);
  assert.equal(s.idx, 62); // 0.35·55 + 0.3·90 + 0.35·44
  assert.equal(toneOf(s.idx), 'mild');
  assert.equal(toneOf(61), 'sens');
});

test('показатель: «стула не было»', () => {
  const s = gutScore(day([g(0)]));
  assert.equal(s.n, 0);
  assert.equal(s.had, true);
  assert.equal(s.reg, 50);
});

test('цикл: день и фаза', () => {
  const p = { ...blankProfile(), cycle: true, lastAgo: 0, len: 28 };
  assert.equal(cycleDay(p, '2026-10-18', '2026-10-18'), 1);
  assert.equal(cycleDay(p, '2026-11-15', '2026-10-18'), 1); // через 28 дней
  assert.equal(cyclePhase(3, 28)[0], 'Месячные');
  assert.equal(cyclePhase(25, 28)[0], 'Перед месячными');
  assert.equal(cycleDay({ ...p, cycle: false }, '2026-10-18', '2026-10-18'), 0);
  assert.equal(isPeriodDay(p, day([]), 2), true);
});

test('онбординг: шаги по полу', () => {
  assert.deepEqual(onboardingFlow({ sex: 'm' }), ['consent', 'about', 'goals']);
  assert.deepEqual(onboardingFlow({ sex: 'f' }), ['consent', 'about', 'goals', 'cycle']);
});

test('цикл: беременность отключает фазы, на КОК — две фазы', () => {
  const p = { ...blankProfile(), cycle: true, lastAgo: 0, len: 28 };
  assert.equal(cycleDay({ ...p, pregnant: true }, '2026-10-18', '2026-10-18'), 0);
  assert.equal(cyclePhase(3, 28, true)[0], 'Кровотечение отмены');
  assert.equal(cyclePhase(20, 28, true)[0], 'Приём таблеток');
});

test('контекст для ИИ: только дни с данными за 14 дней', () => {
  const log = { '2026-10-18': day([g(4)]), '2026-10-01': day([g(3)]), '2026-10-10': day([]) };
  const ctx = buildAiContext({ ...blankProfile(), name: 'А', sex: 'f', goals: ['stool'] }, log, '2026-10-18');
  assert.deepEqual(ctx.days.map((d) => d.date), ['2026-10-18']);
  assert.deepEqual(ctx.profile.goals, ['Наладить стул']);
});

test('блюдо: нормализация ответа ИИ и КБЖУ', async () => {
  const { normalizeMeal, mealStats } = await import('../src/domain/meal.js');
  const m = normalizeMeal({ name: 'Гречка', kcal: '410.6', protein: 15.04, fat: -3, carbs: 70, fiber: 8.25, tone: 'weird', tip: 'ok' });
  assert.equal(m.kcal, 411);
  assert.equal(m.fat, 0);
  assert.equal(m.fiber, 8.3);
  assert.equal(m.tone, 'mild');
  assert.equal(m.verdict, 'Нормально');
  assert.deepEqual(mealStats(m).map((x) => x.label), ['Белки', 'Жиры', 'Углеводы', 'Клетчатка']);
});

import { streakDays } from '../src/domain/streak.js';
import { splitSentences } from '../src/domain/text.js';

test('streakDays: дни подряд с записями; пустое сегодня не обнуляет', () => {
  const log = { '2026-10-15': day([g(4)]), '2026-10-16': day([g(3)]), '2026-10-17': day([], [{ id: 'm' }]) };
  assert.equal(streakDays(log, '2026-10-18'), 3);
  assert.equal(streakDays({ ...log, '2026-10-18': day([g(4)]) }, '2026-10-18'), 4);
  assert.equal(streakDays({ '2026-10-15': day([g(4)]) }, '2026-10-18'), 0);
  assert.equal(streakDays({}, '2026-10-18'), 0);
});

test('splitSentences: делит по знакам препинания и не теряет их', () => {
  assert.deepEqual(splitSentences('Всё спокойно. Пейте воду! Как вы? Хорошо…  Дальше'), ['Всё спокойно.', 'Пейте воду!', 'Как вы?', 'Хорошо…', 'Дальше']);
  assert.deepEqual(splitSentences(''), []);
});

// ---------- главная: клетчатка, жидкость, «Что может помочь» ----------
import { fiberOf, waterOf, hasData } from '../src/domain/score.js';
import { suggestionsFor, litres } from '../src/domain/suggestions.js';

const dw = (gut, meals = [], water = 0) => ({ gut, meals, period: false, water });

test('клетчатка и жидкость за день', () => {
  assert.equal(fiberOf(dw([])), null); // блюд нет — «—», а не 0
  assert.equal(fiberOf(dw([], [{ fiber: 5 }, { fiber: 6.4 }])), 11);
  assert.equal(waterOf(dw([], [], 1200)), 1200);
  assert.equal(hasData(dw([], [], 250)), true);
  assert.equal(litres(1200), '1,2');
  assert.equal(litres(2000), '2');
});

test('подсказки: твёрдый стул → вода, клетчатка, прогулка', () => {
  const d = dw([g(2)], [{ fiber: 4 }], 500);
  const ids = suggestionsFor(d, gutScore(d)).map((x) => x.id);
  assert.deepEqual(ids, ['water', 'fiber', 'walk']);
});

test('подсказки: не больше трёх и без повторов', () => {
  const d = dw([{ ...g(7, ['Вздутие', 'Боль']), stress: 8 }], [], 0);
  const list = suggestionsFor(d, gutScore(d));
  assert.ok(list.length <= 3);
  assert.equal(new Set(list.map((x) => x.id)).size, list.length);
});

test('подсказки: ровный день без пробелов — «можно ничего не менять»', () => {
  const d = dw([g(4)], [{ fiber: 20 }], 1800);
  assert.deepEqual(suggestionsFor(d, gutScore(d)).map((x) => x.id), ['keep']);
});

test('подсказки: тон бережный — без «надо» и «нужно»', () => {
  const d = dw([{ ...g(1, ['Боль', 'Вздутие']), stress: 9 }], [], 0);
  for (const s of suggestionsFor(d, gutScore(d))) assert.ok(!/(^|[^а-яё])(надо|нужно|должн)/i.test(s.title + ' ' + s.text), s.title);
});
