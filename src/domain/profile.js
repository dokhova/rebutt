// Профиль пользователя (онбординг + настройки).
import { GOALS, HEIGHT_MIN, HEIGHT_MAX, WEIGHT_MIN, WEIGHT_MAX } from './catalog.js';

/**
 * Profile:
 *   name, age, sex ('f' | 'm' | ''), goals: string[] (id из GOALS), other — своя цель
 *   height — рост, см; weight — вес, кг (по желанию, целые числа или null)
 *   cycle — учитывать цикл, lastUnknown — дата начала неизвестна,
 *   lastAgo — дней назад начались месячные, len — длина цикла
 *   pregnant — беременность (фазы цикла не считаются), coc — приём КОК (фазы сглажены)
 *   am / pm — напоминания утром / вечером
 *   onboardedAt — ISO-время завершения онбординга (null — ещё не прошёл)
 *   since — 'YYYY-MM-DD', дата начала использования
 */
export const blankProfile = () => ({
  name: '', age: 28, sex: '', height: null, weight: null, goals: [], other: '',
  cycle: false, lastUnknown: false, lastAgo: 11, len: 28, pregnant: false, coc: false,
  am: true, pm: false, onboardedAt: null, since: ''
});

export const goalLabels = (profile) =>
  profile.goals
    .map((id) => (GOALS.find((g) => g.id === id) || {}).label)
    .filter(Boolean)
    .concat(profile.other ? [profile.other] : []);

/** Рост и вес, если они в разумном диапазоне; иначе null */
export const validHeight = (n) => (Number.isInteger(n) && n >= HEIGHT_MIN && n <= HEIGHT_MAX ? n : null);
export const validWeight = (n) => (Number.isInteger(n) && n >= WEIGHT_MIN && n <= WEIGHT_MAX ? n : null);

/** Ввод роста/веса: только цифры, до 3 знаков → число или null (диапазон проверяется при использовании) */
export const parseBodyInput = (raw) => {
  const digits = String(raw || '').replace(/\D/g, '').slice(0, 3);
  return digits ? Number(digits) : null;
};

/** Свойства персоны для аналитики (без имени). Рост и вес не передаём — только факт, что указаны. */
export const profileTraits = (p) => ({
  sex: p.sex || null,
  age: p.age,
  has_height: validHeight(p.height) != null,
  has_weight: validWeight(p.weight) != null,
  goals: p.goals,
  goals_count: p.goals.length,
  has_custom_goal: !!p.other,
  cycle_enabled: !!p.cycle,
  pregnant: !!p.pregnant,
  coc: !!p.coc,
  reminder_am: !!p.am,
  reminder_pm: !!p.pm,
  onboarded_at: p.onboardedAt
});

/** Онбординг: согласие → о себе → цели → цикл (только для женщин) */
export function onboardingFlow(profile) {
  return profile.sex === 'm' ? ['consent', 'about', 'goals'] : ['consent', 'about', 'goals', 'cycle'];
}
