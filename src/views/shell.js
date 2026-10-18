// Общая оболочка: контейнер экрана, нижнее меню, тост. Значения нужны на всех экранах.
import { APP_NAME } from '../config.js';

const TAB_SCREENS = ['today', 'add', 'insights', 'profile'];

/** screen — что показывается сейчас: 'booting' | 'legal' | 'onboarding' | экран с меню */
export function shellView(app, screen) {
  const s = app.state;
  const withTabs = TAB_SCREENS.includes(screen);
  const tab = (name) => 'tab' + (screen === name ? ' on' : '');
  return {
    appName: APP_NAME,
    is: {
      booting: screen === 'booting',
      legal: screen === 'legal',
      onboarding: screen === 'onboarding',
      today: screen === 'today',
      add: screen === 'add',
      insights: screen === 'insights',
      profile: screen === 'profile'
    },
    screenCls: 'screen scroller' + (withTabs ? ' with-tabs' : ''),
    setScrollEl: app.setScrollEl,

    showTabs: withTabs,
    tabToday: tab('today'),
    tabInsights: tab('insights'),
    tabAdd: 'plus' + (screen === 'add' ? ' on' : ''),
    goToday: () => app.navigate('today'),
    goAdd: () => app.navigate('add'),
    goInsights: () => app.navigate('insights'),

    toast: s.toast,
    hasToast: !!s.toast
  };
}
