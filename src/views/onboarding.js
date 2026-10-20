// Онбординг: согласие с документами → о себе → цели → цикл (только для женщин).
import { LEGAL_DOCS } from '../config.js';
import { AGE_MIN, AGE_MAX, GOALS, LAST_PERIOD_OPTIONS, CYCLE_OPTIONS } from '../domain/catalog.js';
import { yearsWord } from '../domain/dates.js';
import { bodyFieldsView } from './body-fields.js';

export function onboardingView(app) {
  const s = app.state, p = s.profile, step = s.onbStep;
  const flow = app.onboardingFlow(), i = flow.indexOf(step);
  const isLast = i === flow.length - 1;
  const blocked = (step === 'consent' && !s.consent) || (step === 'about' && !(p.name.trim() && p.sex));
  const legal = (id) => ({ url: LEGAL_DOCS[id].url, open: (e) => app.openLegalDoc(id, 'onboarding', e) });

  let nextLabel = isLast ? 'Начать' : 'Дальше';
  if (step === 'consent' && !isLast) nextLabel = 'Продолжить';
  if (step === 'cycle') nextLabel = 'Да, учитывать';

  return {
    step: { consent: step === 'consent', about: step === 'about', goals: step === 'goals', cycle: step === 'cycle' },
    stepLabel: 'Шаг ' + (i + 1) + ' / ' + flow.length,
    canBack: i > 0,
    noBack: i <= 0,
    back: () => app.onboardingBack(),
    nextLabel,
    nextCls: 'btn' + (blocked ? ' off' : ''),
    next: () => app.onboardingNext(true),
    skipCycle: () => app.onboardingNext(false),

    // согласие
    consentChecked: s.consent,
    consentCls: 'checkbox' + (s.consent ? ' on' : ''),
    toggleConsent: () => app.toggleConsent(),
    terms: legal('terms'), privacy: legal('privacy'), healthConsent: legal('consent'),

    // о себе
    name: p.name,
    setName: (e) => app.setName(e.target.value),
    sexF: 'seg' + (p.sex === 'f' ? ' on' : ''),
    sexM: 'seg' + (p.sex === 'm' ? ' on' : ''),
    pickF: () => app.setSex('f'),
    pickM: () => app.setSex('m'),
    ageLabel: p.age + ' ' + yearsWord(p.age),
    ages: Array.from({ length: AGE_MAX - AGE_MIN + 1 }, (_, k) => {
      const n = AGE_MIN + k;
      return { n, on: n === p.age, cls: 'drum-item' + (n === p.age ? ' on' : ''), pick: () => app.scrollAgeDrumTo(n) };
    }),
    setAgeDrum: app.setAgeDrum,
    ...bodyFieldsView(app),
    onAgeScroll: (e) => app.onAgeDrumScroll(e.target.scrollTop),

    // цели
    goals: GOALS.map((g, k) => {
      const on = p.goals.includes(g.id);
      return { label: g.label, num: '0' + (k + 1), on, cls: 'goal' + (on ? ' on' : ''), pick: () => app.toggleGoal(g.id) };
    }),
    otherGoal: p.goals.includes('other'),
    otherText: p.other,
    setOther: (e) => app.updateProfile({ other: e.target.value }, 'goal_other'),

    // цикл
    lastPeriodOptions: LAST_PERIOD_OPTIONS.map(([label, daysAgo]) => {
      const on = daysAgo == null ? p.lastUnknown : !p.lastUnknown && p.lastAgo === daysAgo;
      return { label, on, cls: 'chip' + (on ? ' on' : ''), pick: () => app.setLastPeriod(daysAgo) };
    }),
    cycleOptions: CYCLE_OPTIONS.map(([id, label]) => ({ label, on: !!p[id], cls: 'chip' + (p[id] ? ' on' : ''), pick: () => app.toggleCycleOption(id) })),
    askLastPeriod: !p.pregnant
  };
}
