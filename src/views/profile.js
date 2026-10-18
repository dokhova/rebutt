// «Профиль»: данные, цели, цикл, напоминания, экспорт, поддержка, документы, удаление данных.
import { APP_VERSION, SUPPORT_URL, LEGAL_DOCS } from '../config.js';
import { GOALS } from '../domain/catalog.js';
import { yearsWord, dayMonthShort, addDays } from '../domain/dates.js';
import { glow } from './shell.js';

export function profileView(app) {
  const p = app.state.profile;
  const chip = (on) => 'chip' + (on ? ' on' : '');
  const sw = (on) => 'switch' + (on ? ' on' : '');

  return {
    glowBg: glow('calm'),
    back: () => app.navigate('today', 'back'),
    initial: (p.name.trim()[0] || '·').toUpperCase(),
    displayName: p.name.trim() || 'Без имени',
    meta: [
      p.age + ' ' + yearsWord(p.age),
      p.sex === 'f' ? 'женщина' : p.sex === 'm' ? 'мужчина' : '',
      p.since ? 'с ' + dayMonthShort(p.since.slice(0, 10)) : ''
    ].filter(Boolean).join(' · '),

    name: p.name,
    setName: (e) => app.setName(e.target.value),
    age: p.age,
    ageMinus: () => app.setAge(p.age - 1),
    agePlus: () => app.setAge(p.age + 1),
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
    lastPeriod: p.lastUnknown ? 'не знаю' : dayMonthShort(addDays(app.today(), -p.lastAgo)),
    lastEarlier: () => app.setLastPeriod((p.lastUnknown ? 11 : p.lastAgo) + 1),
    lastLater: () => app.setLastPeriod((p.lastUnknown ? 11 : p.lastAgo) - 1),
    cycleLen: p.len,
    lenMinus: () => app.setCycleLength(p.len - 1),
    lenPlus: () => app.setCycleLength(p.len + 1),

    remAm: p.am, remAmSwitch: sw(p.am), toggleAm: () => app.toggleReminder('morning'),
    remPm: p.pm, remPmSwitch: sw(p.pm), togglePm: () => app.toggleReminder('evening'),

    exportReport: () => app.exportDoctorReport(),
    exportCsv: () => app.exportCsv(),

    supportUrl: SUPPORT_URL,
    supportHandle: '@' + SUPPORT_URL.split('/').pop(),
    openSupport: () => app.openSupport(),
    docs: Object.keys(LEGAL_DOCS).map((id) => ({ ...LEGAL_DOCS[id], open: () => app.openLegalDoc(id, 'profile') })),

    deleteAll: () => app.deleteAllData(),
    version: APP_VERSION
  };
}

