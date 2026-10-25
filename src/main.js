// Точка входа: стили, аналитика, регистрация шаблонов и запуск приложения.
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/screens.css';

import { registerComponent, registerPartial, mount } from './core/runtime.js';
import { initTelegram } from './services/telegram.js';
import { trackViewport } from './services/viewport.js';
import { initAnalytics } from './services/analytics.js';
import App from './app/App.js';
import Pebble from './components/Pebble.js';

import appHtml from './templates/app.html?raw';
import pebbleHtml from './templates/components/pebble.html?raw';
import onboardingHtml from './templates/screens/onboarding.html?raw';
import todayHtml from './templates/screens/today.html?raw';
import addHtml from './templates/screens/add.html?raw';
import insightsHtml from './templates/screens/insights.html?raw';
import profileHtml from './templates/screens/profile.html?raw';
import legalHtml from './templates/screens/legal.html?raw';
import mealHtml from './templates/screens/meal.html?raw';
import assistantHtml from './templates/screens/assistant.html?raw';
import entryHtml from './templates/screens/entry.html?raw';
import waterHtml from './templates/screens/water.html?raw';
import gutFormHtml from './templates/partials/gut-form.html?raw';
import mealCardHtml from './templates/partials/meal-card.html?raw';
import addSheetHtml from './templates/partials/add-sheet.html?raw';
import infoCardHtml from './templates/partials/info-card.html?raw';
import homePromptHtml from './templates/partials/home-prompt.html?raw';

initTelegram();
trackViewport();
initAnalytics();

registerComponent('App', App, appHtml);
registerComponent('Pebble', Pebble, pebbleHtml);

registerPartial('onboarding', onboardingHtml);
registerPartial('today', todayHtml);
registerPartial('add', addHtml);
registerPartial('insights', insightsHtml);
registerPartial('profile', profileHtml);
registerPartial('legal', legalHtml);
registerPartial('meal', mealHtml);
registerPartial('assistant', assistantHtml);
registerPartial('entry', entryHtml);
registerPartial('water', waterHtml);
registerPartial('gut-form', gutFormHtml);
registerPartial('meal-card', mealCardHtml);
registerPartial('add-sheet', addSheetHtml);
registerPartial('info-card', infoCardHtml);
registerPartial('home-prompt', homePromptHtml);

mount('#app');
