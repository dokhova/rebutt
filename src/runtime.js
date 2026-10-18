// Мини-рантайм: шаблоны с {{выражениями}}, <sc-if>, <sc-for>, <dc-import>
// и DOM-диффинг через morphdom. Без React и без сборки JSX.
import morphdom from 'morphdom';

const SVGNS = 'http://www.w3.org/2000/svg';
const WHOLE = /^\s*\{\{\s*([^}]+?)\s*\}\}\s*$/;

let H = [];
let app = null;
let root = null;
let pending = false;
const registry = {};

export class DCLogic {
  constructor(props) { this.props = props || {}; this.state = {}; }
  setState(p) {
    const prev = this.state;
    const next = typeof p === 'function' ? p(prev, this.props) : p;
    if (this === app && !this._prev) this._prev = prev;
    this.state = Object.assign({}, prev, next);
    if (this === app) schedule();
  }
  forceUpdate() { if (this === app) schedule(); }
}

export function register(name, cls, html) {
  const t = document.createElement('template');
  t.innerHTML = html;
  registry[name] = { cls, tpl: t.content };
}

function look(path, sc) {
  path = path.trim();
  if (path === 'true') return true;
  if (path === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(path)) return +path;
  const parts = path.split('.');
  let v = sc;
  for (let i = 0; i < parts.length; i++) { if (v == null) return undefined; v = v[parts[i]]; }
  return v;
}
function interp(str, sc) {
  return str.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (m, p) => { const v = look(p, sc); return v == null ? '' : String(v); });
}
function kids(parent, tpl, sc) { const c = tpl.childNodes; for (let i = 0; i < c.length; i++) node(parent, c[i], sc); }
function node(parent, n, sc) {
  if (n.nodeType === 3) { parent.appendChild(document.createTextNode(interp(n.nodeValue, sc))); return; }
  if (n.nodeType !== 1) return;
  const tag = n.localName;
  let m;
  if (tag === 'sc-if') { m = WHOLE.exec(n.getAttribute('value') || ''); if (m && look(m[1], sc)) kids(parent, n, sc); return; }
  if (tag === 'sc-for') {
    m = WHOLE.exec(n.getAttribute('list') || '');
    const list = (m && look(m[1], sc)) || [];
    const as = n.getAttribute('as') || 'item';
    for (let i = 0; i < list.length; i++) { const s2 = Object.create(sc); s2[as] = list[i]; s2.$index = i; kids(parent, n, s2); }
    return;
  }
  if (tag === 'dc-import') { child(parent, n, sc); return; }
  const svg = n.namespaceURI === SVGNS;
  const el = svg ? document.createElementNS(SVGNS, tag) : document.createElement(tag);
  const at = n.attributes;
  for (let j = 0; j < at.length; j++) {
    const name = at[j].name, val = at[j].value;
    if (name.indexOf('hint-') === 0) continue;
    m = WHOLE.exec(val);
    if (/^on[a-z]+$/.test(name) && m) {
      const fn = look(m[1], sc); if (typeof fn !== 'function') continue;
      let ev = name.slice(2);
      if (ev === 'change' && tag === 'input' && n.getAttribute('type') !== 'file') ev = 'input';
      H.push(fn); el.setAttribute('data-on-' + ev, H.length - 1); continue;
    }
    if (name === 'ref' && m) { const rf = look(m[1], sc); if (typeof rf === 'function') { H.push(rf); el.setAttribute('data-ref', H.length - 1); } continue; }
    if (m) {
      const v = look(m[1], sc);
      if (v == null || (v === false && name.indexOf('aria-') !== 0)) continue;
      el.setAttribute(name, String(v));
    } else el.setAttribute(name, interp(val, sc));
  }
  if (tag === 'input' && el.hasAttribute('value')) el.value = el.getAttribute('value');
  kids(el, n, sc);
  parent.appendChild(el);
}
function child(parent, n, sc) {
  const C = registry[n.getAttribute('name')]; if (!C) return;
  const props = {};
  for (let i = 0; i < n.attributes.length; i++) {
    const a = n.attributes[i]; if (a.name === 'name' || a.name.indexOf('hint-') === 0) continue;
    const key = a.name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    const m = WHOLE.exec(a.value); props[key] = m ? look(m[1], sc) : interp(a.value, sc);
  }
  const inst = new C.cls(props);
  kids(parent, C.tpl, inst.renderVals());
}
function render() {
  H = [];
  const fresh = document.createElement('div'); fresh.id = 'app';
  kids(fresh, registry.App.tpl, app.renderVals());
  morphdom(root, fresh);
  const refs = root.querySelectorAll('[data-ref]');
  for (let i = 0; i < refs.length; i++) { const f = H[+refs[i].getAttribute('data-ref')]; if (f) f(refs[i]); }
}
function schedule() {
  if (pending) return; pending = true;
  Promise.resolve().then(() => {
    pending = false; const ps = app._prev || app.state; app._prev = null;
    render();
    if (app.componentDidUpdate) app.componentDidUpdate(app.props, ps);
  });
}
function delegate(type) {
  root.addEventListener(type, (e) => {
    let el = e.target;
    while (el && el !== root.parentNode) {
      const id = el.getAttribute && el.getAttribute('data-on-' + type);
      if (id != null) { const f = H[+id]; if (f) f(e); return; }
      el = el.parentNode;
    }
  });
}

export function boot(props) {
  root = document.getElementById('app');
  app = new registry.App.cls(props);
  ['click', 'input', 'change'].forEach(delegate);
  root.addEventListener('scroll', (e) => {
    const t = e.target, id = t.getAttribute && t.getAttribute('data-on-scroll');
    if (id != null && H[+id]) H[+id](e);
  }, true);
  render();
  if (app.componentDidMount) app.componentDidMount();
  return app;
}
