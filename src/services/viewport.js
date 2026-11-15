// Высота приложения и клавиатура.
//
// iOS (и Telegram на iOS): клавиатура не уменьшает страницу, а наезжает на неё и сдвигает документ вверх.
//   Там подгоняем #app под видимую область (--app-h = visualViewport.height) и возвращаем сдвиг страницы в 0 —
//   тогда шторки и модалки стоят ровно над клавиатурой.
// Android (Chrome / WebView Telegram): страница сама уменьшается вместе с клавиатурой (в index.html
//   interactive-widget=resizes-content). Здесь --app-h НЕ ставим: #app и так равен странице. Раньше высота
//   подгонялась с опозданием на кадр, страница успевала прокрутиться и потом «отпрыгивала» — отсюда скачки при вводе.
// В обоих случаях, когда клавиатура открылась, поле в фокусе плавно доводим до видимой части — только если оно
// спряталось, чтобы не было лишних движений. Пока клавиатура открыта, на <html> стоит data-kb (для стилей).
const KB_MIN_PX = 120;      // уменьшение высоты больше этого — открыта клавиатура, а не панель браузера
const SETTLE_MS = 160;      // клавиатура выезжает анимацией: ждём, пока высота перестанет меняться
const FIELD_MARGIN_PX = 24; // зазор между полем и краем видимой области

export function trackViewport() {
  if (typeof window === 'undefined') return;
  const vv = window.visualViewport;
  const root = document.documentElement;
  let full = window.innerHeight;  // высота без клавиатуры
  let raf = 0, settle = 0, kbOpen = false;

  const update = () => {
    raf = 0;
    const h = vv ? vv.height : window.innerHeight;
    // клавиатура перекрывает страницу (iOS) — подгоняем приложение под видимую часть; иначе высота = странице
    if (vv && window.innerHeight - vv.height > 1) root.style.setProperty('--app-h', Math.round(vv.height) + 'px');
    else root.style.removeProperty('--app-h');
    if (window.scrollY || (vv && vv.offsetTop)) window.scrollTo(0, 0);

    if (!isField(document.activeElement)) full = Math.max(full, h);
    const open = full - h > KB_MIN_PX && isField(document.activeElement);
    if (open !== kbOpen) {
      kbOpen = open;
      if (open) root.dataset.kb = ''; else delete root.dataset.kb;
    }
    clearTimeout(settle);
    if (open) settle = setTimeout(() => revealField(document.activeElement), SETTLE_MS);
  };
  const schedule = () => { if (!raf) raf = requestAnimationFrame(update); };

  if (vv) { vv.addEventListener('resize', schedule); vv.addEventListener('scroll', schedule); }
  window.addEventListener('resize', schedule);
  // поворот экрана — новая «полная» высота
  window.addEventListener('orientationchange', () => { full = 0; setTimeout(schedule, 300); });
  // переход между полями при открытой клавиатуре: высота не меняется, но новое поле может быть под ней
  document.addEventListener('focusin', (e) => { if (kbOpen && isField(e.target)) setTimeout(() => revealField(e.target), 60); });
  update();
}

function isField(el) {
  if (!el || !el.tagName) return false;
  if (el.tagName === 'TEXTAREA' || el.isContentEditable) return true;
  return el.tagName === 'INPUT' && !/^(checkbox|radio|button|submit|file|range|date|color)$/i.test(el.type);
}

/** Поле спряталось под клавиатуру или ушло вверх — прокручиваем ближайший прокручиваемый блок, чтобы оно было видно */
function revealField(el) {
  if (!isField(el) || !el.isConnected) return;
  const box = scrollParent(el);
  if (!box) return;
  const r = el.getBoundingClientRect(), b = box.getBoundingClientRect();
  const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
  const top = Math.max(b.top, 0) + FIELD_MARGIN_PX, bottom = Math.min(b.bottom, vh) - FIELD_MARGIN_PX;
  let dy = 0;
  if (r.bottom > bottom) dy = r.bottom - bottom;
  else if (r.top < top) dy = r.top - top;
  if (Math.abs(dy) > 2) box.scrollBy({ top: dy, behavior: 'smooth' });
}

function scrollParent(el) {
  for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
    const oy = getComputedStyle(n).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && n.scrollHeight > n.clientHeight) return n;
  }
  return null;
}
