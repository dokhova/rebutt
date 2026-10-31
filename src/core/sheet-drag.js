// Шторки снизу с двумя положениями: открываются до середины экрана, потянуть вверх — на весь экран, вниз — закрыть.
//
// Разметка: <section class="{{sheetCls}}" data-sheet="add">…<div class="sheet-handle">…<div class="sheet-head">…</section>
// Тянуть можно за полоску и шапку. Высоту, пока тянут, меняем прямо у элемента (без перерисовки приложения);
// когда отпустили — сообщаем приложению новое положение (onSnap) или закрытие (onClose), инлайн-стиль убираем,
// и CSS-переход доводит шторку до положения из класса (.sheet.full — весь экран, без класса — середина).
//
// Шторка сама раскрывается на весь экран, если в ней начали прокручивать содержимое или поставили курсор в поле ввода —
// на половине экрана с клавиатурой места не остаётся.

const MOVE_PX = 6;        // меньше — это тап по кнопке в шапке, а не жест
const FLICK = 0.5;        // px/мс — быстрый взмах решает направление, даже если протянули чуть-чуть
const CLOSE_SHARE = 0.6;  // отпустили ниже 60% от половинной высоты — закрываем
const HALF = 0.52;        // доля высоты экрана в положении «середина» — та же, что в components.css

/** @param {{ onSnap: (kind: string, full: boolean) => void, onClose: (kind: string) => void }} cb */
export function installSheetDrag({ onSnap, onClose }) {
  let drag = null;

  document.addEventListener('pointerdown', (e) => {
    const sheet = e.target.closest && e.target.closest('.sheet[data-sheet]');
    if (!sheet || !e.target.closest('.sheet-handle, .sheet-head') || e.button > 0) return;
    const box = sheet.parentElement.getBoundingClientRect();
    drag = { sheet, id: e.pointerId, y0: e.clientY, h0: sheet.offsetHeight, max: maxHeight(sheet), boxH: box.height, moved: false, t: e.timeStamp, y: e.clientY, v: 0 };
  }, true);

  document.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dy = e.clientY - drag.y0;
    if (!drag.moved && Math.abs(dy) < MOVE_PX) return;
    if (!drag.moved) {
      drag.moved = true;
      drag.sheet.style.transition = 'none';
      try { drag.sheet.setPointerCapture(e.pointerId); } catch (_) { /* не критично */ }
    }
    const dt = Math.max(1, e.timeStamp - drag.t);
    drag.v = (e.clientY - drag.y) / dt; drag.t = e.timeStamp; drag.y = e.clientY;
    drag.sheet.style.height = Math.max(0, Math.min(drag.max, drag.h0 - dy)) + 'px';
  }, true);

  const end = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag; drag = null;
    if (!d.moved) return;
    const h = d.sheet.offsetHeight, half = d.boxH * HALF, kind = d.sheet.dataset.sheet;
    let target;
    if (d.v > FLICK) target = h > half + 40 ? 'half' : 'close';      // смахнули вниз: с полного — на середину, с середины — закрыть
    else if (d.v < -FLICK) target = 'full';                           // смахнули вверх
    else if (h < half * CLOSE_SHARE) target = 'close';
    else target = h > (half + d.max) / 2 ? 'full' : 'half';
    // убираем инлайн-высоту — переход из CSS доводит шторку до положения по классу
    d.sheet.style.transition = '';
    d.sheet.style.height = '';
    if (target === 'close') onClose(kind);
    else onSnap(kind, target === 'full');
  };
  document.addEventListener('pointerup', end, true);
  document.addEventListener('pointercancel', end, true);

  // начали прокручивать содержимое на половине экрана — раскрываем
  document.addEventListener('scroll', (e) => {
    const el = e.target;
    if (!el.classList || !el.classList.contains('sheet-body') || el.scrollTop < 8) return;
    const sheet = el.closest('.sheet[data-sheet]');
    if (sheet && !sheet.classList.contains('full')) onSnap(sheet.dataset.sheet, true);
  }, true);

  // поле ввода в шторке — на весь экран, иначе клавиатура закроет всё
  document.addEventListener('focusin', (e) => {
    const t = e.target;
    if (!t || !(t.tagName === 'TEXTAREA' || (t.tagName === 'INPUT' && t.type === 'text'))) return;
    const sheet = t.closest('.sheet[data-sheet]');
    if (sheet && !sheet.classList.contains('full')) onSnap(sheet.dataset.sheet, true);
  });
}

/** Высота шторки в положении «весь экран»: временно ставим класс и меряем */
function maxHeight(sheet) {
  const had = sheet.classList.contains('full');
  const prev = sheet.style.transition;
  sheet.style.transition = 'none';
  sheet.classList.add('full');
  const h = sheet.offsetHeight;
  if (!had) sheet.classList.remove('full');
  sheet.style.transition = prev;
  return h;
}
