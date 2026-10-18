// Корневой компонент: состояние приложения и все действия пользователя.
// Что показывать на экране, считают view-функции из src/views (по одной на экран).
// Каждое действие само отправляет своё событие аналитики (словарь — docs/ANALYTICS.md).

import { Component } from '../core/runtime.js';
import { newId } from '../core/id.js';
import { APP_NAME, LEGAL_DOCS, LEGAL_VERSION, IS_DEMO } from '../config.js';
import { keyOf, addDays, nowHM } from '../domain/dates.js';
import { AGE_MIN, AGE_MAX, CYCLE_LEN_MIN, CYCLE_LEN_MAX, EXAMPLE_MEALS, SYMPTOM_OK } from '../domain/catalog.js';
import { gutScore, emptyDay, hasData } from '../domain/score.js';
import { blankProfile, profileTraits, onboardingFlow, goalLabels } from '../domain/profile.js';
import { buildAiContext, aiContextHash } from '../domain/ai-context.js';
import { DEMO_TODAY, demoLog, demoProfile, DEMO_ANSWERS, DEMO_ANSWER_DEFAULT } from '../domain/demo.js';
import * as store from '../services/store.js';
import { track, flush, identifyUser, setPersonProps, setScreen, resetAnalytics } from '../services/analytics.js';
import { analyzeFood, askAI, getInsights } from '../services/ai.js';
import { compressImage } from '../services/image.js';
import { exportCSV, openDoctorReport } from '../services/export.js';
import { signOut } from '../services/supabase.js';
import { VIEWS, shellView } from '../views/index.js';

const LS_INSIGHTS = 'gt_insights';
const TOAST_MS = 2200;
const EXAMPLE_SCAN_MS = 1600;
const PROFILE_SAVE_DELAY_MS = 700;
const DRUM_ROW_PX = 40;

/** Имена экранов в аналитике */
const SCREEN_EVENT_NAME = { today: 'today', add: 'add_entry', insights: 'insights', profile: 'profile' };

const blankForm = () => ({
  stool: '',          // '' | 'had' | 'none'
  type: 4,            // тип по Бристольской шкале
  sym: [],            // симптомы
  period: '',         // '' | 'yes' | 'no'
  food: 'pick',       // 'pick' — выбор фото, 'scan' — ИИ разбирает, 'done' — результат
  photo: '',          // blob-ссылка для превью
  result: null,       // разбор блюда
  source: ''          // 'photo' | 'example'
});

function readInsightsCache() {
  try { return JSON.parse(localStorage.getItem(LS_INSIGHTS) || 'null'); } catch (_) { return null; }
}

export default class App extends Component {
  constructor(props) {
    super(props);
    let screen = 'onboarding', profile = blankProfile(), log = {};

    if (IS_DEMO) {
      // /?demo#today и т.п. открывает нужный экран с тестовым профилем, /?demo — онбординг
      log = demoLog();
      const hash = location.hash.slice(1) === 'home' ? 'today' : location.hash.slice(1);
      if (VIEWS[hash] && hash !== 'onboarding') { screen = hash; profile = demoProfile(); }
    } else {
      const local = store.loadLocal();
      if (local && local.profile) {
        profile = { ...blankProfile(), ...local.profile };
        log = local.log || {};
        if (profile.onboardedAt) screen = 'today';
      }
    }

    this.state = {
      screen,
      onbStep: 'welcome', onbSkipped: false, consent: false,
      profile, log,
      selected: this.today(),
      form: blankForm(),
      ai: { question: '', answer: '', loading: false },
      askText: '',
      insights: readInsightsCache(), insightsLoading: false,
      toast: '',
      exampleN: 0
    };
    this.onboardingStartedAt = Date.now();

    // ref-колбэки для шаблона
    this.setScrollEl = (el) => { this.scrollEl = el; };
    this.setAgeDrum = (el) => {
      if (el && el !== this.ageDrum) el.scrollTop = (this.state.profile.age - AGE_MIN) * DRUM_ROW_PX;
      this.ageDrum = el;
    };
  }

  // ================= жизненный цикл =================

  async componentDidMount() {
    this.onScreenShown();
    await identifyUser();
    track('app_opened', { is_returning: !!this.state.profile.onboardedAt, local_days: Object.keys(this.state.log).length });
    if (IS_DEMO) return;

    const remote = await store.loadRemote(this.today());
    if (!remote) return;
    const s = this.state;
    const patch = { log: store.mergeLogs(s.log, remote.log) };
    if (remote.profile && remote.profile.onboardedAt) {
      patch.profile = { ...s.profile, ...remote.profile };
      if (s.screen === 'onboarding' && s.onbStep === 'welcome') patch.screen = 'today';
    } else if (s.profile.onboardedAt) {
      store.saveProfile(s.profile, this.today()); // профиль был только на устройстве — догружаем на сервер
    }
    this.setState(patch);
    const p = patch.profile || s.profile;
    if (p.onboardedAt) setPersonProps(profileTraits(p));
  }

  componentDidUpdate(prev) {
    const s = this.state;
    if (prev.screen !== s.screen || prev.onbStep !== s.onbStep) {
      if (this.scrollEl) this.scrollEl.scrollTop = 0;
      this.onScreenShown();
    }
    if ((prev.log !== s.log || prev.profile !== s.profile) && s.profile.onboardedAt) store.saveLocal(s.profile, s.log);
  }

  onScreenShown() {
    const s = this.state;
    if (s.screen === 'onboarding') {
      setScreen('onboarding_' + s.onbStep);
      track('onboarding_step_viewed', { step: s.onbStep, step_index: this.onboardingFlow().indexOf(s.onbStep) + 1 });
      return;
    }
    setScreen(SCREEN_EVENT_NAME[s.screen]);
    track('screen_viewed', { screen_name: SCREEN_EVENT_NAME[s.screen] });
    if (s.screen === 'today' || s.screen === 'insights') this.refreshInsights();
  }

  view() {
    return { ...shellView(this), ...VIEWS[this.state.screen](this) };
  }

  // ================= данные =================

  today() { return IS_DEMO ? DEMO_TODAY : keyOf(new Date()); }

  /** Запись дня (всегда с полями gut / meals / period) */
  day(k) { return { ...emptyDay(), ...(this.state.log[k] || {}) }; }

  /** Запись дня с учётом заполненной формы «+». Возвращает { day, gut, meal } — добавленные записи. */
  draftDay(base) {
    const f = this.state.form, time = IS_DEMO ? '14:46' : nowHM();
    const day = { gut: [...base.gut], meals: [...base.meals], period: f.period ? f.period === 'yes' : base.period };
    let gut = null, meal = null;
    if (f.stool || f.sym.length) {
      gut = { id: newId(), time, type: f.stool === 'had' ? f.type : f.stool === 'none' ? 0 : -1, sym: [...f.sym] };
      day.gut.push(gut);
    }
    if (f.food === 'done' && f.result) {
      meal = { id: newId(), time, ...f.result, photo: f.photo, source: f.source };
      day.meals.push(meal);
    }
    return { day, gut, meal };
  }

  onboardingFlow() { return onboardingFlow(this.state.profile, this.state.onbSkipped); }

  // ================= общее =================

  showToast(message) {
    clearTimeout(this.toastTimer);
    this.setState({ toast: message });
    this.toastTimer = setTimeout(() => this.setState({ toast: '' }), TOAST_MS);
  }

  navigate(screen, source = 'tab') {
    if (this.state.screen === screen) return;
    track('nav_clicked', { to: SCREEN_EVENT_NAME[screen], from: SCREEN_EVENT_NAME[this.state.screen], source });
    this.setState({ screen });
  }

  selectDay(k, daysAgo, withData) {
    if (k === this.state.selected) return;
    this.setState({ selected: k });
    track('day_selected', { days_ago: daysAgo, has_data: withData });
  }

  openLegalDoc(doc, source) { track('legal_doc_opened', { doc, source }); }
  openSupport() { track('support_clicked', { source: 'profile' }); }

  // ================= онбординг =================

  startOnboarding() {
    this.onboardingStartedAt = Date.now();
    track('onboarding_started');
    this.setState({ onbStep: 'consent', onbSkipped: false });
  }

  /** «Пропустить» на приветствии: без анкеты, но согласие с документами обязательно */
  skipOnboarding() {
    track('onboarding_skipped', { step: 'welcome' });
    this.setState({ onbStep: 'consent', onbSkipped: true });
  }

  onboardingBack() {
    const flow = this.onboardingFlow(), i = flow.indexOf(this.state.onbStep);
    track('onboarding_back', { step: this.state.onbStep });
    this.setState(i > 0 ? { onbStep: flow[i - 1] } : { onbStep: 'welcome', onbSkipped: false });
  }

  toggleConsent() {
    const checked = !this.state.consent;
    this.setState({ consent: checked });
    track('consent_checkbox_toggled', { checked });
  }

  /** «Дальше». На шаге цикла: cycleAnswer — «Да, учитывать» (true) или «Не сейчас» (false). */
  onboardingNext(cycleAnswer) {
    const s = this.state, p = s.profile, step = s.onbStep;
    const flow = this.onboardingFlow(), i = flow.indexOf(step);

    if (step === 'consent') {
      if (!s.consent) { this.showToast('Нужно согласие с документами'); track('consent_blocked'); return; }
      track('consent_accepted', { version: LEGAL_VERSION, documents: Object.keys(LEGAL_DOCS) });
      if (!IS_DEMO) store.saveConsents(Object.keys(LEGAL_DOCS), LEGAL_VERSION);
    }
    if (step === 'about' && (!p.name.trim() || !p.sex)) {
      this.showToast('Укажите имя и пол');
      track('onboarding_validation_error', { step, missing: [!p.name.trim() && 'name', !p.sex && 'sex'].filter(Boolean) });
      return;
    }

    const props = { step };
    if (step === 'about') Object.assign(props, { sex: p.sex, age: p.age });
    if (step === 'goals') Object.assign(props, { goals: p.goals, goals_count: p.goals.length, has_custom_goal: !!p.other.trim() });
    if (step === 'cycle') Object.assign(props, { cycle_enabled: cycleAnswer, last_period: p.lastUnknown ? 'unknown' : p.lastAgo });
    track('onboarding_step_completed', props);

    if (i < flow.length - 1) this.setState({ onbStep: flow[i + 1] });
    else this.finishOnboarding({ cycle: step === 'cycle' ? cycleAnswer : false });
  }

  finishOnboarding(extra) {
    const s = this.state, todayK = this.today();
    const profile = { ...s.profile, ...extra, onboardedAt: new Date().toISOString(), since: s.profile.since || todayK };
    this.setState({ profile, screen: 'today', onbStep: 'welcome', onbSkipped: false, selected: todayK });
    if (!IS_DEMO) store.saveProfile(profile, todayK);
    identifyUser(profileTraits(profile));
    track('onboarding_completed', {
      ...profileTraits(profile),
      skipped: s.onbSkipped,
      duration_sec: Math.round((Date.now() - this.onboardingStartedAt) / 1000)
    });
    flush();
  }

  // ================= профиль =================

  /** Меняет профиль. В онбординге только в памяти; после — с отложенным сохранением в Supabase. */
  updateProfile(patch, field) {
    this.setState({ profile: { ...this.state.profile, ...patch } });
    if (this.state.screen === 'onboarding' || IS_DEMO) return;
    this.dirtyFields = this.dirtyFields || new Set();
    if (field) this.dirtyFields.add(field);
    clearTimeout(this.profileSaveTimer);
    this.profileSaveTimer = setTimeout(() => {
      const fields = [...this.dirtyFields];
      this.dirtyFields.clear();
      const p = this.state.profile;
      store.saveProfile(p, this.today());
      setPersonProps(profileTraits(p));
      track('profile_updated', { fields });
    }, PROFILE_SAVE_DELAY_MS);
  }

  setName(raw) {
    const v = raw.replace(/^\s+/, '');
    this.updateProfile({ name: v.charAt(0).toUpperCase() + v.slice(1) }, 'name');
  }

  setAge(age) {
    age = Math.min(AGE_MAX, Math.max(AGE_MIN, age));
    if (age !== this.state.profile.age) this.updateProfile({ age }, 'age');
  }

  onAgeDrumScroll(scrollTop) { this.setAge(AGE_MIN + Math.round(scrollTop / DRUM_ROW_PX)); }
  scrollAgeDrumTo(age) { if (this.ageDrum) this.ageDrum.scrollTo({ top: (age - AGE_MIN) * DRUM_ROW_PX, behavior: 'smooth' }); }

  setSex(sex) { this.updateProfile(sex === 'm' ? { sex, cycle: false } : { sex }, 'sex'); }

  toggleGoal(id) {
    const goals = this.state.profile.goals;
    this.updateProfile({ goals: goals.includes(id) ? goals.filter((g) => g !== id) : [...goals, id] }, 'goals');
  }

  /** daysAgo = null — «не помню» */
  setLastPeriod(daysAgo) {
    this.updateProfile(daysAgo == null ? { lastUnknown: true } : { lastUnknown: false, lastAgo: Math.min(60, Math.max(0, daysAgo)) }, 'cycle_last');
  }

  setCycleLength(len) { this.updateProfile({ len: Math.min(CYCLE_LEN_MAX, Math.max(CYCLE_LEN_MIN, len)) }, 'cycle_length'); }

  toggleCycle() {
    const enabled = !this.state.profile.cycle;
    this.updateProfile({ cycle: enabled, lastUnknown: false }, 'cycle');
    track('cycle_toggled', { enabled });
  }

  toggleReminder(slot) {
    const key = slot === 'morning' ? 'am' : 'pm', enabled = !this.state.profile[key];
    this.updateProfile({ [key]: enabled }, 'reminder_' + key);
    track('reminder_toggled', { slot, enabled });
  }

  exportCsv() {
    const rows = exportCSV(this.state.log);
    this.showToast('Файл CSV скачан');
    track('export_clicked', { format: 'csv', rows });
  }

  exportDoctorReport() {
    openDoctorReport(this.state.profile, this.state.log, APP_NAME);
    track('export_clicked', { format: 'pdf_report', days: Object.keys(this.state.log).length });
  }

  async deleteAllData() {
    if (!window.confirm('Удалить все данные? Записи, профиль и история будут удалены без возможности восстановления.')) {
      track('data_delete_cancelled');
      return;
    }
    track('data_deleted');
    await flush();
    const ok = IS_DEMO ? true : await store.wipeAll();
    resetAnalytics();
    if (!IS_DEMO) await signOut();
    this.onboardingStartedAt = Date.now();
    this.setState({
      screen: 'onboarding', onbStep: 'welcome', onbSkipped: false, consent: false,
      profile: blankProfile(), log: {}, form: blankForm(), insights: null,
      ai: { question: '', answer: '', loading: false }
    });
    this.showToast(ok ? 'Данные удалены' : 'Удалено на устройстве, сервер не ответил');
  }

  // ================= запись дня (экран «+») =================

  setForm(patch) { this.setState({ form: { ...this.state.form, ...patch } }); }

  /** «Был» / «Не было»; повторное нажатие снимает выбор */
  setStool(value) {
    const v = this.state.form.stool === value ? '' : value;
    this.setForm({ stool: v });
    track('stool_status_selected', { value: v || 'cleared' });
  }

  pickBristolType(n) {
    this.setForm({ type: n });
    track('bristol_type_selected', { bristol_type: n });
  }

  toggleSymptom(label) {
    const sym = this.state.form.sym, on = sym.includes(label);
    let next;
    if (label === SYMPTOM_OK) next = on ? [] : [SYMPTOM_OK];
    else next = on ? sym.filter((x) => x !== label) : [...sym.filter((x) => x !== SYMPTOM_OK), label];
    this.setForm({ sym: next });
    track('symptom_toggled', { symptom: label, selected: !on });
  }

  setPeriodMark(value) {
    const v = this.state.form.period === value ? '' : value;
    this.setForm({ period: v });
    track('period_marked', { value: v || 'cleared' });
  }

  /** «Попробовать на примере» (и любое фото в демо): готовое блюдо без запроса к ИИ */
  tryExampleMeal(source = 'example') {
    const n = this.state.exampleN, result = EXAMPLE_MEALS[n % EXAMPLE_MEALS.length];
    this.setState({ form: { ...this.state.form, food: 'scan', photo: '', result: null, source }, exampleN: n + 1 });
    track('food_photo_added', { source });
    clearTimeout(this.exampleTimer);
    this.exampleTimer = setTimeout(() => {
      this.setForm({ food: 'done', result });
      track('food_analysis_completed', { source, verdict: result.verdict, tone: result.tone, kcal: result.kcal, fiber: result.fiber, latency_ms: EXAMPLE_SCAN_MS });
    }, EXAMPLE_SCAN_MS);
  }

  async addFoodPhoto(file) {
    if (IS_DEMO) { this.tryExampleMeal('photo'); return; }
    let preview = '';
    try { preview = URL.createObjectURL(file); } catch (_) { /* превью не обязательно */ }
    const scanId = (this.scanId = newId());
    this.setForm({ food: 'scan', photo: preview, result: null, source: 'photo' });
    track('food_photo_added', { source: 'photo', file_type: file.type, size_kb: Math.round(file.size / 1024) });

    const startedAt = Date.now();
    const fail = (reason, message) => {
      this.setForm({ food: 'pick', photo: '' });
      this.showToast(message);
      track('food_analysis_failed', { reason, latency_ms: Date.now() - startedAt });
    };
    try {
      const r = await analyzeFood(await compressImage(file), goalLabels(this.state.profile));
      if (this.scanId !== scanId) return; // фото уже убрали
      if (r.is_food === false) { fail('not_food', 'Не похоже на еду — попробуйте другое фото'); return; }
      const result = {
        name: r.name, kcal: Math.round(r.kcal) || 0, fiber: Math.round((r.fiber || 0) * 10) / 10,
        verdict: r.verdict, tone: ['calm', 'mild', 'sens'].includes(r.tone) ? r.tone : 'mild', tip: r.tip
      };
      this.setForm({ food: 'done', result });
      track('food_analysis_completed', { source: 'photo', verdict: result.verdict, tone: result.tone, kcal: result.kcal, fiber: result.fiber, latency_ms: Date.now() - startedAt });
    } catch (e) {
      if (this.scanId === scanId) fail(String(e.message || e).slice(0, 120), 'Не получилось разобрать фото');
    }
  }

  removeFood() {
    clearTimeout(this.exampleTimer);
    this.scanId = null;
    this.setForm({ food: 'pick', photo: '', result: null });
    track('food_removed');
  }

  saveEntry() {
    const f = this.state.form, k = this.today();
    if (!f.stool && !f.sym.length && f.food !== 'done' && !f.period) {
      this.showToast('Отметьте хоть что-нибудь');
      track('entry_save_blocked', { reason: 'empty' });
      return;
    }
    const before = this.day(k), scoreBefore = gutScore(before);
    const { day, gut, meal } = this.draftDay(before);
    const scoreAfter = gutScore(day);
    const isFirstEntry = !Object.values(this.state.log).some(hasData);
    const log = { ...this.state.log, [k]: day };

    this.setState({ log, form: blankForm(), screen: 'today', selected: k });
    this.showToast('Сохранено');

    if (!IS_DEMO) {
      if (gut) store.addGutEntry(k, gut);
      if (meal) store.addMeal(k, meal);
      if (f.period) store.setPeriodDay(k, f.period === 'yes');
    }

    const props = {
      stool_status: f.stool || 'not_set',
      bristol_type: f.stool === 'had' ? f.type : null,
      symptoms: f.sym,
      symptoms_count: f.sym.filter((x) => x !== SYMPTOM_OK).length,
      has_food: !!meal,
      food_source: meal ? meal.source : null,
      food_tone: meal ? meal.tone : null,
      period_mark: f.period || null,
      gut_score: scoreAfter ? scoreAfter.idx : null,
      score_before: scoreBefore ? scoreBefore.idx : null,
      score_delta: scoreAfter && scoreBefore ? scoreAfter.idx - scoreBefore.idx : null,
      days_logged_last7: [0, 1, 2, 3, 4, 5, 6].filter((i) => hasData(log[addDays(k, -i)])).length,
      hour: new Date().getHours()
    };
    track('entry_saved', props);
    if (isFirstEntry) track('first_entry_saved', props);
    flush();
  }

  // ================= ИИ =================

  async ask(question, source) {
    if (!question || this.state.ai.loading) return;
    this.setState({ ai: { question, answer: '', loading: true }, askText: '' });
    track('ai_question_asked', { source, length: question.length });

    if (IS_DEMO) {
      const hit = Object.keys(DEMO_ANSWERS).find((k) => question.toLowerCase().includes(k));
      setTimeout(() => this.setState({ ai: { question, answer: hit ? DEMO_ANSWERS[hit] : DEMO_ANSWER_DEFAULT, loading: false } }), 700);
      return;
    }
    const startedAt = Date.now();
    try {
      const r = await askAI(question, buildAiContext(this.state.profile, this.state.log, this.today()));
      if (this.state.ai.question !== question) return;
      this.setState({ ai: { question, answer: r.answer, loading: false } });
      track('ai_answer_received', { source, latency_ms: Date.now() - startedAt, answer_length: (r.answer || '').length });
    } catch (e) {
      this.setState({ ai: { question, answer: 'Не получилось получить ответ. Попробуйте ещё раз чуть позже.', loading: false } });
      track('ai_answer_failed', { source, error: String(e.message || e).slice(0, 120) });
    }
  }

  /** «Совет на сегодня» и «ИИ заметил». Кэшируется до изменения данных или до следующего дня. */
  async refreshInsights() {
    const s = this.state;
    if (IS_DEMO || s.insightsLoading || !s.profile.onboardedAt) return;
    const ctx = buildAiContext(s.profile, s.log, this.today());
    if (!ctx.days.length) return;
    const hash = aiContextHash(ctx);
    if (s.insights && s.insights.hash === hash) return;

    this.setState({ insightsLoading: true });
    const startedAt = Date.now();
    try {
      const r = await getInsights(ctx);
      const insights = { hash, date: ctx.today, tipTitle: r.tip_title, tipText: r.tip_text, noticed: r.noticed };
      try { localStorage.setItem(LS_INSIGHTS, JSON.stringify(insights)); } catch (_) { /* кэш не обязателен */ }
      this.setState({ insights, insightsLoading: false });
      track('ai_insights_generated', { latency_ms: Date.now() - startedAt, days_count: ctx.days.length });
    } catch (e) {
      this.setState({ insightsLoading: false });
      track('ai_insights_failed', { error: String(e.message || e).slice(0, 120) });
    }
  }
}
