// Контекст для ИИ: всё, что пользователь о себе отметил, — профиль, цели, личные ориентиры,
// подробные записи за последние 30 дней и общая сводка за всё время в приложении.
// Отправляется в /api/ask и /api/insights; облегчённая версия (foodContext) — в /api/food.
// Имя не передаём: оно не нужно для советов.
import { BRISTOL_TYPES, STOOL_COLORS, SYMPTOM_OK } from './catalog.js';
import { addDays } from './dates.js';
import { gutScore, symptomsOf, emptyDay, hasData, fiberOf, waterOf } from './score.js';
import { cycleDay, cyclePhase } from './cycle.js';
import { goalLabels, validHeight, validWeight } from './profile.js';
import { dailyTargets } from './targets.js';

const DETAIL_DAYS = 30;
const TOP_MEALS = 8;

const colorLabel = (id) => (STOOL_COLORS.find((c) => c.id === id) || {}).label || id;
const day = (log, k) => ({ ...emptyDay(), ...(log[k] || {}) });
const avg = (arr) => (arr.length ? Math.round(arr.reduce((a, x) => a + x, 0) / arr.length * 10) / 10 : null);

/** Профиль для ИИ: кто пользователь, что его волнует, личные ориентиры */
function aiProfile(profile, todayK) {
  const p = profile, t = dailyTargets(p), cd = cycleDay(p, todayK, todayK);
  return {
    age: p.age,
    sex: p.sex === 'f' ? 'женский' : p.sex === 'm' ? 'мужской' : 'не указан',
    height_cm: validHeight(p.height),
    weight_kg: validWeight(p.weight),
    goals: goalLabels(p),
    own_goal: (p.goals || []).includes('other') && p.other ? p.other : null,
    pregnant: !!p.pregnant,
    hormonal_contraception: p.coc ? 'КОК' : null,
    menopause: !!p.menopause,
    cycle: cd ? { day: cd, length: p.len, phase: cyclePhase(cd, p.len, p.coc)[0] } : null,
    daily_targets: { water_ml: t.waterMl, fiber_g: t.fiberG },
    using_app_since: p.since ? p.since.slice(0, 10) : null
  };
}

/** Один день — компактно, только то, что отмечено */
function aiDay(k, r) {
  const sc = gutScore(r);
  const out = { date: k };
  const stool = r.gut.filter((g) => g.type > 0).map((g) => g.time + ' тип ' + g.type + ' (' + BRISTOL_TYPES[g.type] + ')' + (g.color ? ', цвет: ' + colorLabel(g.color) : ''));
  if (stool.length) out.stool = stool;
  if (r.gut.some((g) => g.type === 0)) out.no_stool_marked = true;
  const sym = symptomsOf(r);
  if (sym.length) out.symptoms = sym;
  else if (r.gut.some((g) => g.sym.includes(SYMPTOM_OK))) out.feeling = 'всё хорошо';
  const stress = r.gut.filter((g) => g.stress != null).map((g) => g.stress);
  if (stress.length) out.stress = stress.map((v) => v + '/10');
  if (r.meals.length) {
    out.meals = r.meals.map((m) => m.time + ' ' + m.name + ': ' + m.kcal + ' ккал, Б' + (m.protein || 0) + ' Ж' + (m.fat || 0) + ' У' + (m.carbs || 0) + ', клетчатка ' + m.fiber + ' г' + (m.note ? ' (' + m.note + ')' : ''));
    out.fiber_g = fiberOf(r);
  }
  if (waterOf(r)) out.water_ml = waterOf(r);
  if (r.period) out.period = true;
  if (sc) out.gut_score = sc.idx;
  return out;
}

/** Сводка за всё, что есть в дневнике (до 90 дней, которые загружает приложение) */
function aiSummary(log, todayK) {
  const keys = Object.keys(log).filter((k) => k <= todayK && hasData(day(log, k))).sort();
  const bristol = {}, symptoms = {}, meals = {}, scores = [], stress = [], water = [], fiber = [];
  let noStoolDays = 0, periodDays = 0;
  for (const k of keys) {
    const r = day(log, k), sc = gutScore(r);
    for (const g of r.gut) {
      if (g.type > 0) bristol[g.type] = (bristol[g.type] || 0) + 1;
      if (g.stress != null) stress.push(g.stress);
    }
    if (r.gut.some((g) => g.type === 0) && !r.gut.some((g) => g.type > 0)) noStoolDays++;
    for (const s of symptomsOf(r)) symptoms[s] = (symptoms[s] || 0) + 1;
    for (const m of r.meals) meals[m.name] = (meals[m.name] || 0) + 1;
    if (sc) scores.push(sc.idx);
    if (waterOf(r)) water.push(waterOf(r));
    if (fiberOf(r) != null) fiber.push(fiberOf(r));
    if (r.period) periodDays++;
  }
  return {
    first_entry: keys[0] || null,
    days_logged: keys.length,
    bristol_type_counts: bristol,
    no_stool_days: noStoolDays,
    symptom_days: symptoms,
    avg_gut_score: avg(scores),
    avg_stress: avg(stress),
    avg_water_ml: avg(water),
    avg_fiber_g: avg(fiber),
    period_days: periodDays,
    frequent_meals: Object.entries(meals).sort((a, b) => b[1] - a[1]).slice(0, TOP_MEALS).map(([name, n]) => name + ' ×' + n)
  };
}

export function buildAiContext(profile, log, todayK) {
  const days = [];
  for (let i = DETAIL_DAYS - 1; i >= 0; i--) {
    const k = addDays(todayK, -i), r = day(log, k);
    if (hasData(r) || r.period) days.push(aiDay(k, r));
  }
  return {
    today: todayK,
    profile: aiProfile(profile, todayK),
    summary: aiSummary(log, todayK),
    days
  };
}

/** Для разбора блюда: профиль и что уже съедено и выпито сегодня — чтобы совет был про остаток дня */
export function foodContext(profile, log, todayK) {
  const r = day(log, todayK), p = aiProfile(profile, todayK);
  return {
    profile: { age: p.age, sex: p.sex, height_cm: p.height_cm, weight_kg: p.weight_kg, goals: p.goals, own_goal: p.own_goal, pregnant: p.pregnant, daily_targets: p.daily_targets },
    today_so_far: { fiber_g: fiberOf(r) || 0, water_ml: waterOf(r), meals: r.meals.map((m) => m.name), symptoms: symptomsOf(r) }
  };
}

/** Ключ кэша инсайтов: меняется, когда меняются данные, профиль или наступает новый день */
export function aiContextHash(ctx) {
  const s = JSON.stringify(ctx);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return ctx.today + ':' + (h >>> 0).toString(36);
}
