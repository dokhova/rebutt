// Плавный ползунок для шкал 0…max (стресс).
//
// Почему не просто <input type="range"> с onInput: каждое событие input перерисовывает всё приложение,
// и на телефоне ползунок дёргается и отстаёт. Здесь, пока палец на шкале, меняется только сам элемент
// (CSS-переменная --p, значение input и подпись), а состояние приложения — один раз, когда палец отпустили.
//
// Разметка (src/templates/partials/gut-form.html):
//   <div class="range" data-range style="--p: 40" onPointerDown="{{drag}}" onPointerMove="{{drag}}" onPointerUp="{{drag}}" onPointerCancel="{{drag}}">
//     <input class="range-input" type="range" …>   ← остаётся для клавиатуры и экранного диктора
//     <div class="range-track">…</div>
//   </div>
//   рядом — элемент с data-range-label, в нём подпись текущего значения
//
// Тап по любому месту шкалы сразу ставит значение; горизонтальный жест тянет ползунок,
// вертикальный — прокручивает экран (touch-action: pan-y), и тогда значение возвращается к прежнему.

/**
 * Обработчик pointer-событий шкалы.
 * @param {PointerEvent} e
 * @param {{ max: number, label: (v: number) => string, onStep?: (v: number) => void, onCommit: (v: number) => void }} opts
 */
export function rangeDrag(e, { max, label, onStep, onCommit }) {
  const wrap = e.target.closest && e.target.closest('[data-range]');
  if (!wrap) return;
  const input = wrap.querySelector('input');
  const valueAt = (x) => {
    const r = wrap.getBoundingClientRect();
    return Math.round(Math.min(1, Math.max(0, (x - r.left) / r.width)) * max);
  };
  const show = (v) => {
    wrap.style.setProperty('--p', String(v / max * 100));
    wrap.classList.remove('unset');
    if (input) input.value = String(v);
    const box = wrap.closest('.card') || wrap.parentNode;
    const out = box && box.querySelector('[data-range-label]');
    if (out) out.textContent = label(v);
  };

  if (e.type === 'pointerdown') {
    if (e.button > 0) return;
    const v = valueAt(e.clientX);
    wrap._drag = { id: e.pointerId, v, start: input ? Number(input.value) : 0, wasUnset: wrap.classList.contains('unset') };
    try { wrap.setPointerCapture(e.pointerId); } catch (_) { /* старые браузеры */ }
    show(v);
    if (onStep) onStep(v);
    return;
  }

  const d = wrap._drag;
  if (!d || d.id !== e.pointerId) return;

  if (e.type === 'pointermove') {
    const v = valueAt(e.clientX);
    if (v !== d.v) { d.v = v; show(v); if (onStep) onStep(v); }
    return;
  }

  wrap._drag = null;
  try { wrap.releasePointerCapture(e.pointerId); } catch (_) { /* уже отпущен */ }
  if (e.type === 'pointercancel') {
    // браузер забрал жест под прокрутку — возвращаем как было
    if (d.wasUnset) { wrap.classList.add('unset'); wrap.style.setProperty('--p', '0'); if (input) input.value = '0'; }
    else show(d.start);
    return;
  }
  onCommit(d.v);
}
