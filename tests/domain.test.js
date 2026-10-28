// Тесты чистой логики (без браузера): npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keyOf, parseKey, addDays, diffDays, mondayOf, yearsWord } from '../src/domain/dates.js';
import { gutScore, toneOf, symptomsOf } from '../src/domain/score.js';
import { cycleDay, cyclePhase, cycleHint, isPeriodDay } from '../src/domain/cycle.js';
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

test('контекст для ИИ: подробно — дни с данными за 30 дней, в сводке — всё время', () => {
  const log = { '2026-10-18': day([g(4)]), '2026-10-01': day([g(3)]), '2026-09-01': day([g(2, ['Вздутие'])]), '2026-10-10': day([]) };
  const ctx = buildAiContext({ ...blankProfile(), name: 'А', sex: 'f', goals: ['stool'] }, log, '2026-10-18');
  assert.deepEqual(ctx.days.map((d) => d.date), ['2026-10-01', '2026-10-18']);
  assert.deepEqual(ctx.profile.goals, ['Наладить стул']);
  assert.equal(ctx.summary.days_logged, 3);
  assert.deepEqual(ctx.summary.bristol_type_counts, { 2: 1, 3: 1, 4: 1 });
  assert.deepEqual(ctx.summary.symptom_days, { 'Вздутие': 1 });
  assert.equal(ctx.profile.name, undefined); // имя ИИ не нужно
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

import { splitSentences } from '../src/domain/text.js';

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


// ---------- рост, вес, личные ориентиры, контекст ИИ ----------
import { dailyTargets } from '../src/domain/targets.js';
import { parseBodyInput, validHeight, validWeight, profileTraits } from '../src/domain/profile.js';
import { foodContext, aiContextHash } from '../src/domain/ai-context.js';

test('рост и вес: ввод только цифрами, диапазон проверяется отдельно', () => {
  assert.equal(parseBodyInput('172 см'), 172);
  assert.equal(parseBodyInput('62,5'), 625); // запятую выкидываем: вес — целые кг, 625 потом не пройдёт проверку
  assert.equal(parseBodyInput(''), null);
  assert.equal(parseBodyInput('12345'), 123);
  assert.equal(validHeight(172), 172);
  assert.equal(validHeight(17), null);
  assert.equal(validWeight(62), 62);
  assert.equal(validWeight(625), null);
  const traits = profileTraits({ ...blankProfile(), height: 172, weight: 62 });
  assert.equal(traits.has_height, true);
  assert.equal(traits.has_weight, true);
  assert.equal(traits.weight, undefined); // сам вес в аналитику не уходит
});

test('нормы: клетчатка по ВОЗ, вода по EFSA; вес и рост на нормы не влияют', () => {
  assert.deepEqual(dailyTargets(blankProfile()), { waterMl: 2000, fiberG: 25 });
  assert.deepEqual(dailyTargets({ ...blankProfile(), sex: 'f', weight: 90, height: 190 }), { waterMl: 2000, fiberG: 25 });
  assert.deepEqual(dailyTargets({ ...blankProfile(), sex: 'm', age: 60 }), { waterMl: 2500, fiberG: 25 });
  assert.equal(dailyTargets({ ...blankProfile(), sex: 'f', pregnant: true }).waterMl, 2300);
  assert.equal(dailyTargets({ ...blankProfile(), sex: 'm', pregnant: true }).waterMl, 2500);
});

test('у каждой карточки «?» есть источник со ссылкой', async () => {
  const { SOURCES, infoCards } = await import('../src/domain/sources.js');
  const cards = infoCards(dailyTargets(blankProfile()));
  for (const topic of ['fiber', 'water', 'targets', 'bristol', 'tips']) {
    assert.ok(cards[topic] && cards[topic].length, topic);
    for (const c of cards[topic]) {
      assert.ok(c.title && c.text && c.sources.length, topic);
      for (const id of c.sources) assert.match(SOURCES[id].url, /^https:\/\//, id);
    }
  }
});

test('подсказки: без советов, у которых нет доказательной базы', () => {
  const days = [dw([g(1, ['Боль', 'Вздутие'])], [], 0), dw([g(7, ['Газы', 'Тяжесть'])], [{ fiber: 2 }], 300), dw([{ ...g(0), stress: 9 }], [], 0)];
  for (const d of days) {
    for (const goals of [[], ['stool', 'bloat', 'food', 'weight']]) {
      for (const s of suggestionsFor(d, gutScore(d), { goals })) {
        assert.ok(!/детокс|чистк|голода|бад|пробиот|клизм|трав|банан|тёпл/i.test(s.title + ' ' + s.text), s.title + ' — ' + s.text);
      }
    }
  }
});

test('подсказки учитывают личный ориентир воды', () => {
  const d = dw([g(4)], [{ fiber: 20 }], 1500);
  assert.deepEqual(suggestionsFor(d, gutScore(d), { targets: { waterMl: 1600, fiberG: 25 } }).map((x) => x.id), ['keep']);
  assert.deepEqual(suggestionsFor(d, gutScore(d), { targets: { waterMl: 3500, fiberG: 25 } }).map((x) => x.id), ['water']);
});

test('подсказки учитывают цели: «реакция на еду» без блюд — сфотографировать еду', () => {
  const d = dw([g(4)], [], 1800);
  assert.ok(suggestionsFor(d, gutScore(d), { goals: ['food'] }).some((x) => x.id === 'photo'));
  assert.ok(!suggestionsFor(d, gutScore(d), {}).some((x) => x.id === 'photo'));
});

test('подсказки: цель «Похудеть» не добавляет советов про калории', () => {
  const d = dw([g(4)], [{ fiber: 20 }], 1800);
  for (const s of suggestionsFor(d, gutScore(d), { goals: ['weight'] })) assert.ok(!/калори|похуд|вес/i.test(s.title + ' ' + s.text), s.title);
});

test('контекст ИИ: рост, вес, цели, свои слова и ориентиры', () => {
  const p = { ...blankProfile(), sex: 'f', age: 31, height: 168, weight: 60, goals: ['bloat', 'other'], other: 'понять, что с кофе' };
  const ctx = buildAiContext(p, { '2026-10-18': { ...day([g(4)], [{ id: 'm', time: '09:00', name: 'Овсянка', kcal: 300, fiber: 8 }]), water: 750 } }, '2026-10-18');
  assert.equal(ctx.profile.height_cm, 168);
  assert.equal(ctx.profile.weight_kg, 60);
  assert.deepEqual(ctx.profile.goals, ['Избавиться от вздутия', 'Другое', 'понять, что с кофе']);
  assert.equal(ctx.profile.own_goal, 'понять, что с кофе');
  assert.deepEqual(ctx.profile.daily_targets, { water_ml: 2000, fiber_g: 25 });
  assert.equal(ctx.days[0].water_ml, 750);
  assert.equal(ctx.days[0].fiber_g, 8);
  const fc = foodContext(p, { '2026-10-18': { ...day([], [{ id: 'm', time: '09:00', name: 'Овсянка', fiber: 8 }]), water: 750 } }, '2026-10-18');
  assert.deepEqual(fc.today_so_far, { fiber_g: 8, water_ml: 750, meals: ['Овсянка'], symptoms: [] });
});

test('кэш инсайтов сбрасывается, когда меняется профиль', () => {
  const log = { '2026-10-18': day([g(4)]) };
  const a = aiContextHash(buildAiContext({ ...blankProfile(), weight: 60 }, log, '2026-10-18'));
  const b = aiContextHash(buildAiContext({ ...blankProfile(), weight: 80 }, log, '2026-10-18'));
  assert.notEqual(a, b);
});

test('цикл на «Сегодня» — только в окна месячных и овуляции', () => {
  assert.equal(cycleHint(3, 28, false, true)[0], 'Месячные');
  assert.equal(cycleHint(14, 28)[0], 'Овуляция');
  assert.equal(cycleHint(27, 28)[0], 'Скоро месячные');
  assert.equal(cycleHint(8, 28), null);
  assert.equal(cycleHint(20, 28), null);
  assert.equal(cycleHint(14, 28, true), null); // КОК — только кровотечение отмены
  assert.equal(cycleHint(0, 28), null);
});
