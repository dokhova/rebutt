// Общая оболочка: контейнер экрана, нижнее меню, тост. Значения нужны на всех экранах.
import { APP_NAME } from '../config.js';
import { SOURCES, infoCards } from '../domain/sources.js';
import { dailyTargets } from '../domain/targets.js';

const INFO_TOPICS = ['fiber', 'water', 'targets', 'bristol', 'tips'];

const TAB_SCREENS = ['today', 'insights', 'profile'];

/** screen — что показывается сейчас: 'booting' | 'legal' | 'meal' | 'entry' | 'onboarding' | экран с меню. ИИ-помощник — панель поверх. */
export function shellView(app, screen) {
  const s = app.state;
  const withTabs = TAB_SCREENS.includes(screen);
  const tab = (name) => 'tab' + (screen === name ? ' on' : '');
  return {
    appName: APP_NAME,
    is: {
      booting: screen === 'booting',
      legal: screen === 'legal',
      meal: screen === 'meal',
      entry: screen === 'entry',
      water: screen === 'water',
      onboarding: screen === 'onboarding',
      today: screen === 'today',
      insights: screen === 'insights',
      profile: screen === 'profile'
    },
    screenCls: 'screen scroller' + (withTabs ? ' with-tabs' : ''),
    setScrollEl: app.setScrollEl,

    // пока открыта клавиатура или панель ИИ, меню не перекрывает поле ввода
    // при выборе раздела «+» меню остаётся: «+» превращается в «×»
    showTabs: withTabs && !s.keyboard && !s.assistant && (!s.addSheet || s.addSheet === 'pick'),
    showAddSheet: !!s.addSheet && withTabs,
    showAssistant: !!s.assistant && screen !== 'booting',
    openAssistantDock: () => app.openAssistant('dock'),
    tabToday: tab('today'),
    tabInsights: tab('insights'),
    tabAdd: 'plus' + (s.addSheet ? ' on' : ''),
    goToday: () => app.navigate('today'),
    goAdd: () => (s.addSheet ? app.closeAddSheet() : app.openAddSheet('tab')),
    goInsights: () => app.navigate('insights'),

    // «?» рядом с нормами и советами — на любом экране: onClick="{{info.fiber}}"
    info: Object.fromEntries(INFO_TOPICS.map((id) => [id, () => app.openInfo(id)])),
    ...infoCardView(app),
    ...homePromptView(app),

    toast: s.toast,
    hasToast: !!s.toast
  };
}

/** Карточка «?»: что за норма, откуда она, ссылки на источники */
function infoCardView(app) {
  const topic = app.state.info;
  const cards = topic ? infoCards(dailyTargets(app.state.profile))[topic] : null;
  return {
    showInfo: !!cards,
    infoBlocks: (cards || []).map((c) => ({
      ...c,
      links: c.sources.map((id) => ({ ...SOURCES[id], open: (e) => app.openSource(id, SOURCES[id].url, e) }))
    })),
    closeInfo: () => app.closeInfo()
  };
}

/** Модалка «На главный экран»: ярлык с круглыми иконками на Android, со скруглёнными — на iOS */
function homePromptView(app) {
  const open = !!app.state.homePrompt;
  return {
    showHomePrompt: open,
    homePrompt: open ? {
      artCls: 'hp-art ' + app.state.homePrompt,
      add: () => app.addToHomeScreen(),
      later: () => app.dismissHomePrompt('later'),
      close: () => app.dismissHomePrompt('close')
    } : null
  };
}
