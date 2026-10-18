// Корневой компонент: состояние приложения и все действия пользователя.
// Что показывать на экране, считают view-функции из src/views (по одной на экран).
// Каждое действие само отправляет своё событие аналитики (словарь — docs/ANALYTICS.md).

import { Component } from '../core/runtime.js';
import { newId } from '../core/id.js';
import { APP_NAME, SUPPORT_URL, LEGAL_DOCS, LEGAL_VERSION, IS_DEMO } from '../config.js';
import { keyOf, addDays, nowHM } from '../domain/dates.js';
import { AGE_MIN, AGE_MAX, CYCLE_LEN_MIN, CYCLE_LEN_MAX, EXAMPLE_MEALS, SYMPTOM_OK } from '../domain/catalog.js';
import { gutScore, emptyDay, hasData } from '../domain/score.js';
import { blankProfile, profileTraits, onboardingFlow, goalLabels } from '../domain/profile.js';
import { buildAiContext, aiContextHash } from '../domain/ai-context.js';
import { normalizeMeal } from '../domain/meal.js';
import { splitSentences } from '../domain/text.js';
import { DEMO_TODAY, demoLog, demoProfile, DEMO_ANSWERS, DEMO_ANSWER_DEFAULT } from '../domain/demo.js';
import * as store from '../services/store.js';
import { track, flush, identifyUser, setPersonProps, setScreen, resetAnalytics } from '../services/analytics.js';
import { analyzeFood, askAI, getInsights } from '../services/ai.js';
import { compressImage } from '../services/image.js';
import { exportCSV, openDoctorReport } from '../services/export.js';
import { isTelegram, openTelegramLink, syncBackButton, telegramUser } from '../services/telegram.js';
import { loadLegalHtml, legalIdByHref } from '../services/legal.js';
import { supabase, signOut } from '../services/supabase.js';
import { VIEWS, shellView } from '../views/index.js';

const LS_INSIGHTS = 'gt_insights';
const TOAST_MS = 3500;
const EXAMPLE_SCAN_MS = 1600;
const PROFILE_SAVE_DELAY_MS = 700;
const DRUM_ROW_PX = 40;
const BOOT_TIMEOUT_MS = 6000;
const SENTENCE_DELAY_MS = 900;

/** Имена экранов в аналитике */
const SCREEN_EVENT_NAME = { today: 'today', add: 'add_entry', insights: 'insights', profile: 'profile' };

const blankForm = () => ({
  stool: '',          // '' | 'had' | 'none'
  type: 4,            // тип по Бристольской шкале
  sym: [],            // симптомы
  color: '',          // цвет стула (id из STOOL_COLORS), только если стул был
  stress: null,       // стресс 0–10; null — не отмечали
  period: '',         // '' | 'yes' | 'no'
  food: 'pick',       // 'pick' — фото и/или описание, 'scan' — ИИ разбирает, 'done' — результат
  photo: '',          // blob-ссылка на фото (только в текущей сессии)
  note: '',           // комментарий к блюду: что на тарелке, порция
  result: null,       // разбор блюда (src/domain/meal.js)
  source: '',         // 'photo' | 'text'
  fixOpen: false,     // открыто поле «Уточнить»
  fix: '',            // текст уточнения
  fixing: false       // идёт пересчёт
});

const isTextField = (el) => !!el && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && el.type === 'text'));

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
      if (['today', 'add', 'insights', 'profile'].includes(hash)) { screen = hash; profile = demoProfile(); }
    } else {
      const local = store.loadLocal();
      if (local && local.profile) {
        profile = { ...blankProfile(), ...local.profile };
        log = local.log || {};
        if (profile.onboardedAt) screen = 'today';
      }
    }

    // В Telegram подставляем имя из аккаунта; аватар берём оттуда же (не сохраняем)
    const tg = telegramUser();
    if (tg && !profile.name && tg.first_name) profile = { ...profile, name: tg.first_name };

    this.state = {
      screen,
      // Пока проверяем, есть ли профиль на сервере, — показываем загрузку, а не онбординг
      booting: !IS_DEMO && !!supabase && !profile.onboardedAt,
      onbStep: 'consent', consent: false,
      legal: null,        // открытый документ: { id, title, html, error }
      assistant: false,   // открыта панель ИИ-помощника
      chat: [],           // диалог: [{ role: 'user' | 'ai', text, shown?, image? }]; shown — сколько текста уже показано
      chatLoading: false,
      chatImage: '',      // фото, приложенное к следующему вопросу (blob-ссылка)
      entryEdit: null,    // правка записи о стуле: { day, id, draft }
      mealEdit: null,     // открытое сохранённое блюдо: { day, id, fix, fixing }
      keyboard: false,    // в фокусе текстовое поле — прячем нижнее меню
      avatarUrl: (tg && tg.photo_url) || '',
      profile, log,
      selected: this.today(),
      form: blankForm(),
      askText: '',
      insights: readInsightsCache(), insightsLoading: false,
      toast: '',
      exampleN: 0
    };
    this.onboardingStartedAt = Date.now();
    this.handleBack = () => this.back();

    // ref-колбэки для шаблона
    this.setScrollEl = (el) => { this.scrollEl = el; };
    this.setAgeDrum = (el) => {
      if (el && el !== this.ageDrum) el.scrollTop = (this.state.profile.age - AGE_MIN) * DRUM_ROW_PX;
      this.ageDrum = el;
    };
  }

  // ================= жизненный цикл =================

  async componentDidMount() {
    // Клавиатура на телефоне: пока печатают, нижнее меню не должно перекрывать поле ввода
    document.addEventListener('focusin', (e) => { if (isTextField(e.target)) this.setState({ keyboard: true }); });
    document.addEventListener('focusout', (e) => {
      if (isTextField(e.target)) setTimeout(() => { if (!isTextField(document.activeElement)) this.setState({ keyboard: false }); }, 50);
    });

    if (!this.state.booting) this.onScreenShown();
    const bootTimer = setTimeout(() => this.finishBoot({}), BOOT_TIMEOUT_MS);
    await identifyUser();
    track('app_opened', { is_returning: !!this.state.profile.onboardedAt, local_days: Object.keys(this.state.log).length });
    if (IS_DEMO) return;

    const remote = await store.loadRemote(this.today());
    clearTimeout(bootTimer);
    if (!remote) { this.finishBoot({}); return; }
    const s = this.state;
    const patch = { log: store.mergeLogs(s.log, remote.log) };
    if (remote.profile && remote.profile.onboardedAt) {
      // Профиль уже есть на сервере — онбординг не нужен (если человек ещё не начал его заполнять)
      patch.profile = { ...s.profile, ...remote.profile };
      if (s.screen === 'onboarding' && s.onbStep === 'consent' && !s.consent) patch.screen = 'today';
    } else if (s.profile.onboardedAt) {
      store.saveProfile(s.profile, this.today()); // профиль был только на устройстве — догружаем на сервер
    }
    this.finishBoot(patch);
    const p = patch.profile || s.profile;
    if (p.onboardedAt) setPersonProps(profileTraits(p));
  }

  /** Снимает экран загрузки и применяет данные с сервера */
  finishBoot(patch) {
    const wasBooting = this.state.booting;
    if (!wasBooting && !Object.keys(patch).length) return;
    this.setState({ ...patch, booting: false });
    if (wasBooting && (patch.screen || this.state.screen) === 'onboarding') track('onboarding_started');
  }

  componentDidUpdate(prev) {
    const s = this.state;
    if (prev.screen !== s.screen || prev.onbStep !== s.onbStep || prev.booting !== s.booting ||
        !!prev.legal !== !!s.legal || !!prev.mealEdit !== !!s.mealEdit || !!prev.entryEdit !== !!s.entryEdit) {
      if (this.scrollEl) this.scrollEl.scrollTop = 0;
      this.onScreenShown();
    } else if (prev.assistant !== s.assistant) {
      // панель ИИ открывается поверх — экран под ней не прокручиваем
      syncBackButton(this.canGoBack(), this.handleBack);
      if (s.assistant) setScreen('assistant');
    }
    if ((prev.log !== s.log || prev.profile !== s.profile) && s.profile.onboardedAt) store.saveLocal(s.profile, s.log);
  }

  onScreenShown() {
    const s = this.state;
    if (s.booting) return;
    syncBackButton(this.canGoBack(), this.handleBack);
    if (s.legal) { setScreen('legal_' + s.legal.id); return; }
    if (s.assistant) { setScreen('assistant'); return; }
    if (s.mealEdit) { setScreen('meal'); return; }
    if (s.entryEdit) { setScreen('entry'); return; }
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
    const s = this.state;
    // Поверх экранов: загрузка → документ → блюдо → запись. ИИ-помощник — выезжающая панель поверх всего.
    const screen = s.booting ? 'booting' : s.legal ? 'legal' : s.mealEdit ? 'meal' : s.entryEdit ? 'entry' : s.screen;
    return {
      ...shellView(this, screen),
      ...(VIEWS[screen] ? VIEWS[screen](this) : {}),
      ...(s.assistant ? VIEWS.assistant(this) : {})
    };
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
    if (f.stool || f.sym.length || f.stress != null) {
      gut = this.gutFromDraft(f, { id: newId(), time });
      day.gut.push(gut);
    }
    if (f.food === 'done' && f.result) {
      meal = { id: newId(), time, ...f.result, note: f.note.trim(), photo: f.photo, source: f.source };
      day.meals.push(meal);
    }
    return { day, gut, meal };
  }

  onboardingFlow() { return onboardingFlow(this.state.profile); }

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

  /** Стрелки «‹ Сегодня ›»: на день назад или вперёд в пределах [начало использования, сегодня] */
  shiftDay(delta) {
    const k = addDays(this.state.selected, delta), since = (this.state.profile.since || '').slice(0, 10);
    if (k > this.today() || (since && k < since)) return;
    this.setState({ selected: k });
    track('day_selected', { days_ago: Math.round((new Date(this.today()) - new Date(k)) / 864e5), direction: delta > 0 ? 'next' : 'prev' });
  }

  selectDay(k, daysAgo, withData) {
    if (k === this.state.selected) return;
    this.setState({ selected: k });
    track('day_selected', { days_ago: daysAgo, has_data: withData });
  }

  /** Есть ли куда вернуться: документ, профиль, не первый шаг онбординга */
  canGoBack() {
    const s = this.state;
    if (s.legal || s.mealEdit || s.entryEdit || s.assistant || s.screen === 'profile') return true;
    return s.screen === 'onboarding' && this.onboardingFlow().indexOf(s.onbStep) > 0;
  }

  /** «Назад» — и кнопка в интерфейсе, и нативная кнопка Telegram */
  back() {
    const s = this.state;
    if (s.assistant) this.closeAssistant();
    else if (s.legal) this.closeLegalDoc();
    else if (s.mealEdit) this.closeMeal();
    else if (s.entryEdit) this.closeEntry();
    else if (s.screen === 'profile') this.navigate('today', 'back');
    else if (s.screen === 'onboarding') this.onboardingBack();
  }

  /** Документ открывается внутри приложения поверх текущего экрана */
  async openLegalDoc(doc, source, event) {
    if (event) event.preventDefault();
    track('legal_doc_opened', { doc, source });
    this.setState({ legal: { id: doc, title: LEGAL_DOCS[doc].title, html: '', error: '' } });
    try {
      const html = await loadLegalHtml(doc);
      if (this.state.legal && this.state.legal.id === doc) this.setState({ legal: { ...this.state.legal, html } });
    } catch (e) {
      if (this.state.legal) this.setState({ legal: { ...this.state.legal, error: 'Не получилось загрузить документ' } });
    }
  }

  closeLegalDoc() { this.setState({ legal: null }); }

  /** Клик по ссылке внутри документа: другие документы — в приложении, остальное — наружу */
  onLegalLinkClick(event) {
    const a = event.target.closest && event.target.closest('a[href]');
    if (!a) return;
    const id = legalIdByHref(a.getAttribute('href'));
    if (id) { this.openLegalDoc(id, 'legal_link', event); return; }
    if (isTelegram()) openTelegramLink(a.href, event, a.href.startsWith('https://t.me/'));
    else { event.preventDefault(); window.open(a.href, '_blank', 'noopener'); }
  }
  openSupport(event) {
    track('support_clicked', { source: 'profile' });
    openTelegramLink(SUPPORT_URL, event, true);
  }

  // ================= онбординг =================

  onboardingBack() {
    const flow = this.onboardingFlow(), i = flow.indexOf(this.state.onbStep);
    if (i <= 0) return;
    track('onboarding_back', { step: this.state.onbStep });
    this.setState({ onbStep: flow[i - 1] });
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
      if (!s.consent) { this.showToast('Отметьте согласие, чтобы продолжить'); track('consent_blocked'); return; }
      track('consent_accepted', { version: LEGAL_VERSION, documents: Object.keys(LEGAL_DOCS) });
      if (!IS_DEMO) store.saveConsents(Object.keys(LEGAL_DOCS), LEGAL_VERSION);
    }
    if (step === 'about' && (!p.name.trim() || !p.sex)) {
      this.showToast('Напишите имя и выберите пол');
      track('onboarding_validation_error', { step, missing: [!p.name.trim() && 'name', !p.sex && 'sex'].filter(Boolean) });
      return;
    }

    const props = { step };
    if (step === 'about') Object.assign(props, { sex: p.sex, age: p.age });
    if (step === 'goals') Object.assign(props, { goals: p.goals, goals_count: p.goals.length, has_custom_goal: !!p.other.trim() });
    if (step === 'cycle') Object.assign(props, { cycle_enabled: cycleAnswer, last_period: p.lastUnknown ? 'unknown' : p.lastAgo, pregnant: !!p.pregnant, coc: !!p.coc });
    track('onboarding_step_completed', props);

    if (i < flow.length - 1) this.setState({ onbStep: flow[i + 1] });
    else this.finishOnboarding({ cycle: step === 'cycle' ? cycleAnswer : false });
  }

  finishOnboarding(extra) {
    const s = this.state, todayK = this.today();
    const profile = { ...s.profile, ...extra, onboardedAt: new Date().toISOString(), since: s.profile.since || todayK };
    this.setState({ profile, screen: 'today', onbStep: 'consent', selected: todayK });
    if (!IS_DEMO) store.saveProfile(profile, todayK);
    identifyUser(profileTraits(profile));
    track('onboarding_completed', {
      ...profileTraits(profile),
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

  /** Беременность или приём КОК (option: 'pregnant' | 'coc') */
  toggleCycleOption(option) {
    const enabled = !this.state.profile[option];
    this.updateProfile({ [option]: enabled }, option);
    track('cycle_option_toggled', { option, enabled });
  }

  toggleReminder(slot) {
    const key = slot === 'morning' ? 'am' : 'pm', enabled = !this.state.profile[key];
    this.updateProfile({ [key]: enabled }, 'reminder_' + key);
    track('reminder_toggled', { slot, enabled });
  }

  exportCsv() {
    if (isTelegram()) {
      track('export_clicked', { format: 'csv' });
      this.showToast('Откройте приложение в браузере, чтобы скачать файл');
      return;
    }
    const rows = exportCSV(this.state.log);
    this.showToast('Файл CSV скачан');
    track('export_clicked', { format: 'csv', rows });
  }

  exportDoctorReport() {
    if (isTelegram()) this.showToast('Откройте приложение в браузере, чтобы скачать файл');
    else openDoctorReport(this.state.profile, this.state.log, APP_NAME);
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
      screen: 'onboarding', onbStep: 'consent', consent: false, legal: null, assistant: false, mealEdit: null, entryEdit: null, chat: [],
      profile: blankProfile(), log: {}, form: blankForm(), insights: null
    });
    this.showToast(ok ? 'Данные удалены' : 'Удалено на устройстве, сервер не ответил');
  }

  // ================= запись дня (экран «+») =================

  setForm(patch) { this.setState({ form: { ...this.state.form, ...patch } }); }

  // ---------- стул и самочувствие: одна логика для новой записи (target 'form') и правки ('edit') ----------

  gutDraft(target) { return target === 'edit' ? this.state.entryEdit.draft : this.state.form; }

  setGutDraft(target, patch) {
    if (target === 'edit') this.setState({ entryEdit: { ...this.state.entryEdit, draft: { ...this.state.entryEdit.draft, ...patch } } });
    else this.setForm(patch);
  }

  /** «Был» / «Не было»; повторное нажатие снимает выбор */
  setStool(value, target = 'form') {
    const v = this.gutDraft(target).stool === value ? '' : value;
    this.setGutDraft(target, { stool: v });
    track('stool_status_selected', { value: v || 'cleared', where: target });
  }

  pickBristolType(n, target = 'form') {
    this.setGutDraft(target, { type: n });
    track('bristol_type_selected', { bristol_type: n, where: target });
  }

  pickStoolColor(id, target = 'form') {
    const v = this.gutDraft(target).color === id ? '' : id;
    this.setGutDraft(target, { color: v });
    track('stool_color_selected', { color: v || 'cleared', where: target });
  }

  /** Стресс: событие шлём один раз после того, как ползунок отпустили */
  setStress(value, target = 'form') {
    this.setGutDraft(target, { stress: Math.min(10, Math.max(0, Number(value) || 0)) });
    clearTimeout(this.stressTimer);
    this.stressTimer = setTimeout(() => track('stress_set', { stress: this.gutDraft(target).stress, where: target }), 800);
  }

  toggleSymptom(label, target = 'form') {
    const sym = this.gutDraft(target).sym, on = sym.includes(label);
    let next;
    if (label === SYMPTOM_OK) next = on ? [] : [SYMPTOM_OK];
    else next = on ? sym.filter((x) => x !== label) : [...sym.filter((x) => x !== SYMPTOM_OK), label];
    this.setGutDraft(target, { sym: next });
    track('symptom_toggled', { symptom: label, selected: !on, where: target });
  }

  /** Запись о стуле из черновика формы */
  gutFromDraft(d, base) {
    const had = d.stool === 'had';
    return {
      ...base,
      type: had ? d.type : d.stool === 'none' ? 0 : -1,
      sym: [...d.sym],
      color: had ? d.color : '',
      stress: d.stress
    };
  }

  // ---------- правка сохранённой записи о стуле / самочувствии ----------

  openEntry(dayK, id) {
    const g = this.day(dayK).gut.find((x) => x.id === id);
    if (!g) return;
    const draft = {
      stool: g.type > 0 ? 'had' : g.type === 0 ? 'none' : '',
      type: g.type > 0 ? g.type : 4,
      sym: [...g.sym], color: g.color || '', stress: g.stress == null ? null : g.stress
    };
    this.setState({ entryEdit: { day: dayK, id, time: g.time, draft } });
    track('entry_opened');
  }

  closeEntry() { this.setState({ entryEdit: null }); }

  saveEntryEdit() {
    const e = this.state.entryEdit, d = e.draft;
    if (!d.stool && !d.sym.length && d.stress == null) { this.showToast('Отметьте хотя бы что-то одно'); return; }
    const day = this.day(e.day);
    const old = day.gut.find((x) => x.id === e.id);
    const updated = this.gutFromDraft(d, old);
    const gut = day.gut.map((x) => (x.id === e.id ? updated : x));
    this.setState({ log: { ...this.state.log, [e.day]: { ...day, gut } }, entryEdit: null });
    if (!IS_DEMO) store.updateGutEntry(updated);
    this.showToast('Сохранено');
    track('entry_updated', { stool_status: d.stool || 'not_set', bristol_type: d.stool === 'had' ? d.type : null, has_color: !!updated.color, stress: d.stress });
  }

  deleteEntry() {
    const e = this.state.entryEdit;
    if (!window.confirm('Удалить эту запись?')) return;
    const day = this.day(e.day);
    this.setState({ log: { ...this.state.log, [e.day]: { ...day, gut: day.gut.filter((x) => x.id !== e.id) } }, entryEdit: null });
    if (!IS_DEMO) store.deleteGutEntry(e.id);
    this.showToast('Удалено');
    track('entry_deleted');
  }

  setPeriodMark(value) {
    const v = this.state.form.period === value ? '' : value;
    this.setForm({ period: v });
    track('period_marked', { value: v || 'cleared' });
  }

  // ---------- еда ----------

  /** Запрос к ИИ про блюдо. photo — blob-ссылка (если фото ещё в памяти), previous — прошлый разбор при уточнении */
  async requestMeal({ photo, note, previous }) {
    let image;
    if (photo) image = await compressImage(await (await fetch(photo)).blob());
    const r = await analyzeFood({ image, note, previous, goals: goalLabels(this.state.profile) });
    if (r.is_food === false) throw new Error('Не похоже на еду — попробуйте другое фото или опишите блюдо словами');
    return normalizeMeal(r);
  }

  pickFoodPhoto(file) {
    let photo = '';
    try { photo = URL.createObjectURL(file); } catch (_) { /* без превью */ }
    this.setForm({ photo });
    track('food_photo_added', { source: 'photo', file_type: file.type, size_kb: Math.round(file.size / 1024) });
  }

  removeFoodPhoto() {
    this.setForm({ photo: '' });
    track('food_photo_removed');
  }

  /** «Разобрать»: фото и/или описание → ИИ */
  async analyzeFoodDraft() {
    const f = this.state.form, note = f.note.trim();
    if (!f.photo && !note) { this.showToast('Добавьте фото или опишите блюдо'); return; }
    if (IS_DEMO) { this.tryExampleMeal(f.photo ? 'photo' : 'text'); return; }
    const source = f.photo ? 'photo' : 'text';
    const scanId = (this.scanId = newId());
    this.setForm({ food: 'scan', source });
    track('food_analysis_requested', { has_photo: !!f.photo, has_note: !!note });
    const startedAt = Date.now();
    try {
      const result = await this.requestMeal({ photo: f.photo, note });
      if (this.scanId !== scanId) return; // блюдо уже убрали
      this.setForm({ food: 'done', result });
      track('food_analysis_completed', { source, has_note: !!note, tone: result.tone, kcal: result.kcal, fiber: result.fiber, latency_ms: Date.now() - startedAt });
    } catch (e) {
      if (this.scanId !== scanId) return;
      this.setForm({ food: 'pick' });
      this.showToast(String(e.message || e).slice(0, 140));
      track('food_analysis_failed', { source, reason: String(e.message || e).slice(0, 120), latency_ms: Date.now() - startedAt });
    }
  }

  /** Разбор блюда в демо-режиме: готовое блюдо без запроса к ИИ */
  tryExampleMeal(source) {
    const n = this.state.exampleN, result = normalizeMeal(EXAMPLE_MEALS[n % EXAMPLE_MEALS.length]);
    this.setState({ form: { ...this.state.form, food: 'scan', result: null, source }, exampleN: n + 1 });
    clearTimeout(this.exampleTimer);
    this.exampleTimer = setTimeout(() => {
      this.setForm({ food: 'done', result });
      track('food_analysis_completed', { source, tone: result.tone, kcal: result.kcal, fiber: result.fiber, latency_ms: EXAMPLE_SCAN_MS });
    }, EXAMPLE_SCAN_MS);
  }

  removeFood() {
    clearTimeout(this.exampleTimer);
    this.scanId = null;
    const f = blankForm();
    this.setForm({ food: f.food, photo: f.photo, note: f.note, result: f.result, source: f.source, fixOpen: false, fix: '', fixing: false });
    track('food_removed');
  }

  /** Уточнение разбора до сохранения */
  async applyFoodFix() {
    const f = this.state.form, fix = f.fix.trim();
    if (!fix || f.fixing) return;
    if (IS_DEMO) { this.setForm({ fixOpen: false, fix: '' }); this.showToast('В демо уточнение не пересчитывается'); return; }
    this.setForm({ fixing: true });
    try {
      const result = await this.requestMeal({ photo: f.photo, note: fix, previous: f.result });
      this.setForm({ result, fixing: false, fixOpen: false, fix: '', note: [f.note.trim(), fix].filter(Boolean).join('; ') });
      track('food_reanalyzed', { where: 'draft', kcal: result.kcal });
    } catch (e) {
      this.setForm({ fixing: false });
      this.showToast(String(e.message || e).slice(0, 140));
      track('food_reanalyze_failed', { where: 'draft', reason: String(e.message || e).slice(0, 120) });
    }
  }

  // ---------- сохранённое блюдо: уточнить или удалить ----------

  findMeal(dayK, id) { return this.day(dayK).meals.find((m) => m.id === id) || null; }

  openMeal(dayK, id) {
    this.setState({ mealEdit: { day: dayK, id, fix: '', fixing: false } });
    track('meal_opened');
  }

  closeMeal() { this.setState({ mealEdit: null }); }

  setMealFix(text) { this.setState({ mealEdit: { ...this.state.mealEdit, fix: text } }); }

  replaceMeal(dayK, id, patch) {
    const d = this.day(dayK);
    const meals = patch ? d.meals.map((m) => (m.id === id ? { ...m, ...patch } : m)) : d.meals.filter((m) => m.id !== id);
    this.setState({ log: { ...this.state.log, [dayK]: { ...d, meals } } });
  }

  async applyMealFix() {
    const me = this.state.mealEdit, fix = me.fix.trim(), meal = this.findMeal(me.day, me.id);
    if (!fix || me.fixing || !meal) return;
    if (IS_DEMO) { this.showToast('В демо уточнение не пересчитывается'); return; }
    this.setState({ mealEdit: { ...me, fixing: true } });
    try {
      const result = await this.requestMeal({ photo: meal.photo, note: fix, previous: meal });
      const updated = { ...meal, ...result, note: [meal.note, fix].filter(Boolean).join('; ') };
      this.replaceMeal(me.day, me.id, updated);
      store.updateMeal(updated);
      this.setState({ mealEdit: { ...this.state.mealEdit, fix: '', fixing: false } });
      this.showToast('Пересчитали');
      track('food_reanalyzed', { where: 'saved', kcal: result.kcal });
    } catch (e) {
      this.setState({ mealEdit: { ...this.state.mealEdit, fixing: false } });
      this.showToast(String(e.message || e).slice(0, 140));
      track('food_reanalyze_failed', { where: 'saved', reason: String(e.message || e).slice(0, 120) });
    }
  }

  deleteMeal() {
    const me = this.state.mealEdit;
    if (!window.confirm('Удалить это блюдо из записей?')) return;
    this.replaceMeal(me.day, me.id, null);
    if (!IS_DEMO) store.deleteMeal(me.id);
    this.setState({ mealEdit: null });
    this.showToast('Удалено');
    track('meal_deleted');
  }

  saveEntry() {
    const f = this.state.form, k = this.today();
    if (!f.stool && !f.sym.length && f.stress == null && f.food !== 'done' && !f.period) {
      this.showToast('Отметьте хотя бы что-то одно');
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
      stool_color: f.stool === 'had' ? f.color || null : null,
      stress: f.stress,
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

  openAssistant(from) {
    this.setState({ assistant: true });
    track('assistant_opened', { from });
  }

  closeAssistant() { this.setState({ assistant: false }); }

  attachChatImage(file) {
    let url = '';
    try { url = URL.createObjectURL(file); } catch (_) { return; }
    this.setState({ chatImage: url });
    track('assistant_image_attached', { file_type: file.type, size_kb: Math.round(file.size / 1024) });
  }

  removeChatImage() { this.setState({ chatImage: '' }); }

  /** Вопрос помощнику (можно с фото). Диалог сохраняется, пока открыто приложение. */
  async ask(question, source) {
    const s = this.state, image = s.chatImage;
    if ((!question && !image) || s.chatLoading) return;
    const history = s.chat.slice(-6).map((m) => ({ role: m.role, text: m.text }));
    const chat = [...s.chat, { role: 'user', text: question, image }];
    this.setState({ chat, chatLoading: true, askText: '', chatImage: '' });
    track('ai_question_asked', { source, turn: chat.length, length: question.length, has_image: !!image });

    if (IS_DEMO) {
      const hit = Object.keys(DEMO_ANSWERS).find((k) => question.toLowerCase().includes(k));
      setTimeout(() => this.revealAnswer(hit ? DEMO_ANSWERS[hit] : DEMO_ANSWER_DEFAULT), 700);
      return;
    }
    const startedAt = Date.now();
    try {
      const img = image ? await compressImage(await (await fetch(image)).blob()) : undefined;
      const r = await askAI({ question, image: img, history, context: buildAiContext(s.profile, s.log, this.today()) });
      this.revealAnswer(r.answer || '');
      track('ai_answer_received', { source, latency_ms: Date.now() - startedAt, answer_length: (r.answer || '').length });
    } catch (e) {
      this.revealAnswer('Не получилось ответить: ' + String(e.message || e).slice(0, 160) + '. Попробуйте ещё раз чуть позже.');
      track('ai_answer_failed', { source, error: String(e.message || e).slice(0, 120) });
    }
  }

  /** Ответ появляется по предложению — чтобы было спокойно читать */
  revealAnswer(text) {
    const sentences = splitSentences(text);
    const msg = { role: 'ai', text, shown: sentences[0] || '' };
    this.setState({ chat: [...this.state.chat, msg], chatLoading: false });
    let i = 1;
    clearInterval(this.revealTimer);
    this.revealTimer = setInterval(() => {
      if (i >= sentences.length) { clearInterval(this.revealTimer); return; }
      i++;
      const chat = [...this.state.chat], last = chat[chat.length - 1];
      if (!last || last.text !== text) { clearInterval(this.revealTimer); return; }
      chat[chat.length - 1] = { ...last, shown: sentences.slice(0, i).join(' ') };
      this.setState({ chat });
    }, SENTENCE_DELAY_MS);
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
