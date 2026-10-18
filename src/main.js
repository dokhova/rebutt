// Точка входа: стили, аналитика, регистрация шаблонов и запуск приложения.
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/screens.css';

import { registerComponent, registerPartial, mount } from './core/runtime.js';
import { initTelegram } from './services/telegram.js';
import { initAnalytics } from './services/analytics.js';
import App from './app/App.js';
import Gut from './components/Gut.js';
import Pebble from './components/Pebble.js';

import appHtml from './templates/app.html?raw';
import gutHtml from './templates/components/gut.html?raw';
import pebbleHtml from './templates/components/pebble.html?raw';
import onboardingHtml from './templates/screens/onboarding.html?raw';
import todayHtml from './templates/screens/today.html?raw';
import addHtml from './templates/screens/add.html?raw';
import insightsHtml from './templates/screens/insights.html?raw';
import profileHtml from './templates/screens/profile.html?raw';
import legalHtml from './templates/screens/legal.html?raw';
import askHtml from './templates/partials/ask.html?raw';

initTelegram();
initAnalytics();

registerComponent('App', App, appHtml);
registerComponent('Gut', Gut, gutHtml);
registerComponent('Pebble', Pebble, pebbleHtml);

registerPartial('onboarding', onboardingHtml);
registerPartial('today', todayHtml);
registerPartial('add', addHtml);
registerPartial('insights', insightsHtml);
registerPartial('profile', profileHtml);
registerPartial('legal', legalHtml);
registerPartial('ask', askHtml);

mount('#app');
