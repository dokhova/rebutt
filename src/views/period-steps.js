// «Когда начались последние месячные» — два коротких вопроса без дат: «Месячные идут сейчас?» → какой день / когда начались.
// Один и тот же блок в онбординге (на цветном блоке, look = 'glass') и в профиле (look = 'plain').
/** Шаг «Цикл»: два коротких вопроса на одном экране — «Месячные идут сейчас?», затем день или когда начались */
const NOW_DAYS = [1, 2, 3, 4, 5, 6, 7];
const AGO_OPTIONS = [['1–2 недели назад', 10], ['2–3 недели назад', 17], ['3–4 недели назад', 24], ['Больше месяца', 35], ['Не помню', null]];

export function periodSteps(app, look = 'plain') {
  const s = app.state, p = s.profile, now = s.onbPeriodNow, picked = s.onbPeriodPicked;
  const glass = look === 'glass';
  const chip = (on) => (glass ? 'gchip' : 'chip') + (on ? ' on' : '');
  const seg = (on) => (glass ? 'gseg' : 'seg') + (on ? ' on' : '');
  return {
    psSegsCls: glass ? 'gsegs' : 'segments',
    nowYes: seg(now === 'yes'),
    nowNo: seg(now === 'no'),
    pickNowYes: () => app.setPeriodNow('yes'),
    pickNowNo: () => app.setPeriodNow('no'),
    askDay: now === 'yes',
    askAgo: now === 'no',
    nowDays: NOW_DAYS.map((d) => {
      const on = picked && !p.lastUnknown && p.lastAgo === d - 1;
      return { label: d === 7 ? '7+' : d + '-й', on, cls: chip(on), pick: () => app.pickPeriodStart(d - 1) };
    }),
    agoOptions: AGO_OPTIONS.map(([label, ago]) => {
      const on = picked && (ago == null ? p.lastUnknown : !p.lastUnknown && p.lastAgo === ago);
      return { label, on, cls: chip(on), pick: () => app.pickPeriodStart(ago, true) };
    }),
    periodHint: now === 'no' ? 'Можно примерно — уточнится, когда отметите месячные' : ''
  };
}
