// Профиль пользователя (онбординг + настройки).
import { GOALS } from './catalog.js';

/**
 * Profile:
 *   name, age, sex ('f' | 'm' | ''), goals: string[] (id из GOALS), other — своя цель
 *   cycle — учитывать цикл, lastUnknown — дата начала неизвестна,
 *   lastAgo — дней назад начались месячные, len — длина цикла
 *   am / pm — напоминания утром / вечером
 *   onboardedAt — ISO-время завершения онбординга (null — ещё не прошёл)
 *   since — 'YYYY-MM-DD', дата начала использования
 */
export const blankProfile = () => ({
  name: '', age: 28, sex: '', goals: [], other: '',
  cycle: false, lastUnknown: false, lastAgo: 11, len: 28,
  am: true, pm: false, onboardedAt: null, since: ''
});

export const goalLabels = (profile) =>
  profile.goals
    .map((id) => (GOALS.find((g) => g.id === id) || {}).label)
    .filter(Boolean)
    .concat(profile.other ? [profile.other] : []);

/** Свойства персоны для аналитики (без имени) */
export const profileTraits = (p) => ({
  sex: p.sex || null,
  age: p.age,
  goals: p.goals,
  goals_count: p.goals.length,
  has_custom_goal: !!p.other,
  cycle_enabled: !!p.cycle,
  reminder_am: !!p.am,
  reminder_pm: !!p.pm,
  onboarded_at: p.onboardedAt
});

/** Онбординг: шаги зависят от пола и от того, нажали ли «Пропустить» */
export function onboardingFlow(profile, skipped) {
  if (skipped) return ['consent'];
  return profile.sex === 'm' ? ['consent', 'about', 'goals'] : ['consent', 'about', 'goals', 'cycle'];
}
