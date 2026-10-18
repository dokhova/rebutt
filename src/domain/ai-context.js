// Сводка для ИИ: профиль и записи за последние 14 дней. Отправляется в /api/ask и /api/insights.
import { BRISTOL_TYPES, STOOL_COLORS } from './catalog.js';

const colorLabel = (id) => (STOOL_COLORS.find((c) => c.id === id) || {}).label || id;
import { addDays } from './dates.js';
import { gutScore, symptomsOf, emptyDay } from './score.js';
import { cycleDay, cyclePhase } from './cycle.js';
import { goalLabels } from './profile.js';

const DAYS = 14;

export function buildAiContext(profile, log, todayK) {
  const days = [];
  for (let i = DAYS - 1; i >= 0; i--) {
    const k = addDays(todayK, -i);
    const r = { ...emptyDay(), ...(log[k] || {}) };
    if (!r.gut.length && !r.meals.length && !r.period) continue;
    const sc = gutScore(r);
    days.push({
      date: k,
      stool: r.gut.filter((g) => g.type > 0).map((g) => g.time + ' тип ' + g.type + ' (' + BRISTOL_TYPES[g.type] + ')' + (g.color ? ', цвет: ' + colorLabel(g.color) : '')),
      stress: r.gut.filter((g) => g.stress != null).map((g) => g.stress + '/10'),
      no_stool_marked: r.gut.some((g) => g.type === 0),
      symptoms: symptomsOf(r),
      meals: r.meals.map((m) => m.time + ' ' + m.name + ': ' + m.kcal + ' ккал, Б ' + (m.protein || 0) + ' г, Ж ' + (m.fat || 0) + ' г, У ' + (m.carbs || 0) + ' г, клетчатка ' + m.fiber + ' г' + (m.note ? ' (' + m.note + ')' : '')),
      period: !!r.period,
      gut_score: sc ? sc.idx : null
    });
  }
  const cd = cycleDay(profile, todayK, todayK);
  return {
    today: todayK,
    profile: {
      name: profile.name,
      age: profile.age,
      sex: profile.sex === 'f' ? 'женский' : profile.sex === 'm' ? 'мужской' : 'не указан',
      goals: goalLabels(profile),
      pregnant: !!profile.pregnant,
      hormonal_contraception: profile.coc ? 'КОК' : null,
      cycle: cd ? { day: cd, length: profile.len, phase: cyclePhase(cd, profile.len, profile.coc)[0] } : null
    },
    days
  };
}

/** Ключ кэша инсайтов: меняется, когда меняются данные или наступает новый день */
export const aiContextHash = (ctx) => ctx.today + ':' + ctx.days.length + ':' + JSON.stringify(ctx.days).length;
