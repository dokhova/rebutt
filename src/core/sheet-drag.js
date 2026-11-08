// Шторки снизу (сейчас — ИИ-помощник) с двумя положениями: открываются до середины экрана, потянуть вверх — на весь экран, вниз — закрыть.
//
// Разметка: <section class="{{sheetCls}}" data-sheet="assistant">…<div class="sheet-handle">…<div class="sheet-head">…</section>
// Тянуть можно за полоску и шапку. Пока тянут, двигаем элемент сами (без перерисовки приложения):
// вниз — сдвигом transform (дёшево, содержимое не перекладывается), вверх — высотой. Обновление — раз в кадр.
// Отпустили: на середину / весь экран — сообщаем приложению (onSnap), CSS-переход доводит до положения из класса;
// закрыть — шторка уезжает вниз до конца, фон гаснет, и только потом onClose (иначе она сначала прыгала обратно вверх).
//
// Шторка сама раскрывается на весь экран, если человек сам начал прокручивать содержимое (не автопрокрутка ленты
// к новому ответу — из-за неё шторка раньше дёргалась наверх) или поставил курсор в поле ввода.

const MOVE_PX = 6;        // меньше — это тап по кнопке в шапке, а не жест
const FLICK = 0.5;        // px/мс — быстрый взмах решает направление, даже если протянули чуть-чуть
const CLOSE_SHARE = 0.6;  // отпустили ниже 60% от половинной высоты — закрываем
const HALF = 0.52;        // доля высоты экрана в положении «середина» — та же, что в components.css
const CLOSE_MS = 240;     // уезжает вниз при закрытии
const TOUCH_MS = 600;     // прокрутка в течение этого времени после касания/колеса — от человека, а не автопрокрутка

/** Плавно убрать шторку вниз и погасить фон, потом done(). Вызывается и жестом, и крестиком/тапом по фону. */
export function animateSheetClose(sheet, done) {
  if (!sheet || sheet.dataset.closing) { if (!sheet) done(); return; }
  sheet.dataset.closing = '1';
  const backdrop = sheet.previousElementSibling && sheet.previousElementSibling.classList.contains('sheet-backdrop') ? sheet.previousElementSibling : null;
  const from = getComputedStyle(sheet).transform;
  sheet.style.animation = 'none';
  sheet.style.transition = 'none';
  sheet.style.transform = from === 'none' ? 'translateY(0)' : from;
  sheet.getBoundingClientRect();
  sheet.style.transition = 'transform ' + CLOSE_MS + 'ms cubic-bezier(.4, 0, 1, 1)';
  sheet.style.transform = 'translateY(100%)';
  if (backdrop) { backdrop.style.animation = 'none'; backdrop.style.transition = 'opacity ' + CLOSE_MS + 'ms ease'; backdrop.style.opacity = '0'; }
  setTimeout(done, CLOSE_MS);
}

/** @param {{ onSnap: (kind: string, full: boolean) => void, onClose: (kind: string) => void }} cb */
export function installSheetDrag({ onSnap, onClose }) {
  let drag = null, frame = 0, touchedAt = -1e9;

  const apply = () => {
    frame = 0;
    if (!drag) return;
    const want = drag.h0 - drag.dy;
    if (want >= drag.h0) { drag.sheet.style.transform = ''; drag.sheet.style.height = Math.min(drag.max, want) + 'px'; }
    else { drag.sheet.style.height = drag.h0 + 'px'; drag.sheet.style.transform = 'translateY(' + Math.min(drag.h0, drag.dy) + 'px)'; }
  };

  document.addEventListener('pointerdown', (e) => {
    const sheet = e.target.closest && e.target.closest('.sheet[data-sheet]');
    if (!sheet || sheet.dataset.closing || !e.target.closest('.sheet-handle, .sheet-head') || e.button > 0) return;
    if (e.target.closest('button')) return; // крестик и кнопки в шапке — это тап, не жест
    const box = sheet.parentElement.getBoundingClientRect();
    drag = { sheet, id: e.pointerId, y0: e.clientY, h0: sheet.offsetHeight, max: maxHeight(sheet), boxH: box.height, moved: false, t: e.timeStamp, y: e.clientY, v: 0, dy: 0 };
  }, true);

  document.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dy = e.clientY - drag.y0;
    if (!drag.moved && Math.abs(dy) < MOVE_PX) return;
    if (!drag.moved) {
      drag.moved = true;
      drag.sheet.style.transition = 'none';
      drag.sheet.style.animation = 'none';
      try { drag.sheet.setPointerCapture(e.pointerId); } catch (_) { /* не критично */ }
    }
    const dt = Math.max(1, e.timeStamp - drag.t);
    drag.v = (e.clientY - drag.y) / dt; drag.t = e.timeStamp; drag.y = e.clientY;
    drag.dy = dy;
    if (!frame) frame = requestAnimationFrame(apply);
  }, true);

  const end = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag; drag = null;
    if (frame) { cancelAnimationFrame(frame); frame = 0; }
    if (!d.moved) return;
    const h = Math.max(0, Math.min(d.max, d.h0 - d.dy)), half = d.boxH * HALF, kind = d.sheet.dataset.sheet;
    let target;
    if (d.v > FLICK) target = h > half + 40 ? 'half' : 'close';      // смахнули вниз: с полного — на середину, с середины — закрыть
    else if (d.v < -FLICK) target = 'full';                           // смахнули вверх
    else if (h < half * CLOSE_SHARE) target = 'close';
    else target = h > (half + d.max) / 2 ? 'full' : 'half';
    if (target === 'close') { animateSheetClose(d.sheet, () => onClose(kind)); return; }
    // убираем инлайн-стили — переход из CSS доводит шторку до положения по классу
    d.sheet.style.transition = 'height .34s cubic-bezier(.2, .8, .2, 1), transform .34s cubic-bezier(.2, .8, .2, 1)';
    d.sheet.style.height = '';
    d.sheet.style.transform = '';
    setTimeout(() => { if (!d.sheet.dataset.closing) d.sheet.style.transition = ''; }, 360);
    onSnap(kind, target === 'full');
  };
  document.addEventListener('pointerup', end, true);
  document.addEventListener('pointercancel', end, true);

  // человек начал прокручивать содержимое на половине экрана — раскрываем (автопрокрутку ленты не считаем)
  const touched = (e) => { if (e.target.closest && e.target.closest('.sheet-body')) touchedAt = e.timeStamp; };
  document.addEventListener('touchmove', touched, { capture: true, passive: true });
  document.addEventListener('wheel', touched, { capture: true, passive: true });
  document.addEventListener('scroll', (e) => {
    const el = e.target;
    if (!el.classList || !el.classList.contains('sheet-body') || el.scrollTop < 8) return;
    if (e.timeStamp - touchedAt > TOUCH_MS) return;
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
