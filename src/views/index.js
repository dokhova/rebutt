// Экран → функция, которая готовит для него значения шаблона.
// Шаблоны экранов: src/templates/screens/<экран>.html
import { onboardingView } from './onboarding.js';
import { todayView } from './today.js';
import { addEntryView } from './add-entry.js';
import { insightsView } from './insights.js';
import { profileView } from './profile.js';
import { legalView } from './legal.js';

export { shellView } from './shell.js';

export const VIEWS = {
  onboarding: onboardingView,
  today: todayView,
  add: addEntryView,
  insights: insightsView,
  profile: profileView,
  legal: legalView        // документ поверх любого экрана
};
