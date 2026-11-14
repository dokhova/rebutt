// Онбординг: согласие с документами → о себе → цели → цикл (только для женщин).
import { LEGAL_DOCS } from '../config.js';
import { AGE_MIN, AGE_MAX, GOALS, LAST_PERIOD_OPTIONS, CYCLE_OPTIONS } from '../domain/catalog.js';
import { yearsWord } from '../domain/dates.js';
import { bodyFieldsView } from './body-fields.js';
import { noCyclePhases } from '../domain/profile.js';
import { periodSteps } from './period-steps.js';

export function onboardingView(app) {
  const s = app.state, p = s.profile, step = s.onbStep;
  const flow = app.onboardingFlow(), i = flow.indexOf(step);
  const isLast = i === flow.length - 1;
  const blocked = (step === 'consent' && !s.consent) || (step === 'about' && !(p.name.trim() && p.sex));
  const legal = (id) => ({ url: LEGAL_DOCS[id].url, open: (e) => app.openLegalDoc(id, 'onboarding', e) });

  let nextLabel = isLast ? 'Начать' : 'Дальше';
  if (step === 'consent') nextLabel = WELCOME.cta;
  if (step === 'cycle') nextLabel = 'Да, учитывать';

  return {
    step: { consent: step === 'consent', about: step === 'about', goals: step === 'goals', cycle: step === 'cycle' },
    // приветствие — без шапки; дальше вордмарк и полоса прогресса по шагам после приветствия
    showTop: step !== 'consent',
    stepLabel: 'Шаг ' + i + ' / ' + (flow.length - 1),
    progress: flow.slice(1).map((_, k) => ({ cls: 'onb-bar' + (k < i ? ' on' : '') })),
    welcome: WELCOME,
    canBack: i > 0,
    noBack: i <= 0,
    back: () => app.onboardingBack(),
    nextLabel,
    nextCls: 'btn' + (step === 'consent' ? ' welcome-btn' : '') + (blocked ? ' off' : ''),
    next: () => app.onboardingNext(true),
    skipCycle: () => app.onboardingNext(false),

    // согласие
    termsChecked: s.consent,
    termsCls: 'checkbox' + (s.consent ? ' on' : ''),
    toggleTerms: () => app.toggleConsent('terms'),
    terms: legal('terms'), privacy: legal('privacy'), healthConsent: legal('consent'),

    // о себе
    name: p.name,
    setName: (e) => app.setName(e.target.value),
    sexF: 'gseg' + (p.sex === 'f' ? ' on' : ''),
    sexM: 'gseg' + (p.sex === 'm' ? ' on' : ''),
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
      return { label: g.label, num: '0' + (k + 1), on, cls: 'ggoal' + (on ? ' on' : ''), pick: () => app.toggleGoal(g.id) };
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
    askLastPeriod: !noCyclePhases(p),
    ...periodSteps(app, 'glass')
  };
}

/** Первый экран (приветствие): заголовок в две строки, короткое описание, кнопка */
const WELCOME = {
  t1: 'Свидание', t2: 'с кишечником',
  sub: 'О кишечнике принято молчать. Мы предпочитаем его понимать.',
  cta: 'Пойти на свидание'
};
