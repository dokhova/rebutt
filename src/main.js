import './styles.css';
import { register, boot } from './runtime.js';
import App from './components/App.js';
import Gut from './components/Gut.js';
import Pebble from './components/Pebble.js';
import appTpl from './templates/app.html?raw';
import gutTpl from './templates/gut.html?raw';
import pebbleTpl from './templates/pebble.html?raw';
import { initAnalytics } from './services/analytics.js';

initAnalytics();
register('App', App, appTpl);
register('Gut', Gut, gutTpl);
register('Pebble', Pebble, pebbleTpl);
boot({});
