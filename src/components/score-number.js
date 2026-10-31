// Пиксельный процент (canvas) для главного показателя на «Сегодня».
// Сейчас не подключён: блок с процентом временно убран с главной (метрики подняты наверх). Вернуть — <canvas ref> в today.html + mountScoreNumber в views/today.js.
// Анимация: число плавно набирается от 0 до значения. Между соседними числами клетки не перескакивают,
// а перетекают (общие клетки горят всё время, уходящие гаснут, новые проявляются) — без рывков.
// Разряды выровнены по правому краю и стоят на местах итогового числа — пока идёт набор, цифры не прыгают по ширине.
// При prefers-reduced-motion — сразу итоговое число.
//
// Подключение: <canvas ref="{{scoreRef}}">, где scoreRef = (el) => mountScoreNumber(el, value).
// ref вызывается после каждой отрисовки — анимация перезапускается, только когда меняется значение.
// Рисунок canvas морфдом не трогает, поэтому перерисовки интерфейса анимацию не сбивают.

export const COUNT_MS = 2200;
const INK = '248, 247, 242';

// Пиксельный шрифт 5×7: строки сверху вниз, 1 — закрашенная клетка
const GLYPHS = {
  0: ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  1: ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  2: ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  3: ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  4: ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  5: ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  6: ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  7: ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  8: ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  9: ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  '%': ['11001', '11010', '00010', '00100', '01000', '01011', '10011']
};
const BLANK = ['00000', '00000', '00000', '00000', '00000', '00000', '00000'];

/** Плавный старт и мягкая остановка */
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Разряды числа n, дополненные пустыми слева до width: digitsOf(7, 2) → ['', '7'] */
export function digitsOf(n, width) {
  const s = String(n);
  return Array.from({ length: width }, (_, i) => s[s.length - width + i] || '');
}

/** Яркость каждой клетки 5×7 при переходе от глифа a к b, f — доля пути 0..1 */
export function blendGlyph(a, b, f) {
  const ga = GLYPHS[a] || BLANK, gb = GLYPHS[b] || BLANK;
  return ga.map((row, j) => Array.from(row, (c, i) => (c === '1' ? 1 - f : 0) + (gb[j][i] === '1' ? f : 0)));
}

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** value — 0..100 или null (нет записей — пусто) */
export function mountScoreNumber(el, value) {
  if (!el) return;
  const st = el._score || (el._score = { value: undefined, raf: 0 });
  if (st.value === value) { if (!st.raf) draw(el, st, performance.now()); return; } // размер мог поменяться
  st.value = value;
  st.start = performance.now();
  st.still = reducedMotion();
  cancelAnimationFrame(st.raf);
  const tick = (now) => {
    st.raf = 0;
    if (!el.isConnected) return;
    const done = draw(el, st, now);
    if (!done) st.raf = requestAnimationFrame(tick);
  };
  st.raf = requestAnimationFrame(tick);
}

/** Рисует кадр; true — анимация закончилась */
function draw(el, st, now) {
  const w = el.clientWidth || 300, h = el.clientHeight || 120, dpr = Math.min(3, window.devicePixelRatio || 1);
  if (el.width !== Math.round(w * dpr) || el.height !== Math.round(h * dpr)) { el.width = Math.round(w * dpr); el.height = Math.round(h * dpr); }
  const ctx = el.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  if (st.value == null) return true;

  const k = st.still ? 1 : Math.min(1, (now - st.start) / COUNT_MS);
  const v = st.value * easeInOut(k);
  const lo = Math.floor(v), hi = Math.min(st.value, lo + 1), f = hi === lo ? 0 : v - lo;
  const width = String(st.value).length;
  const from = digitsOf(lo, width), to = digitsOf(hi, width);

  // размер клетки — по высоте холста, но так, чтобы число с «%» влезло по ширине
  const units = width * 5 + (width - 1) * 1.2 + 1 + 5 * 0.62;
  const cell = Math.min(h / 7, w / units);
  const gap = cell * 0.22, space = cell * 1.2, small = cell * 0.62;
  const total = units * cell;
  let x = (w - total) / 2;
  const top = (h - 7 * cell) / 2;

  for (let d = 0; d < width; d++) {
    // разряд меняется — клетки перетекают; не меняется — горит как есть
    const cells = from[d] === to[d] ? blendGlyph(from[d], from[d], 0) : blendGlyph(from[d], to[d], f);
    cells.forEach((row, j) => row.forEach((a, i) => {
      if (a <= 0.01) return;
      ctx.fillStyle = 'rgba(' + INK + ', ' + a.toFixed(3) + ')';
      ctx.fillRect(x + i * cell, top + j * cell, cell - gap, cell - gap);
    }));
    x += 5 * cell + (d < width - 1 ? space : 0);
  }
  x += cell;
  ctx.fillStyle = 'rgba(' + INK + ', .55)';
  GLYPHS['%'].forEach((row, j) => {
    for (let i = 0; i < 5; i++) if (row[i] === '1') ctx.fillRect(x + i * small, top + 7 * cell - 7 * small + j * small, small - small * 0.22, small - small * 0.22);
  });
  return k >= 1;
}
