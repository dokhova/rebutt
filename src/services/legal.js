// Юридические документы показываются внутри приложения: берём <main> из public/legal/*.html.
import { LEGAL_DOCS } from '../config.js';

const cache = {};

/** HTML основного текста документа (без ссылки «В приложение») */
export async function loadLegalHtml(id) {
  if (cache[id]) return cache[id];
  const res = await fetch(LEGAL_DOCS[id].url, { cache: 'no-cache' });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
  const main = doc.querySelector('main');
  if (!main) throw new Error('В документе нет <main>');
  main.querySelectorAll('.back, h1').forEach((el) => el.remove()); // заголовок рисует экран
  cache[id] = main.innerHTML;
  return cache[id];
}

/** id документа по ссылке вида /legal/privacy.html, иначе null */
export function legalIdByHref(href) {
  const path = new URL(href, location.href).pathname;
  return Object.keys(LEGAL_DOCS).find((id) => LEGAL_DOCS[id].url === path) || null;
}
