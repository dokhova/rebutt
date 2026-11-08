// Тема оформления: светлая (по умолчанию) или тёмная. Выбор хранится на устройстве (localStorage),
// применяется атрибутом data-theme на <html> — все цвета берутся из src/styles/tokens.css.
import { setTelegramColors } from './telegram.js';

const LS_THEME = 'gt_theme';
export const THEMES = ['light', 'dark'];
export const DEFAULT_THEME = 'light';

/** Цвет верха и низа фона — для шапки Telegram и theme-color браузера (совпадают с --bg-top / --bg в tokens.css) */
const CHROME = {
  light: { top: '#F2F1EC', bottom: '#ECEBE5' },
  dark: { top: '#1E1A28', bottom: '#141218' }
};

export function readTheme() {
  try {
    const t = localStorage.getItem(LS_THEME);
    return THEMES.includes(t) ? t : DEFAULT_THEME;
  } catch (_) { return DEFAULT_THEME; }
}

export function saveTheme(theme) {
  try { localStorage.setItem(LS_THEME, theme); } catch (_) { /* приватный режим — тема живёт до перезапуска */ }
}

/** Ставит тему на страницу, в мета-тег theme-color и в шапку/фон Telegram */
export function applyTheme(theme) {
  const t = THEMES.includes(theme) ? theme : DEFAULT_THEME;
  if (typeof document === 'undefined') return t;
  document.documentElement.dataset.theme = t;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', CHROME[t].top);
  setTelegramColors(CHROME[t].top, CHROME[t].bottom);
  return t;
}
