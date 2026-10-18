import { DCLogic } from '../runtime.js';
import { APP_NAME, APP_VERSION, SUPPORT_URL, LEGAL_DOCS, LEGAL_VERSION, IS_DEMO } from '../config.js';
import { track, identifyUser, setPersonProps, setScreen, pageview, resetAnalytics, flush } from '../services/analytics.js';
import * as store from '../services/store.js';
import { keyOf, parseKey, newId } from '../services/store.js';
import { analyzeFood, askAI, getInsights } from '../services/ai.js';
import { compressImage, exportCSV, openDoctorReport } from '../services/files.js';
import { signOutAndReset } from '../services/supabase.js';

const MG = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
const DEMO_TODAY = '2026-09-26';
const AGE_MIN = 18, AGE_MAX = 90;
const TINT = {
  calm: 'linear-gradient(135deg,#BCA984,#5E4F36)',
  mild: 'linear-gradient(135deg,#7E8F5A,#34401F)',
  sens: 'linear-gradient(135deg,#B86A42,#4E2416)'
};
const blankProfile = () => ({ name: '', age: 28, sex: '', goals: [], other: '', cycle: false, lastUnknown: false, lastAgo: 11, len: 28, am: true, pm: false, onboardedAt: null, since: '' });
const yearsWord = (n) => (n % 10 === 1 && n % 100 !== 11 ? 'год' : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? 'года' : 'лет');

export default class App extends DCLogic {
  constructor(props) {
    super(props);
    const local = store.loadLocal();
    const hash = (location.hash || '').replace('#', '');
    let screen = 'onb', profile = blankProfile(), log = {};
    if (IS_DEMO) {
      log = this.seed();
      const map = { home: 'home', add: 'add', insights: 'ins', profile: 'prof' };
      if (map[hash]) {
        screen = map[hash];
        profile = { ...blankProfile(), name: 'Маша', age: 29, sex: 'f', goals: ['stool', 'bloat'], cycle: true, onboardedAt: '2026-09-21', since: '2026-09-21' };
      }
    } else if (local && local.profile) {
      profile = { ...blankProfile(), ...local.profile };
      log = local.log || {};
      if (profile.onboardedAt) screen = 'home';
    }
    this.state = {
      screen, onbStep: 'welcome', onbSkip: false, consent: false,
      profile, log,
      selected: this.today(),
      form: this.blankForm(),
      aiQ: '', aiA: '', aiLoading: false, askText: '', toast: '', foodN: 0,
      insights: this.loadInsightsCache(), insLoading: false
    };
    this._onbStart = Date.now();
    this.setScroll = (el) => { if (el) this._sc = el; };
    this.setDrum = (el) => {
      if (el && el !== this._drum) { this._drum = el; el.scrollTop = (this.state.profile.age - AGE_MIN) * 40; }
      if (!el) this._drum = null;
    };
    this.onDrum = (e) => {
      const age = Math.min(AGE_MAX, Math.max(AGE_MIN, AGE_MIN + Math.round(e.target.scrollTop / 40)));
      if (age !== this.state.profile.age) this.setProf({ age }, 'age');
    };
  }

  // ---------- жизненный цикл ----------
  async componentDidMount() {
    this.onScreen();
    const userId = await identifyUser();
    track('app_opened', { is_returning: !!this.state.profile.onboardedAt, local_days: Object.keys(this.state.log).length });
    if (IS_DEMO) return;
    const remote = await store.loadRemote(this.today());
    if (!remote) return;
    const s = this.state;
    const patch = { log: this.mergeLogs(s.log, remote.log) };
    if (remote.profile && remote.profile.onboardedAt) {
      patch.profile = { ...s.profile, ...remote.profile };
      if (s.screen === 'onb' && s.onbStep === 'welcome') patch.screen = 'home';
    } else if (s.profile.onboardedAt) {
      store.saveProfile(s.profile, this.today()); // профиль был только локально — догружаем
    }
    this.setState(patch);
    if (userId && (patch.profile || s.profile).onboardedAt) setPersonProps(this.personProps(patch.profile || s.profile));
  }

  componentDidUpdate(prevProps, prev) {
    const s = this.state;
    if (prev && (prev.screen !== s.screen || prev.onbStep !== s.onbStep)) {
      if (this._sc) this._sc.scrollTop = 0;
      this.onScreen();
    }
    if (prev && (prev.log !== s.log || prev.profile !== s.profile) && s.profile.onboardedAt) store.saveLocal(s.profile, s.log);
  }

  onScreen() {
    const s = this.state;
    const name = s.screen === 'onb' ? 'onboarding_' + s.onbStep : { home: 'today', add: 'add_entry', ins: 'insights', prof: 'profile' }[s.screen];
    setScreen(name);
    pageview(name);
    if (s.screen === 'onb') track('onboarding_step_viewed', { step: s.onbStep, step_index: this.onbFlow().indexOf(s.onbStep) + 1 });
    else track('screen_viewed', { screen_name: name });
    if (s.screen === 'ins' || s.screen === 'home') this.refreshInsights();
  }

  // ---------- даты ----------
  today() { return IS_DEMO ? DEMO_TODAY : keyOf(new Date()); }
  nowHM() { if (IS_DEMO) return '14:46'; const d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
  monday() { const d = parseKey(this.today()); const w = (d.getDay() + 6) % 7; d.setDate(d.getDate() - w); return d; }
  addDays(k, n) { const d = parseKey(k); d.setDate(d.getDate() + n); return keyOf(d); }

  // ---------- справочники ----------
  types() { return { 1: 'Твёрдые комки', 2: 'Комковатая', 3: 'С трещинами', 4: 'Гладкая — норма', 5: 'Мягкие комочки', 6: 'Кашица', 7: 'Жидкий' }; }
  goalList() {
    return [
      { id: 'health', label: 'Следить за здоровьем', short: 'Здоровье' },
      { id: 'stool', label: 'Наладить стул', short: 'Наладить стул' },
      { id: 'bloat', label: 'Избавиться от вздутия', short: 'Без вздутия' },
      { id: 'weight', label: 'Похудеть', short: 'Похудеть' },
      { id: 'food', label: 'Понять реакцию на еду', short: 'Реакция на еду' },
      { id: 'other', label: 'Другое', short: 'Другое' }
    ];
  }
  presets() {
    return [
      { name: 'Паста с песто', kcal: 520, fiber: 5, verdict: 'Умеренно', tone: 'mild', tip: 'Мало клетчатки — добавьте салат или овощи.' },
      { name: 'Овсянка с ягодами', kcal: 380, fiber: 9, verdict: 'Хорошо', tone: 'calm', tip: 'Мягкая клетчатка — то, что кишечнику нужно.' },
      { name: 'Пицца пепперони', kcal: 780, fiber: 3, verdict: 'Тяжело', tone: 'sens', tip: 'Жирно и мало клетчатки — может быть вздутие.' }
    ];
  }
  seed() {
    const P = this.presets();
    const g = (time, type, sym) => ({ id: newId(), time, type, sym: sym || [] });
    const m = (time, i) => ({ id: newId(), time, ...P[i], photo: '' });
    const d = (o) => ({ gut: [], meals: [], period: false, ...o });
    return {
      '2026-09-20': d({ gut: [g('09:00', 5)] }),
      '2026-09-21': d({ gut: [g('08:15', 4, ['Боль'])], meals: [m('08:00', 1)] }),
      '2026-09-22': d({ gut: [g('08:40', 4)], meals: [m('08:20', 1)] }),
      '2026-09-23': d({ gut: [g('21:00', 0, ['Вздутие'])], meals: [m('20:30', 2)] }),
      '2026-09-24': d({ gut: [g('09:10', 2, ['Вздутие', 'Тяжесть'])], meals: [m('13:30', 0)] }),
      '2026-09-25': d({ gut: [g('08:20', 3)], meals: [m('08:30', 1)] }),
      '2026-09-26': d({ gut: [g('08:35', 4)], meals: [m('08:10', 1)] })
    };
  }
  blankForm() { return { stool: '', type: 4, sym: [], period: '', food: 'pick', photo: '', result: null, source: '' }; }

  // ---------- данные ----------
  rec(k) { return { gut: [], meals: [], period: false, ...(this.state.log[k] || {}) }; }
  symOf(r) { return [...new Set(r.gut.flatMap((x) => x.sym).filter((x) => x !== 'Всё хорошо'))]; }
  mergeLogs(a, b) {
    const out = {};
    new Set([...Object.keys(a), ...Object.keys(b)]).forEach((k) => {
      const x = a[k] || { gut: [], meals: [] }, y = b[k] || { gut: [], meals: [] };
      const uniq = (arr) => { const seen = {}; return arr.filter((e) => (e.id && seen[e.id] ? false : (seen[e.id || Math.random()] = true))); };
      out[k] = {
        gut: uniq([...(y.gut || []), ...(x.gut || [])]).sort((p, q) => p.time.localeCompare(q.time)),
        meals: uniq([...(y.meals || []), ...(x.meals || [])]).sort((p, q) => p.time.localeCompare(q.time)),
        period: !!(x.period || y.period)
      };
    });
    return out;
  }

  // Работа кишечника, %: регулярность + консистенция + самочувствие
  score(r) {
    if (!r.gut.length) return null;
    const F = { 1: 35, 2: 55, 3: 85, 4: 92, 5: 72, 6: 48, 7: 30 };
    const typed = r.gut.filter((x) => x.type > 0);
    const had = r.gut.some((x) => x.type >= 0);
    const sym = this.symOf(r);
    const form = typed.length ? Math.round(typed.reduce((a, x) => a + F[x.type], 0) / typed.length) : 58;
    const reg = typed.length ? 90 : (had ? 50 : 70);
    const comfort = Math.max(30, 92 - 24 * sym.length);
    const last = typed.length ? typed[typed.length - 1].type : 0;
    return { idx: Math.round(0.35 * form + 0.3 * reg + 0.35 * comfort), form, reg, comfort, n: typed.length, had, last, sym };
  }
  toneOf(v) { return v == null ? 'empty' : v >= 80 ? 'calm' : v >= 62 ? 'mild' : 'sens'; }
  col(t) { return { calm: '#D3FA9D', mild: '#7FA866', sens: '#A78BFA', cycle: '#7954C8', empty: 'rgba(255,255,255,.15)' }[t]; }
  cycDay(k) {
    const p = this.state.profile;
    if (!p.cycle || p.lastUnknown) return 0;
    const start = parseKey(this.today()); start.setDate(start.getDate() - p.lastAgo);
    const diff = Math.round((parseKey(k) - start) / 864e5);
    return ((diff % p.len) + p.len) % p.len + 1;
  }
  phase(d, len) {
    if (d <= 5) return ['Месячные', 'Стул может быть мягче и чаще — это нормально, так действуют простагландины. Тёплая еда и вода помогут.'];
    if (d <= len - 16) return ['После месячных', 'Обычно самый ровный период для кишечника. Хорошее время пробовать новые продукты.'];
    if (d <= len - 12) return ['Овуляция', 'Возможно лёгкое вздутие на 1–2 дня. Меньше газировки и бобовых.'];
    return ['Перед месячными', 'Прогестерон замедляет кишечник — вздутие и запоры ожидаемы. Больше воды и клетчатки.'];
  }
  draft(r) {
    const f = this.state.form, t = this.nowHM();
    const next = { gut: [...r.gut], meals: [...r.meals], period: f.period ? f.period === 'yes' : r.period };
    let g = null, m = null;
    if (f.stool || f.sym.length) { g = { id: newId(), time: t, type: f.stool === 'had' ? f.type : (f.stool === 'none' ? 0 : -1), sym: [...f.sym] }; next.gut.push(g); }
    if (f.food === 'done' && f.result) { m = { id: newId(), time: t, ...f.result, photo: f.photo, source: f.source }; next.meals.push(m); }
    return { next, g, m };
  }

  // Сводка для ИИ: профиль + последние 14 дней
  aiContext() {
    const s = this.state, pr = s.profile, T = this.types(), today = this.today();
    const days = [];
    for (let i = 13; i >= 0; i--) {
      const k = this.addDays(today, -i), r = this.rec(k);
      if (!r.gut.length && !r.meals.length && !r.period) continue;
      const sc = this.score(r);
      days.push({
        date: k,
        stool: r.gut.filter((g) => g.type > 0).map((g) => g.time + ' тип ' + g.type + ' (' + T[g.type] + ')'),
        no_stool_marked: r.gut.some((g) => g.type === 0),
        symptoms: this.symOf(r),
        meals: r.meals.map((m) => m.time + ' ' + m.name + ', ' + m.kcal + ' ккал, клетчатка ' + m.fiber + ' г'),
        period: !!r.period, gut_score: sc ? sc.idx : null
      });
    }
    const cd = this.cycDay(today);
    return {
      today, profile: {
        name: pr.name, age: pr.age, sex: pr.sex === 'f' ? 'женский' : pr.sex === 'm' ? 'мужской' : 'не указан',
        goals: pr.goals.map((g) => (this.goalList().find((x) => x.id === g) || {}).label).filter(Boolean).concat(pr.other ? [pr.other] : []),
        cycle: pr.cycle && cd ? { day: cd, length: pr.len, phase: this.phase(cd, pr.len)[0] } : null
      },
      days
    };
  }

  // ---------- ИИ-инсайты (кэш на день) ----------
  loadInsightsCache() { try { return JSON.parse(localStorage.getItem('gt_insights') || 'null'); } catch (_) { return null; } }
  insightsHash() {
    const ctx = this.aiContext();
    return ctx.today + ':' + JSON.stringify(ctx.days).length + ':' + ctx.days.length + ':' + (ctx.days.length ? ctx.days[ctx.days.length - 1].date : '');
  }
  async refreshInsights() {
    const s = this.state;
    if (IS_DEMO || s.insLoading || !s.profile.onboardedAt) return;
    const ctx = this.aiContext();
    if (!ctx.days.length) return;
    const hash = this.insightsHash();
    if (s.insights && s.insights.hash === hash) return;
    this.setState({ insLoading: true });
    const t0 = Date.now();
    try {
      const r = await getInsights(ctx);
      const insights = { hash, date: ctx.today, tip_title: r.tip_title, tip_text: r.tip_text, noticed: r.noticed };
      try { localStorage.setItem('gt_insights', JSON.stringify(insights)); } catch (_) {}
      this.setState({ insights, insLoading: false });
      track('ai_insights_generated', { latency_ms: Date.now() - t0, days_count: ctx.days.length });
    } catch (e) {
      this.setState({ insLoading: false });
      track('ai_insights_failed', { error: String(e.message || e).slice(0, 120) });
    }
  }

  // ---------- действия ----------
  toast(msg) {
    clearTimeout(this._t);
    this.setState({ toast: msg });
    this._t = setTimeout(() => this.setState({ toast: '' }), 2200);
  }
  setForm(p) { this.setState({ form: { ...this.state.form, ...p } }); }
  setProf(p, field) {
    const profile = { ...this.state.profile, ...p };
    this.setState({ profile });
    if (this.state.screen === 'onb' || IS_DEMO) return;
    this._dirty = this._dirty || new Set();
    if (field) this._dirty.add(field);
    clearTimeout(this._profT);
    this._profT = setTimeout(() => {
      const fields = [...this._dirty]; this._dirty.clear();
      store.saveProfile(this.state.profile, this.today());
      track('profile_updated', { fields });
      setPersonProps(this.personProps(this.state.profile));
    }, 700);
  }
  personProps(p) {
    return { sex: p.sex || null, age: p.age, goals: p.goals, goals_count: p.goals.length, has_custom_goal: !!p.other, cycle_enabled: !!p.cycle, reminder_am: !!p.am, reminder_pm: !!p.pm, onboarded_at: p.onboardedAt };
  }
  go(screen, source) {
    return () => {
      if (this.state.screen !== screen) track('nav_clicked', { to: screen, from: this.state.screen, source: source || 'tab' });
      this.setState({ screen });
    };
  }

  async startScan(file, source) {
    const n = this.state.foodN;
    if (source === 'example' || IS_DEMO) {
      const P = this.presets(), result = P[n % 3];
      this.setState({ form: { ...this.state.form, food: 'scan', photo: '', result: null, source }, foodN: n + 1 });
      track('food_photo_added', { source });
      clearTimeout(this._scan);
      this._scan = setTimeout(() => {
        this.setForm({ food: 'done', result });
        track('food_analysis_completed', { source, verdict: result.verdict, tone: result.tone, kcal: result.kcal, fiber: result.fiber, latency_ms: 1600 });
      }, 1600);
      return;
    }
    let preview = '';
    try { preview = URL.createObjectURL(file); } catch (_) {}
    this.setState({ form: { ...this.state.form, food: 'scan', photo: preview, result: null, source }, foodN: n + 1 });
    track('food_photo_added', { source, file_type: file.type, size_kb: Math.round(file.size / 1024) });
    const t0 = Date.now(), scanId = (this._scanId = newId());
    try {
      const image = await compressImage(file);
      const r = await analyzeFood(image, { goals: this.aiContext().profile.goals });
      if (this._scanId !== scanId) return; // пользователь уже убрал фото
      if (r.is_food === false) {
        this.setForm({ food: 'pick', photo: '' });
        this.toast('Не похоже на еду — попробуйте другое фото');
        track('food_analysis_failed', { reason: 'not_food', latency_ms: Date.now() - t0 });
        return;
      }
      const result = { name: r.name, kcal: Math.round(r.kcal) || 0, fiber: Math.round((r.fiber || 0) * 10) / 10, verdict: r.verdict, tone: ['calm', 'mild', 'sens'].includes(r.tone) ? r.tone : 'mild', tip: r.tip };
      this.setForm({ food: 'done', result });
      track('food_analysis_completed', { source, verdict: result.verdict, tone: result.tone, kcal: result.kcal, fiber: result.fiber, latency_ms: Date.now() - t0 });
    } catch (e) {
      if (this._scanId !== scanId) return;
      this.setForm({ food: 'pick', photo: '' });
      this.toast('Не получилось разобрать фото');
      track('food_analysis_failed', { reason: String(e.message || e).slice(0, 120), latency_ms: Date.now() - t0 });
    }
  }

  save() {
    const f = this.state.form, k = this.today();
    if (!f.stool && !f.sym.length && f.food !== 'done' && !f.period) {
      this.toast('Отметьте хоть что-нибудь');
      track('entry_save_blocked', { reason: 'empty' });
      return;
    }
    const before = this.rec(k), cur = this.score(before);
    const { next, g, m } = this.draft(before);
    const after = this.score(next);
    const wasEmpty = !Object.keys(this.state.log).some((d) => { const r = this.state.log[d]; return (r.gut && r.gut.length) || (r.meals && r.meals.length); });
    const log = { ...this.state.log, [k]: next };
    this.setState({ log, form: this.blankForm(), screen: 'home', selected: k });
    this.toast('Сохранено');

    if (!IS_DEMO) {
      if (g) store.addGut(k, g);
      if (m) store.addMeal(k, m);
      if (f.period) store.setPeriod(k, f.period === 'yes');
    }
    const daysLogged7 = [...Array(7)].filter((_, i) => { const r = log[this.addDays(k, -i)]; return r && ((r.gut && r.gut.length) || (r.meals && r.meals.length)); }).length;
    const props = {
      stool_status: f.stool || 'not_set', bristol_type: f.stool === 'had' ? f.type : null,
      symptoms: f.sym, symptoms_count: f.sym.filter((x) => x !== 'Всё хорошо').length,
      has_food: !!m, food_source: m ? m.source : null, food_tone: m ? m.tone : null,
      period_mark: f.period || null, gut_score: after ? after.idx : null,
      score_before: cur ? cur.idx : null, score_delta: after && cur ? after.idx - cur.idx : null,
      days_logged_last7: daysLogged7, hour: new Date().getHours()
    };
    track('entry_saved', props);
    if (wasEmpty) track('first_entry_saved', props);
    flush();
  }

  onbFlow() {
    if (this.state.onbSkip) return ['consent'];
    return this.state.profile.sex === 'm' ? ['consent', 'about', 'goals'] : ['consent', 'about', 'goals', 'cycle'];
  }
  onbNext(cycle) {
    const s = this.state, p = s.profile, flow = this.onbFlow(), i = flow.indexOf(s.onbStep);
    if (s.onbStep === 'consent') {
      if (!s.consent) { this.toast('Нужно согласие с документами'); track('consent_blocked'); return; }
      track('consent_accepted', { version: LEGAL_VERSION, documents: Object.keys(LEGAL_DOCS) });
      if (!IS_DEMO) store.saveConsents(Object.keys(LEGAL_DOCS), LEGAL_VERSION);
    }
    if (s.onbStep === 'about' && (!p.name.trim() || !p.sex)) {
      this.toast('Укажите имя и пол');
      track('onboarding_validation_error', { step: 'about', missing: [!p.name.trim() && 'name', !p.sex && 'sex'].filter(Boolean) });
      return;
    }
    const stepProps = { step: s.onbStep };
    if (s.onbStep === 'about') Object.assign(stepProps, { sex: p.sex, age: p.age });
    if (s.onbStep === 'goals') Object.assign(stepProps, { goals: p.goals, goals_count: p.goals.length, has_custom_goal: !!p.other.trim() });
    if (s.onbStep === 'cycle') Object.assign(stepProps, { cycle_enabled: !!cycle, last_period: p.lastUnknown ? 'unknown' : p.lastAgo });
    track('onboarding_step_completed', stepProps);
    if (i < flow.length - 1) { this.setState({ onbStep: flow[i + 1] }); return; }
    this.finishOnb({ cycle: s.onbStep === 'cycle' ? cycle : false });
  }
  finishOnb(extra) {
    const today = this.today();
    const profile = { ...this.state.profile, ...extra, onboardedAt: new Date().toISOString(), since: this.state.profile.since || today };
    this.setState({ profile, screen: 'home', onbStep: 'welcome', onbSkip: false, selected: today });
    if (!IS_DEMO) {
      store.saveProfile(profile, today);
      store.saveLocal(profile, this.state.log);
    }
    identifyUser(this.personProps(profile));
    track('onboarding_completed', { ...this.personProps(profile), skipped: !!this.state.onbSkip, duration_sec: Math.round((Date.now() - this._onbStart) / 1000) });
    flush();
  }

  async resetAll() {
    if (!window.confirm('Удалить все данные? Записи, профиль и история будут удалены без возможности восстановления.')) {
      track('data_delete_cancelled');
      return;
    }
    track('data_deleted');
    await flush();
    const ok = IS_DEMO ? true : await store.wipeAll();
    resetAnalytics();
    if (!IS_DEMO) await signOutAndReset();
    try { localStorage.removeItem('gt_insights'); } catch (_) {}
    this.setState({ log: {}, profile: blankProfile(), screen: 'onb', onbStep: 'welcome', consent: false, insights: null, form: this.blankForm(), aiQ: '', aiA: '' });
    this._onbStart = Date.now();
    this.toast(ok ? 'Данные удалены' : 'Удалено на устройстве, сервер не ответил');
  }

  async ask(q, source) {
    if (!q) return;
    this.setState({ aiQ: q, aiA: '', aiLoading: true, askText: '' });
    track('ai_question_asked', { source, length: q.length });
    const t0 = Date.now();
    if (IS_DEMO) {
      const canned = { 'ужин': 'Для лёгкости: запечённая рыба или курица с тушёными овощами и рисом. На ночь лучше без лука, чеснока и бобовых.', 'вздут': 'По записям вздутие было после пиццы и в день без стула. Больше воды и клетчатки, меньше жирного вечером.' };
      const hit = Object.keys(canned).find((k) => q.toLowerCase().includes(k));
      setTimeout(() => this.setState({ aiA: hit ? canned[hit] : 'В рабочей версии ответит ИИ на основе ваших записей и еды.', aiLoading: false }), 700);
      return;
    }
    try {
      const r = await askAI(q, this.aiContext());
      if (this.state.aiQ !== q) return;
      this.setState({ aiA: r.answer, aiLoading: false });
      track('ai_answer_received', { source, latency_ms: Date.now() - t0, answer_length: (r.answer || '').length });
    } catch (e) {
      this.setState({ aiA: 'Не получилось получить ответ. Попробуйте ещё раз чуть позже.', aiLoading: false });
      track('ai_answer_failed', { source, error: String(e.message || e).slice(0, 120) });
    }
  }

  // ---------- рендер ----------
  renderVals() {
    const s = this.state, T = this.types(), P = this.presets(), pr = s.profile;
    const DOWF = ['Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'];
    const DOW = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
    const todayK = this.today(), today = parseKey(todayK);
    const word = { calm: 'Хорошо', mild: 'Есть сбои', sens: 'Нужно внимание', empty: 'Нет данных' };

    // онбординг
    const flow = this.onbFlow(), si = flow.indexOf(s.onbStep);
    const aboutOk = !!pr.name.trim() && !!pr.sex;

    const monday = this.monday();
    const weekDays = DOW.map((dow, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return { dow, d, k: keyOf(d), future: d > today }; });
    const week = weekDays.map(({ dow, d, k, future }) => {
      const sc = this.score(this.rec(k)), cd = this.cycDay(k);
      const per = pr.cycle && ((cd >= 1 && cd <= 5) || this.rec(k).period);
      return { dow, num: d.getDate(), cls: 'day' + (k === s.selected ? ' sel' : '') + (future ? ' fut' : '') + (per ? ' per' : ''),
        dot: 'dot ' + (future ? '' : this.toneOf(sc ? sc.idx : null)), aria: d.getDate() + ' ' + MG[d.getMonth()] + (sc ? ', ' + sc.idx + '%' : '') + (per ? ', месячные' : ''),
        pick: () => {
          if (future || k === s.selected) return;
          this.setState({ selected: k });
          track('day_selected', { days_ago: Math.round((today - d) / 864e5), has_data: !!sc });
        } };
    });

    // выбранный день
    const selD = parseKey(s.selected), r = this.rec(s.selected), isToday = s.selected === todayK;
    const sc = this.score(r);
    const prevD = new Date(selD); prevD.setDate(selD.getDate() - 1);
    const prevSc = this.score(this.rec(keyOf(prevD)));
    const tone = this.toneOf(sc ? sc.idx : null);
    const delta = sc && prevSc ? sc.idx - prevSc.idx : null;
    const glowC = { cyc: '121,84,200', cycle: '121,84,200', calm: '211,250,157', mild: '127,168,102', sens: '167,139,250', empty: '168,163,179' };

    const timeline = [];
    r.gut.forEach((x) => {
      const sym = x.sym.filter((v) => v !== 'Всё хорошо');
      const symTxt = sym.length ? sym.join(', ').toLowerCase() : 'без дискомфорта';
      if (x.type > 0) timeline.push({ t: x.time, isGut: true, isMeal: false, isNone: false, isPer: false, type: String(x.type), title: 'Стул · тип ' + x.type, sub: T[x.type].toLowerCase() + ' · ' + symTxt, time: x.time });
      else timeline.push({ t: x.time, isGut: false, isMeal: false, isNone: true, isPer: false, type: '4', title: x.type === 0 ? 'Стула не было' : 'Самочувствие', sub: symTxt, time: x.time });
    });
    r.meals.forEach((m) => timeline.push({ t: m.time, isGut: false, isMeal: true, isNone: false, isPer: false, tint: TINT[m.tone] || TINT.mild, photo: m.photo, hasPhoto: !!m.photo, title: m.name, sub: m.kcal + ' ккал · клетчатка ' + String(m.fiber).replace('.', ',') + ' г', time: m.time }));
    if (pr.cycle && r.period) timeline.push({ t: '00:00', isGut: false, isMeal: false, isNone: false, isPer: true, type: '4', title: 'Месячные', sub: 'отмечено вручную', time: 'день' });
    timeline.sort((a, b) => a.t.localeCompare(b.t));

    const tips = {
      calm: ['Ровный день — закрепите', 'Повторите то, что ели сегодня, и пейте воду в течение дня — это поддержит стул типа 3–4.'],
      mild: ['Небольшой сбой — легко поправить', 'Добавьте 1–2 стакана воды и овощи к обеду — это мягко вернёт стул к типу 3–4.'],
      sens: ['Кишечнику нужно полегче', 'Сегодня без жирного и газировки вечером. Тёплый ужин с рисом и тушёными овощами.']
    };
    if (IS_DEMO) tips.calm[1] = 'Овсянка утром уже 4-й раз совпадает со стулом типа 3–4. Оставьте её в завтраке.';
    const aiTip = isToday && s.insights && s.insights.date === todayK && s.insights.tip_title ? [s.insights.tip_title, s.insights.tip_text] : null;
    const tip = aiTip || tips[tone] || tips.mild;
    const ring = (label, v, val, sub) => ({ label, sub, val, dash: v == null ? '0' : (v / 100 * 238.8).toFixed(1), color: v == null ? 'transparent' : this.col(this.toneOf(v)) });
    const rings = sc ? [
      ring('Стул', sc.reg, sc.n + '×', sc.n ? (sc.n === 1 ? 'раз за день' : 'раза за день') : (sc.had ? 'стула не было' : 'не отмечено')),
      ring('Форма', sc.last ? sc.form : null, sc.last ? String(sc.last) : '—', sc.last ? 'тип ' + sc.last + (sc.last === 3 || sc.last === 4 ? ' · норма' : '') : 'нет стула'),
      ring('Комфорт', sc.comfort, sc.comfort + '%', sc.sym.length === 1 ? sc.sym[0].toLowerCase() : sc.sym.length ? sc.sym.length + ' симптома' : 'без симптомов')
    ] : [];

    // цикл
    const cdSel = this.cycDay(s.selected), ph = cdSel ? this.phase(cdSel, pr.len) : ['', ''];
    const cdT = this.cycDay(todayK);

    // инсайты
    let total = 0, norm = 0, symDays = 0, fibSum = 0, fibN = 0, idxSum = 0, idxN = 0, daysWithData = 0;
    const bars = weekDays.map(({ dow, d, k, future }) => {
      const rr = this.rec(k), sv = future ? null : this.score(rr);
      rr.gut.forEach((x) => { if (x.type > 0) { total++; if (x.type === 3 || x.type === 4) norm++; } });
      rr.meals.forEach((m) => { fibSum += Number(m.fiber) || 0; fibN++; });
      if (this.symOf(rr).length) symDays++;
      if (sv) { idxSum += sv.idx; idxN++; }
      if (rr.gut.length || rr.meals.length) daysWithData++;
      const t = this.toneOf(sv ? sv.idx : null), isT = k === todayK;
      return { dow, h: sv ? Math.max(12, Math.round((sv.idx - 30) / 70 * 90)) : 12,
        bg: sv ? this.col(t) : 'transparent', border: sv ? (isT ? '2px solid #F8F7F2' : '0') : '1px dashed rgba(255,255,255,.18)',
        tip: d.getDate() + ' ' + MG[d.getMonth()] + (sv ? ': ' + sv.idx + '%' : ': нет данных') };
    });
    const avgIdx = idxN ? Math.round(idxSum / idxN) : 0;
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
    const weekLbl = 'Неделя, ' + (monday.getMonth() === sunday.getMonth()
      ? monday.getDate() + '–' + sunday.getDate() + ' ' + MG[sunday.getMonth()]
      : monday.getDate() + ' ' + MG[monday.getMonth()] + ' – ' + sunday.getDate() + ' ' + MG[sunday.getMonth()]);
    let noticed;
    if (IS_DEMO) { const pz = this.score(this.rec('2026-09-24')); noticed = 'После пиццы вечером кишечник работал на ' + (pz ? pz.idx : '—') + '%. В дни с овсянкой на завтрак — не ниже 80%.'; }
    else if (s.insights && s.insights.noticed && s.insights.date === todayK) noticed = s.insights.noticed;
    else if (s.insLoading) noticed = 'Смотрю на ваши записи…';
    else if (daysWithData < 3) noticed = 'Добавьте записи хотя бы за 3 дня — здесь появятся закономерности между едой и самочувствием.';
    else noticed = 'За неделю стул был в норме в ' + (total ? Math.round(norm / total * 100) : 0) + '% случаев. Дней с дискомфортом: ' + symDays + '.';

    // форма
    const f = s.form;
    const todayRec = this.rec(todayK), cur = this.score(todayRec), pv = this.score(this.draft(todayRec).next);
    const tab = (t) => 'tab' + (s.screen === t ? ' on' : '');
    const isOnb = s.screen === 'onb';
    const screenTone = isOnb ? (s.onbStep === 'cycle' ? 'cyc' : 'calm') : s.screen === 'home' ? tone : s.screen === 'add' ? this.toneOf(pv ? pv.idx : null) : this.toneOf(avgIdx);
    const lastStart = new Date(today); lastStart.setDate(today.getDate() - pr.lastAgo);
    const since = pr.since ? parseKey(pr.since.slice(0, 10)) : null;
    const fp = f.result || P[0];
    const docLink = (id, source) => ({ id, url: LEGAL_DOCS[id].url, title: LEGAL_DOCS[id].title, open: () => track('legal_doc_opened', { doc: id, source }) });

    return {
      setScroll: this.setScroll, appName: APP_NAME, appVersion: APP_VERSION,
      lastOpts: [['На этой неделе', 3], ['1–2 недели назад', 10], ['2–3 недели назад', 17], ['Не помню', -1]].map(([label, v]) => {
        const on = v === -1 ? pr.lastUnknown : (!pr.lastUnknown && pr.lastAgo === v);
        return { label, on, cls: 'chip' + (on ? ' on' : ''), pick: () => this.setProf(v === -1 ? { lastUnknown: true, lastAgo: 11 } : { lastUnknown: false, lastAgo: v }, 'cycle_last') };
      }),
      chipF: 'chip' + (pr.sex === 'f' ? ' on' : ''), chipM: 'chip' + (pr.sex === 'm' ? ' on' : ''),
      isOnb, isProf: s.screen === 'prof', goProf: this.go('prof', 'avatar'), isHome: s.screen === 'home',
      otherOn: pr.goals.includes('other'), pOther: pr.other, setOther: (e) => this.setProf({ other: e.target.value }, 'goal_other'),
      profName: pr.name.trim() || 'Без имени', isFemale: pr.sex === 'f',
      profMeta: [pr.age + ' ' + yearsWord(pr.age), pr.sex === 'f' ? 'женщина' : pr.sex === 'm' ? 'мужчина' : '', since ? 'с ' + since.getDate() + ' ' + MG[since.getMonth()].slice(0, 3) : ''].filter(Boolean).join(' · '),
      ageMinus: () => this.setProf({ age: Math.max(AGE_MIN, pr.age - 1) }, 'age'), agePlus: () => this.setProf({ age: Math.min(AGE_MAX, pr.age + 1) }, 'age'),
      swCycle: 'sw' + (pr.cycle ? ' on' : ''), toggleCycle: () => { this.setProf({ cycle: !pr.cycle, lastUnknown: false }, 'cycle'); track('cycle_toggled', { enabled: !pr.cycle }); },
      swAm: 'sw' + (pr.am ? ' on' : ''), remAm: pr.am, toggleAm: () => { this.setProf({ am: !pr.am }, 'reminder_am'); track('reminder_toggled', { slot: 'morning', enabled: !pr.am }); },
      swPm: 'sw' + (pr.pm ? ' on' : ''), remPm: pr.pm, togglePm: () => { this.setProf({ pm: !pr.pm }, 'reminder_pm'); track('reminder_toggled', { slot: 'evening', enabled: !pr.pm }); },
      doReport: () => { openDoctorReport({ profile: pr, log: s.log, appName: APP_NAME, scoreOf: (x) => this.score({ gut: [], meals: [], ...x }) }); track('export_clicked', { format: 'pdf_report', days: Object.keys(s.log).length }); },
      doExport: () => { const n = exportCSV(s.log); this.toast('Файл CSV скачан'); track('export_clicked', { format: 'csv', rows: n }); },
      doReset: () => this.resetAll(), isAdd: s.screen === 'add', isIns: s.screen === 'ins',
      showTabs: !isOnb, padBottom: isOnb ? 28 : 120,
      tabHome: tab('home'), tabIns: tab('ins'), tabAdd: 'plus' + (s.screen === 'add' ? ' on' : ''),
      goHome: this.go('home'), goAdd: this.go('add'), goIns: this.go('ins'), goAddEmpty: this.go('add', 'empty_day'), goHomeBack: this.go('home', 'back'),
      glowBg: 'radial-gradient(closest-side at 50% 42%, rgba(' + glowC[screenTone] + ',.14), rgba(' + glowC[screenTone] + ',0))',

      // поддержка и документы
      supportUrl: SUPPORT_URL, supportHandle: '@' + SUPPORT_URL.split('/').pop(),
      openSupport: () => track('support_clicked', { source: 'profile' }),
      docs: ['terms', 'privacy', 'consent'].map((id) => docLink(id, 'profile')),
      dTerms: docLink('terms', 'onboarding'), dPrivacy: docLink('privacy', 'onboarding'), dConsent: docLink('consent', 'onboarding'),

      // онбординг
      canBack: si >= 0, noBack: si < 0,
      onbBack: () => { track('onboarding_back', { step: s.onbStep }); this.setState({ onbStep: si > 0 ? flow[si - 1] : 'welcome', onbSkip: si > 0 ? s.onbSkip : false }); },
      onbWelcome: s.onbStep === 'welcome', notWelcome: s.onbStep !== 'welcome',
      goAbout: () => { this._onbStart = Date.now(); track('onboarding_started'); this.setState({ onbStep: 'consent', onbSkip: false }); },
      skipOnb: () => { track('onboarding_skipped', { step: 'welcome' }); this.setState({ onbStep: 'consent', onbSkip: true }); },
      onbConsent: s.onbStep === 'consent', consentOn: s.consent, ckCls: 'cbx' + (s.consent ? ' on' : ''),
      toggleConsent: () => { this.setState({ consent: !s.consent }); track('consent_checkbox_toggled', { checked: !s.consent }); },
      onbAbout: s.onbStep === 'about', onbGoals: s.onbStep === 'goals', onbCycle: s.onbStep === 'cycle',
      pName: pr.name, pAge: pr.age,
      setName: (e) => { const v = e.target.value.replace(/^\s+/, ''); this.setProf({ name: v.charAt(0).toUpperCase() + v.slice(1) }, 'name'); },
      setDrum: this.setDrum, onDrum: this.onDrum, ageLbl: pr.age + ' ' + yearsWord(pr.age),
      ages: Array.from({ length: AGE_MAX - AGE_MIN + 1 }, (_, i) => { const n = AGE_MIN + i; return { n, on: n === pr.age, cls: 'di' + (n === pr.age ? ' on' : ''), pick: () => { if (this._drum) this._drum.scrollTo({ top: i * 40, behavior: 'smooth' }); } }; }),
      stepLbl: s.onbSkip ? 'Перед стартом' : 'Шаг ' + (si + 1) + ' / ' + flow.length,
      lastDate: pr.lastUnknown ? 'не знаю' : lastStart.getDate() + ' ' + MG[lastStart.getMonth()].slice(0, 3),
      segF: 'seg' + (pr.sex === 'f' ? ' on' : ''), segM: 'seg' + (pr.sex === 'm' ? ' on' : ''),
      pickF: () => this.setProf({ sex: 'f' }, 'sex'), pickM: () => this.setProf({ sex: 'm', cycle: false }, 'sex'),
      goals: this.goalList().map((g, gi) => {
        const on = pr.goals.includes(g.id);
        return { label: g.label, short: g.short, ico: '0' + (gi + 1), on, cls: 'goal' + (on ? ' on' : ''), chip: 'chip' + (on ? ' on' : ''), pick: () => this.setProf({ goals: on ? pr.goals.filter((x) => x !== g.id) : [...pr.goals, g.id] }, 'goals') };
      }),
      lastMinus: () => this.setProf({ lastAgo: Math.max(0, pr.lastAgo - 1), lastUnknown: false }, 'cycle_last'), lastPlus: () => this.setProf({ lastAgo: Math.min(60, pr.lastAgo + 1), lastUnknown: false }, 'cycle_last'),
      lenMinus: () => this.setProf({ len: Math.max(21, pr.len - 1) }, 'cycle_length'), lenPlus: () => this.setProf({ len: Math.min(40, pr.len + 1) }, 'cycle_length'),
      nextLbl: s.onbStep === 'cycle' ? 'Да, учитывать' : s.onbStep === 'consent' ? (s.onbSkip ? 'Начать' : 'Продолжить') : (si === flow.length - 1 ? 'Начать' : 'Дальше'),
      nextCls: 'btn' + ((s.onbStep === 'about' && !aboutOk) || (s.onbStep === 'consent' && !s.consent) ? ' off' : ''),
      onbNext: () => this.onbNext(true), skipCycle: () => { track('onboarding_skipped', { step: 'cycle' }); this.onbNext(false); },

      // сегодня
      hello: pr.name.trim() ? 'Привет, ' + pr.name.trim() : 'Привет',
      initial: (pr.name.trim()[0] || '·').toUpperCase(),
      dateLong: (isToday || s.screen !== 'home' ? 'Сегодня, ' : DOWF[selD.getDay()] + ', ') + (s.screen === 'home' ? selD.getDate() + ' ' + MG[selD.getMonth()] : today.getDate() + ' ' + MG[today.getMonth()]),
      heroSub: (sc && !sc.n && sc.had ? 'Стула не было' : word[tone]) + (delta ? ' · ' + (delta > 0 ? '+' : '−') + Math.abs(delta) + '% к вчера' : ''),
      week, isToday, gutTone: (pr.cycle && ((cdSel >= 1 && cdSel <= 5) || r.period)) ? 'cycle' : tone,
      hasScore: !!sc, noScore: !sc, idx: sc ? sc.idx : '—',
      rings, tipTitle: tip[0], tipText: tip[1],
      showCycle: pr.cycle && cdSel > 0, cycPhase: ph[0], cycNote: ph[1], cycDay: cdSel, cycLen: pr.len,
      timeline, hasEntries: timeline.length > 0,

      // + запись
      segHad: 'seg' + (f.stool === 'had' ? ' on' : ''), segNot: 'seg' + (f.stool === 'none' ? ' on' : ''),
      setHad: () => { const v = f.stool === 'had' ? '' : 'had'; this.setForm({ stool: v }); track('stool_status_selected', { value: v || 'cleared' }); },
      setNot: () => { const v = f.stool === 'none' ? '' : 'none'; this.setForm({ stool: v }); track('stool_status_selected', { value: v || 'cleared' }); },
      showTypes: f.stool === 'had',
      typeCells: [1, 2, 3, 4, 5, 6, 7].map((n) => ({ type: String(n), short: T[n], on: f.type === n, aria: 'Тип ' + n + ', ' + T[n], cls: 'tt' + (f.type === n ? ' on' : ''), pick: () => { this.setForm({ type: n }); track('bristol_type_selected', { bristol_type: n }); } })),
      symChips: ['Всё хорошо', 'Вздутие', 'Тяжесть', 'Боль', 'Газы'].map((l) => {
        const on = f.sym.includes(l);
        return { label: l, on, cls: 'chip' + (on ? ' on' : ''), pick: () => {
          const sym = l === 'Всё хорошо' ? (on ? [] : ['Всё хорошо']) : (on ? f.sym.filter((x) => x !== l) : [...f.sym.filter((x) => x !== 'Всё хорошо'), l]);
          this.setForm({ sym });
          track('symptom_toggled', { symptom: l, selected: !on });
        } };
      }),
      cycleOn: pr.cycle && !pr.lastUnknown, cycleProf: pr.cycle, cycDayToday: cdT, toLuteal: Math.max(1, (pr.len - 11) - cdT),
      segPerNo: 'seg' + (f.period === 'no' ? ' on' : ''), segPerYes: 'seg' + (f.period === 'yes' ? ' on' : ''),
      setPerNo: () => { this.setForm({ period: f.period === 'no' ? '' : 'no' }); track('period_marked', { value: f.period === 'no' ? 'cleared' : 'no' }); },
      setPerYes: () => { this.setForm({ period: f.period === 'yes' ? '' : 'yes' }); track('period_marked', { value: f.period === 'yes' ? 'cleared' : 'yes' }); },
      ff: { hasPhoto: !!f.photo, photo: f.photo }, fp: { ...fp, tint: TINT[fp.tone] || TINT.mild, fiberTxt: String(fp.fiber).replace('.', ',') },
      foodPick: f.food === 'pick', foodScan: f.food === 'scan', foodDone: f.food === 'done',
      onPhoto: (e) => { const file = e.target.files && e.target.files[0]; e.target.value = ''; if (file) this.startScan(file, 'photo'); },
      tryDemo: () => this.startScan(null, 'example'),
      resetFood: () => { clearTimeout(this._scan); this._scanId = null; this.setForm({ food: 'pick', photo: '', result: null }); track('food_removed'); },
      save: () => this.save(),
      prevIdx: cur ? cur.idx + '%' : '—', previewIdx: pv ? pv.idx + '%' : '—',

      // инсайты
      weekLbl, avgIdx, avgTone: this.toneOf(avgIdx), avgWord: word[this.toneOf(idxN ? avgIdx : null)], bars,
      normPct: total ? Math.round(norm / total * 100) : 0, symDays, fiberAvg: fibN ? (fibSum / fibN).toFixed(1).replace('.', ',') : '0',
      noticed,
      sugs: ['Что съесть на ужин?', 'Почему было вздутие?'].map((qq) => ({ q: qq, pick: () => this.ask(qq, 'suggestion') })),
      aiQ: s.aiQ, aiA: s.aiLoading ? 'Думаю…' : s.aiA, hasAiA: !!s.aiQ, aiCls: 'card' + (s.aiLoading ? ' pulse' : ''), askText: s.askText,
      onAsk: (e) => this.setState({ askText: e.target.value }),
      sendAsk: () => { const q = s.askText.trim(); if (q && !s.aiLoading) this.ask(q, 'custom'); },

      toast: s.toast, hasToast: !!s.toast
    };
  }
}
