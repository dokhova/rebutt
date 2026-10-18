// Мини-рантайм интерфейса. Без React и JSX: HTML-шаблоны + объект значений + DOM-диффинг (morphdom).
//
// Синтаксис шаблонов (src/templates):
//   {{path}}                         подстановка значения (в тексте и атрибутах), path может быть a.b.c
//   onClick="{{fn}}"                 обработчик события (click, input, change, keydown, scroll); onChange у текстовых input и textarea = input
//   ref="{{fn}}"                     fn(element) вызывается после каждой отрисовки
//   html="{{markup}}"               вставить готовый HTML внутрь элемента (только для своего контента, например документов из public/legal)
//   <sc-if value="{{flag}}">         отрисовать содержимое, если flag истинно
//   <sc-for list="{{arr}}" as="x">   повторить содержимое для каждого элемента, внутри доступны x и $index
//   <sc-include name="today">        вставить фрагмент шаблона, зарегистрированный через registerPartial
//   <sc-component name="Gut" tone="calm">  вложенный компонент; атрибуты → props (kebab-case → camelCase)
//
// Компонент — класс-наследник Component с методом view(), который возвращает значения для шаблона.
// Корневой компонент хранит state; setState перерисовывает интерфейс в следующем микротаске.

import morphdom from 'morphdom';

const SVGNS = 'http://www.w3.org/2000/svg';
const WHOLE = /^\s*\{\{\s*([^}]+?)\s*\}\}\s*$/;
const DELEGATED = ['click', 'input', 'change', 'keydown'];

const components = {};
const partials = {};
let handlers = [];
let rootInstance = null;
let rootEl = null;
let pending = false;

export class Component {
  constructor(props) {
    this.props = props || {};
    this.state = {};
  }

  setState(patch) {
    const prev = this.state;
    const next = typeof patch === 'function' ? patch(prev, this.props) : patch;
    if (this === rootInstance && !this._prevState) this._prevState = prev;
    this.state = { ...prev, ...next };
    if (this === rootInstance) scheduleRender();
  }

  /** Значения для шаблона. Переопределяется в наследниках. */
  view() { return {}; }
}

const toTemplate = (html) => {
  const t = document.createElement('template');
  t.innerHTML = html;
  return t.content;
};

export function registerComponent(name, cls, html) {
  components[name] = { cls, tpl: toTemplate(html) };
}

export function registerPartial(name, html) {
  partials[name] = toTemplate(html);
}

// ---------- шаблонизатор ----------

function lookup(path, scope) {
  path = path.trim();
  if (path === 'true') return true;
  if (path === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(path)) return +path;
  let v = scope;
  for (const part of path.split('.')) {
    if (v == null) return undefined;
    v = v[part];
  }
  return v;
}

const interpolate = (str, scope) =>
  str.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, p) => {
    const v = lookup(p, scope);
    return v == null ? '' : String(v);
  });

function renderChildren(parent, tpl, scope) {
  for (const n of tpl.childNodes) renderNode(parent, n, scope);
}

function renderNode(parent, n, scope) {
  if (n.nodeType === Node.TEXT_NODE) {
    parent.appendChild(document.createTextNode(interpolate(n.nodeValue, scope)));
    return;
  }
  if (n.nodeType !== Node.ELEMENT_NODE) return;

  const tag = n.localName;
  if (tag === 'sc-if') {
    const m = WHOLE.exec(n.getAttribute('value') || '');
    if (m && lookup(m[1], scope)) renderChildren(parent, n, scope);
    return;
  }
  if (tag === 'sc-for') {
    const m = WHOLE.exec(n.getAttribute('list') || '');
    const list = (m && lookup(m[1], scope)) || [];
    const as = n.getAttribute('as') || 'item';
    list.forEach((item, i) => {
      const s = Object.create(scope);
      s[as] = item;
      s.$index = i;
      renderChildren(parent, n, s);
    });
    return;
  }
  if (tag === 'sc-include') {
    const p = partials[n.getAttribute('name')];
    if (!p) throw new Error('Unknown partial: ' + n.getAttribute('name'));
    renderChildren(parent, p, scope);
    return;
  }
  if (tag === 'sc-component') {
    renderComponent(parent, n, scope);
    return;
  }

  const el = n.namespaceURI === SVGNS ? document.createElementNS(SVGNS, tag) : document.createElement(tag);
  for (const { name, value } of n.attributes) {
    const m = WHOLE.exec(value);
    if (m && /^on[a-z]+$/.test(name)) {
      const fn = lookup(m[1], scope);
      if (typeof fn !== 'function') continue;
      let ev = name.slice(2);
      // onChange у текстовых полей срабатывает на каждый ввод символа
      if (ev === 'change' && (tag === 'textarea' || (tag === 'input' && n.getAttribute('type') !== 'file'))) ev = 'input';
      handlers.push(fn);
      el.setAttribute('data-on-' + ev, handlers.length - 1);
    } else if (m && name === 'html') {
      el.innerHTML = String(lookup(m[1], scope) || '');
    } else if (m && name === 'ref') {
      const fn = lookup(m[1], scope);
      if (typeof fn === 'function') { handlers.push(fn); el.setAttribute('data-ref', handlers.length - 1); }
    } else if (m) {
      const v = lookup(m[1], scope);
      // null/undefined — атрибут не ставится; false — тоже, кроме aria-* (там нужен "false")
      if (v == null || (v === false && !name.startsWith('aria-'))) continue;
      el.setAttribute(name, String(v));
    } else {
      el.setAttribute(name, interpolate(value, scope));
    }
  }
  if (tag === 'input' && el.hasAttribute('value')) el.value = el.getAttribute('value');
  renderChildren(el, n, scope);
  parent.appendChild(el);
}

function renderComponent(parent, n, scope) {
  const name = n.getAttribute('name');
  const C = components[name];
  if (!C) throw new Error('Unknown component: ' + name);
  const props = {};
  for (const { name: attr, value } of n.attributes) {
    if (attr === 'name') continue;
    const key = attr.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    const m = WHOLE.exec(value);
    props[key] = m ? lookup(m[1], scope) : interpolate(value, scope);
  }
  renderChildren(parent, C.tpl, new C.cls(props).view());
}

// ---------- отрисовка и события ----------

function render() {
  handlers = [];
  const fresh = document.createElement('div');
  fresh.id = rootEl.id;
  renderChildren(fresh, components.App.tpl, rootInstance.view());
  morphdom(rootEl, fresh);
  for (const el of rootEl.querySelectorAll('[data-ref]')) {
    const fn = handlers[+el.getAttribute('data-ref')];
    if (fn) fn(el);
  }
}

function scheduleRender() {
  if (pending) return;
  pending = true;
  Promise.resolve().then(() => {
    pending = false;
    const prev = rootInstance._prevState || rootInstance.state;
    rootInstance._prevState = null;
    render();
    if (rootInstance.componentDidUpdate) rootInstance.componentDidUpdate(prev);
  });
}

function findHandler(target, type) {
  for (let el = target; el && el !== rootEl.parentNode; el = el.parentNode) {
    const id = el.getAttribute && el.getAttribute('data-on-' + type);
    if (id != null) return handlers[+id];
  }
  return null;
}

/** Монтирует компонент App в элемент #app */
export function mount(selector = '#app', props = {}) {
  rootEl = document.querySelector(selector);
  rootInstance = new components.App.cls(props);
  for (const type of DELEGATED) {
    rootEl.addEventListener(type, (e) => { const fn = findHandler(e.target, type); if (fn) fn(e); });
  }
  // scroll не всплывает — ловим на фазе захвата и только у самого элемента
  rootEl.addEventListener('scroll', (e) => {
    const id = e.target.getAttribute && e.target.getAttribute('data-on-scroll');
    if (id != null && handlers[+id]) handlers[+id](e);
  }, true);
  render();
  if (rootInstance.componentDidMount) rootInstance.componentDidMount();
  return rootInstance;
}
