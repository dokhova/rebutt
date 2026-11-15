// «Профиль»: четыре группы — о себе (данные и цели), цикл, приложение (напоминания, ярлык), данные и помощь.
import { APP_VERSION, SUPPORT_URL, LEGAL_DOCS } from '../config.js';
import { GOALS, CYCLE_OPTIONS } from '../domain/catalog.js';
import { yearsWord, dayMonthShort, addDays } from '../domain/dates.js';
import { cycleDay } from '../domain/cycle.js';
import { homeScreenPlatform } from '../services/telegram.js';
import { periodSteps } from './period-steps.js';
import { IS_DEMO } from '../config.js';
import { bodyFieldsView } from './body-fields.js';
import { noCyclePhases } from '../domain/profile.js';

export function profileView(app) {
  const p = app.state.profile;
  const chip = (on) => 'chip' + (on ? ' on' : '');
  const sw = (on) => 'switch' + (on ? ' on' : '');

  return {
    back: () => app.navigate('today', 'back'),
    initial: (p.name.trim()[0] || '·').toUpperCase(),
    avatarUrl: app.state.avatarUrl,
    noAvatar: !app.state.avatarUrl,
    displayName: p.name.trim() || 'Без имени',
    meta: [
      p.age + ' ' + yearsWord(p.age),
      p.sex === 'f' ? 'женщина' : p.sex === 'm' ? 'мужчина' : ''
    ].filter(Boolean).join(' · '),

    name: p.name,
    setName: (e) => app.setName(e.target.value),
    age: p.age,
    ageMinus: () => app.setAge(p.age - 1),
    agePlus: () => app.setAge(p.age + 1),
    ...bodyFieldsView(app),
    sexF: chip(p.sex === 'f'),
    sexM: chip(p.sex === 'm'),
    pickF: () => app.setSex('f'),
    pickM: () => app.setSex('m'),

    goals: GOALS.map((g) => {
      const on = p.goals.includes(g.id);
      return { label: g.short, on, cls: chip(on), pick: () => app.toggleGoal(g.id) };
    }),

    isFemale: p.sex === 'f',
    cycleOn: p.cycle,
    cycleSwitch: sw(p.cycle),
    toggleCycle: () => app.toggleCycle(),
    cycleOptions: CYCLE_OPTIONS.map(([id, label]) => ({ label, on: !!p[id], cls: chip(p[id]), toggle: () => app.toggleCycleOption(id) })),
    // свёрнуто — одна строка «День цикла»; по нажатию — короткие вопросы, длина цикла и особые случаи
    cycleSummary: noCyclePhases(p) ? (p.pregnant ? 'беременность' : 'менопауза') : null,
    showCycleDates: p.cycle && !noCyclePhases(p),
    // день цикла сегодня: «−» / «+» двигают начало месячных; не знаем дату — начинаем с 1-го дня
    ...cycleDayView(app, p),
    cycleCalOpen: app.state.cycleCal,
    toggleCycleCal: () => app.toggleCycleCalendar(),
    cycleCalChevron: 'row-chevron cal-chevron' + (app.state.cycleCal ? ' open' : ''),
    ...periodSteps(app),
    cycleLen: p.len,
    lenMinus: () => app.setCycleLength(p.len - 1),
    lenPlus: () => app.setCycleLength(p.len + 1),

    // ярлык на экран «Домой»: в Telegram на телефоне (в демо — чтобы было видно на показах)
    showHomeScreen: !!homeScreenPlatform() || IS_DEMO,
    addHomeScreen: () => app.addToHomeFromProfile(),

    remAm: p.am, remAmSwitch: sw(p.am), toggleAm: () => app.toggleReminder('morning'),
    remPm: p.pm, remPmSwitch: sw(p.pm), togglePm: () => app.toggleReminder('evening'),

    exportReport: () => app.exportDoctorReport(),
    exportCsv: () => app.exportCsv(),

    supportUrl: SUPPORT_URL,
    supportHandle: '@' + SUPPORT_URL.split('/').pop(),
    openSupport: (e) => app.openSupport(e),
    docsOpen: app.state.docsOpen,
    toggleDocs: () => app.toggleDocs(),
    docsChevron: 'row-chevron cal-chevron' + (app.state.docsOpen ? ' open' : ''),
    docs: Object.keys(LEGAL_DOCS).map((id) => ({ ...LEGAL_DOCS[id], open: (e) => app.openLegalDoc(id, 'profile', e) })),

    deleteAll: () => app.deleteAllData(),
    version: APP_VERSION
  };
}


function cycleDayView(app, p) {
  const todayK = app.today();
  const cd = cycleDay(p, todayK, todayK);
  const start = cd ? addDays(todayK, -(cd - 1)) : '';
  return {
    cycleDayValue: cd ? cd + '-й день' : 'не указан',
    cycleStartLabel: cd ? 'Начались ' + dayMonthShort(start) : 'Укажите начало месячных',
  };
}
