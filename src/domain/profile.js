// Профиль пользователя (онбординг + настройки).
import { GOALS } from './catalog.js';

/**
 * Profile:
 *   name, age, sex ('f' | 'm' | ''), goals: string[] (id из GOALS), other — своя цель
 *   cycle — учитывать цикл, lastUnknown — дата начала неизвестна,
 *   lastAgo — дней назад начались месячные, len — длина цикла
 *   pregnant — беременность (фазы цикла не считаются), coc — приём КОК (фазы сглажены)
 *   am / pm — напоминания утром / вечером
 *   onboardedAt — ISO-время завершения онбординга (null — ещё не прошёл)
 *   since — 'YYYY-MM-DD', дата начала использования
 */
export const blankProfile = () => ({
  name: '', age: 28, sex: '', goals: [], other: '',
  cycle: false, lastUnknown: false, lastAgo: 11, len: 28, pregnant: false, coc: false,
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
