// Общая оболочка: контейнер экрана, нижнее меню, тост. Значения нужны на всех экранах.
import { APP_NAME } from '../config.js';

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
      onboarding: screen === 'onboarding',
      today: screen === 'today',
      insights: screen === 'insights',
      profile: screen === 'profile'
    },
    screenCls: 'screen scroller' + (withTabs ? ' with-tabs' : ''),
    setScrollEl: app.setScrollEl,

    // пока открыта клавиатура или панель ИИ, меню не перекрывает поле ввода
    showTabs: withTabs && !s.keyboard && !s.assistant && !s.addSheet,
    showAddSheet: !!s.addSheet && withTabs,
    showAssistant: !!s.assistant && screen !== 'booting',
    openAssistantDock: () => app.openAssistant('dock'),
    tabToday: tab('today'),
    tabInsights: tab('insights'),
    tabAdd: 'plus' + (s.addSheet ? ' on' : ''),
    goToday: () => app.navigate('today'),
    goAdd: () => app.openAddSheet('tab'),
    goInsights: () => app.navigate('insights'),

    toast: s.toast,
    hasToast: !!s.toast
  };
}
