// Общая оболочка: фон, нижнее меню, тост. Значения нужны на всех экранах.
import { APP_NAME } from '../config.js';
import { TONE_GLOW_RGB } from '../domain/score.js';

/** Тон фонового свечения выбирает экран (view может вернуть glowTone) */
export function shellView(app) {
  const s = app.state;
  const isOnboarding = s.screen === 'onboarding';
  const tab = (name) => 'tab' + (s.screen === name ? ' on' : '');
  return {
    appName: APP_NAME,
    is: { onboarding: isOnboarding, today: s.screen === 'today', add: s.screen === 'add', insights: s.screen === 'insights', profile: s.screen === 'profile' },
    screenCls: 'screen scroller' + (isOnboarding ? '' : ' with-tabs'),
    setScrollEl: app.setScrollEl,

    showTabs: !isOnboarding,
    tabToday: tab('today'),
    tabInsights: tab('insights'),
    tabAdd: 'plus' + (s.screen === 'add' ? ' on' : ''),
    goToday: () => app.navigate('today'),
    goAdd: () => app.navigate('add'),
    goInsights: () => app.navigate('insights'),

    toast: s.toast,
    hasToast: !!s.toast
  };
}

/** Фоновое свечение экрана по тону (calm / mild / sens / cycle / empty) */
export const glow = (tone) => {
  const rgb = TONE_GLOW_RGB[tone] || TONE_GLOW_RGB.empty;
  return 'radial-gradient(closest-side at 50% 42%, rgba(' + rgb + ',.14), rgba(' + rgb + ',0))';
};
